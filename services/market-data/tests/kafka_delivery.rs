use std::{
    sync::Arc,
    time::{Duration, SystemTime},
};

use indus_market_data::{
    config::KafkaConfig,
    event::NormalizedEvent,
    health::ServiceHealth,
    kafka::{EventPublisher, KafkaPublisher, run_consumer},
    metrics::Metrics,
    persistence::PostgresStore,
    provider::{FeedKind, parse_message},
};
use tokio::{sync::watch, time};
use uuid::Uuid;

#[tokio::test]
async fn transactional_publish_is_consumed_before_offsets_advance() {
    let (Ok(database_url), Ok(brokers)) = (
        std::env::var("TEST_DATABASE_URL"),
        std::env::var("TEST_KAFKA_BROKERS"),
    ) else {
        eprintln!(
            "skipping Kafka integration test: TEST_DATABASE_URL or TEST_KAFKA_BROKERS is unset"
        );
        return;
    };
    let nonce = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let config = KafkaConfig {
        bootstrap_servers: brokers,
        transactional_id: format!("indus-market-test-{nonce}"),
        group_id: format!("indus-market-test-{nonce}"),
        security_protocol: "PLAINTEXT".into(),
        sasl_mechanism: None,
        sasl_username: None,
        sasl_password: None,
        ssl_ca_location: None,
        aws_region: None,
    };
    let store = Arc::new(PostgresStore::connect(&database_url).await.unwrap());
    let mut events = parse_message(
        include_str!("fixtures/alpaca_equity.json"),
        FeedKind::Equity,
    )
    .unwrap();
    events.reverse();
    for (index, event) in events.iter_mut().enumerate() {
        let id = Uuid::new_v5(
            &Uuid::NAMESPACE_OID,
            format!("kafka-integration-{nonce}-{index}").as_bytes(),
        );
        match event {
            NormalizedEvent::Bar(event) => {
                event.envelope.as_mut().unwrap().event_id = id.to_string()
            }
            NormalizedEvent::Quote(event) => {
                event.envelope.as_mut().unwrap().event_id = id.to_string()
            }
        }
    }
    let ids = events
        .iter()
        .map(|event| Uuid::parse_str(&event.envelope().unwrap().event_id).unwrap())
        .collect::<Vec<_>>();
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let consumer = tokio::spawn(run_consumer(
        config.clone(),
        store.clone(),
        Metrics::new().unwrap(),
        Arc::new(ServiceHealth::default()),
        shutdown_rx,
    ));
    time::sleep(Duration::from_millis(500)).await;

    let publisher = KafkaPublisher::new(&config).unwrap();
    publisher.publish(&events).await.unwrap();
    publisher.publish(&events).await.unwrap();

    time::timeout(Duration::from_secs(15), async {
        loop {
            if futures::future::try_join_all(
                ids.iter()
                    .map(|event_id| store.has_consumed_event(*event_id)),
            )
            .await
            .unwrap()
            .into_iter()
            .all(|exists| exists)
            {
                break;
            }
            time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .expect("Kafka records were not persisted before the deadline");

    shutdown_tx.send(true).unwrap();
    consumer.await.unwrap().unwrap();
}
