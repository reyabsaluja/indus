use std::{sync::Arc, thread, time::Duration};

use async_trait::async_trait;
use aws_config::Region;
use aws_msk_iam_sasl_signer::generate_auth_token;
use rdkafka::{
    ClientConfig, ClientContext, Message,
    client::OAuthToken,
    consumer::{CommitMode, Consumer, ConsumerContext, StreamConsumer},
    message::{Header, Headers, OwnedHeaders},
    producer::{FutureProducer, FutureRecord, Producer, ProducerContext},
    util::Timeout,
};
use thiserror::Error;
use tokio::{
    runtime::Handle,
    sync::{Mutex, watch},
    time,
};
use tracing::{error, info, warn};

use crate::{
    config::KafkaConfig,
    event::{BARS_TOPIC, NormalizedEvent, QUOTES_TOPIC},
    health::ServiceHealth,
    metrics::Metrics,
    persistence::{EventStore, PersistOutcome},
};

#[derive(Clone, Debug)]
pub struct KafkaRecord {
    pub topic: String,
    pub payload: Vec<u8>,
    pub event_id: Option<String>,
    pub partition: i32,
    pub offset: i64,
}

#[derive(Debug, Error)]
pub enum KafkaError {
    #[error("Kafka configuration failed: {0}")]
    Configuration(#[from] rdkafka::error::KafkaError),
    #[error("Kafka delivery failed: {0}")]
    Delivery(String),
    #[error("Kafka transaction failed: {0}")]
    Transaction(String),
    #[error("event metadata is invalid: {0}")]
    Event(String),
}

pub struct KafkaContext {
    aws_region: Option<Region>,
    runtime: Handle,
}

impl KafkaContext {
    fn new(aws_region: Option<&str>) -> Self {
        Self {
            aws_region: aws_region.map(|value| Region::new(value.to_owned())),
            runtime: Handle::current(),
        }
    }
}

impl ClientContext for KafkaContext {
    const ENABLE_REFRESH_OAUTH_TOKEN: bool = true;

    fn generate_oauth_token(
        &self,
        _oauthbearer_config: Option<&str>,
    ) -> Result<OAuthToken, Box<dyn std::error::Error>> {
        let region = self
            .aws_region
            .clone()
            .ok_or("AWS_REGION is required for OAUTHBEARER")?;
        let runtime = self.runtime.clone();
        let join = thread::spawn(move || {
            runtime.block_on(async {
                time::timeout(Duration::from_secs(10), generate_auth_token(region)).await
            })
        });
        let (token, lifetime_ms) = join.join().map_err(|_| "MSK IAM signer panicked")???;
        Ok(OAuthToken {
            token,
            principal_name: String::new(),
            lifetime_ms,
        })
    }
}

impl ProducerContext for KafkaContext {
    type DeliveryOpaque = ();

    fn delivery(
        &self,
        _delivery_result: &rdkafka::message::DeliveryResult<'_>,
        _delivery_opaque: Self::DeliveryOpaque,
    ) {
    }
}

impl ConsumerContext for KafkaContext {}

#[async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, events: &[NormalizedEvent]) -> Result<(), KafkaError>;
}

pub struct KafkaPublisher {
    producer: FutureProducer<KafkaContext>,
    transaction: Mutex<()>,
}

impl KafkaPublisher {
    pub fn new(config: &KafkaConfig) -> Result<Self, KafkaError> {
        let mut client = base_config(config);
        client
            .set("enable.idempotence", "true")
            .set("acks", "all")
            .set("max.in.flight.requests.per.connection", "5")
            .set("message.send.max.retries", "2147483647")
            .set("delivery.timeout.ms", "30000")
            .set("transaction.timeout.ms", "30000")
            .set("transactional.id", &config.transactional_id);
        let producer: FutureProducer<KafkaContext> =
            client.create_with_context(KafkaContext::new(config.aws_region.as_deref()))?;
        producer
            .init_transactions(Timeout::After(Duration::from_secs(15)))
            .map_err(|error| KafkaError::Transaction(error.to_string()))?;
        Ok(Self {
            producer,
            transaction: Mutex::new(()),
        })
    }
}

#[async_trait]
impl EventPublisher for KafkaPublisher {
    async fn publish(&self, events: &[NormalizedEvent]) -> Result<(), KafkaError> {
        if events.is_empty() {
            return Ok(());
        }
        let _transaction = self.transaction.lock().await;
        self.producer
            .begin_transaction()
            .map_err(|error| KafkaError::Transaction(error.to_string()))?;
        for event in events {
            let envelope = event
                .envelope()
                .map_err(|error| KafkaError::Event(error.to_string()))?;
            let payload = event.encode();
            let headers = OwnedHeaders::new()
                .insert(Header {
                    key: "event_id",
                    value: Some(envelope.event_id.as_bytes()),
                })
                .insert(Header {
                    key: "schema_version",
                    value: Some(envelope.schema_version.to_string().as_bytes()),
                })
                .insert(Header {
                    key: "correlation_id",
                    value: Some(envelope.correlation_id.as_bytes()),
                });
            let record = FutureRecord::to(event.topic())
                .key(event.symbol())
                .payload(&payload)
                .headers(headers);
            if let Err((error, _)) = self.producer.send(record, Duration::from_secs(10)).await {
                let _ = self
                    .producer
                    .abort_transaction(Timeout::After(Duration::from_secs(5)));
                return Err(KafkaError::Delivery(error.to_string()));
            }
        }
        self.producer
            .commit_transaction(Timeout::After(Duration::from_secs(15)))
            .map_err(|error| KafkaError::Transaction(error.to_string()))
    }
}

pub async fn run_consumer<S: EventStore + 'static>(
    config: KafkaConfig,
    store: Arc<S>,
    metrics: Metrics,
    health: Arc<ServiceHealth>,
    mut shutdown: watch::Receiver<bool>,
) -> Result<(), KafkaError> {
    let mut client = base_config(&config);
    client
        .set("group.id", &config.group_id)
        .set("enable.auto.commit", "false")
        .set("enable.auto.offset.store", "false")
        .set("auto.offset.reset", "earliest")
        .set("isolation.level", "read_committed")
        .set("session.timeout.ms", "10000");
    let consumer: StreamConsumer<KafkaContext> =
        client.create_with_context(KafkaContext::new(config.aws_region.as_deref()))?;
    consumer.subscribe(&[BARS_TOPIC, QUOTES_TOPIC])?;
    health.set_kafka_ready(true);
    info!(group_id = config.group_id, "Kafka consumer started");

    loop {
        tokio::select! {
            changed = shutdown.changed() => {
                if changed.is_err() || *shutdown.borrow() { break; }
            }
            received = consumer.recv() => match received {
                Ok(message) => {
                    let record = KafkaRecord {
                        topic: message.topic().to_owned(),
                        payload: message.payload().unwrap_or_default().to_vec(),
                        event_id: header_value(message.headers(), "event_id"),
                        partition: message.partition(),
                        offset: message.offset(),
                    };
                    loop {
                        match store.persist(&record).await {
                            Ok(PersistOutcome::Stored) => { metrics.persisted.inc(); break; }
                            Ok(PersistOutcome::Duplicate) => { metrics.duplicates.inc(); break; }
                            Ok(PersistOutcome::Rejected) => { metrics.rejected.inc(); break; }
                            Err(error) => {
                                error!(%error, topic = record.topic, partition = record.partition, offset = record.offset, "persistence failed; offset is not committed");
                                tokio::select! {
                                    _ = time::sleep(Duration::from_secs(1)) => {},
                                    changed = shutdown.changed() => {
                                        if changed.is_err() || *shutdown.borrow() {
                                            health.set_kafka_ready(false);
                                            return Ok(());
                                        }
                                    }
                                }
                            }
                        }
                    }
                    consumer.commit_message(&message, CommitMode::Sync)?;
                }
                Err(error) => {
                    warn!(%error, "Kafka receive failed");
                    health.set_kafka_ready(false);
                    time::sleep(Duration::from_millis(500)).await;
                    health.set_kafka_ready(true);
                }
            }
        }
    }
    health.set_kafka_ready(false);
    Ok(())
}

fn base_config(config: &KafkaConfig) -> ClientConfig {
    let mut client = ClientConfig::new();
    client
        .set("bootstrap.servers", &config.bootstrap_servers)
        .set("security.protocol", &config.security_protocol)
        .set("client.id", "indus-market-data");
    if let Some(value) = &config.sasl_mechanism {
        client.set("sasl.mechanism", value);
    }
    if let Some(value) = &config.sasl_username {
        client.set("sasl.username", value);
    }
    if let Some(value) = &config.sasl_password {
        client.set("sasl.password", value);
    }
    if let Some(value) = &config.ssl_ca_location {
        client.set("ssl.ca.location", value);
    }
    client
}

fn header_value<H: Headers>(headers: Option<&H>, key: &str) -> Option<String> {
    let headers = headers?;
    (0..headers.count()).find_map(|index| {
        let header = headers.get(index);
        (header.key == key)
            .then(|| {
                header
                    .value
                    .map(|value| String::from_utf8_lossy(value).into_owned())
            })
            .flatten()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> KafkaConfig {
        KafkaConfig {
            bootstrap_servers: "broker:9092".into(),
            transactional_id: "producer-1".into(),
            group_id: "consumer-1".into(),
            security_protocol: "SASL_SSL".into(),
            sasl_mechanism: Some("OAUTHBEARER".into()),
            sasl_username: None,
            sasl_password: None,
            ssl_ca_location: Some("/etc/ssl/certs/ca.pem".into()),
            aws_region: Some("us-east-1".into()),
        }
    }

    #[test]
    fn applies_transport_configuration_without_static_credentials() {
        let client = base_config(&config());
        assert_eq!(client.get("bootstrap.servers"), Some("broker:9092"));
        assert_eq!(client.get("security.protocol"), Some("SASL_SSL"));
        assert_eq!(client.get("sasl.mechanism"), Some("OAUTHBEARER"));
        assert_eq!(client.get("ssl.ca.location"), Some("/etc/ssl/certs/ca.pem"));
        assert_eq!(client.get("sasl.username"), None);
        assert_eq!(client.get("sasl.password"), None);
    }

    #[test]
    fn extracts_trace_headers_without_assuming_utf8_payloads() {
        let headers = OwnedHeaders::new()
            .insert(Header {
                key: "event_id",
                value: Some("event-1"),
            })
            .insert(Header {
                key: "binary",
                value: Some(&[0xff_u8][..]),
            });
        assert_eq!(
            header_value(Some(&headers), "event_id"),
            Some("event-1".into())
        );
        assert_eq!(header_value(Some(&headers), "missing"), None);
        assert_eq!(header_value::<OwnedHeaders>(None, "event_id"), None);
    }
}
