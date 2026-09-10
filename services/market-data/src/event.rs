use chrono::{DateTime, Duration, Utc};
use prost::Message;
use prost_types::Timestamp;
use serde::Serialize;
use thiserror::Error;
use uuid::Uuid;

pub const SCHEMA_VERSION: u32 = 1;
pub const BARS_TOPIC: &str = "market.bars.v1";
pub const QUOTES_TOPIC: &str = "market.quotes.v1";
const EVENT_NAMESPACE: Uuid = Uuid::from_u128(0xa9b7_10ef_54b3_47d3_9112_9ebf_f0d3_7b01);

#[derive(Clone, PartialEq, Message)]
pub struct EventEnvelope {
    #[prost(string, tag = "1")]
    pub event_id: String,
    #[prost(uint32, tag = "2")]
    pub schema_version: u32,
    #[prost(string, tag = "3")]
    pub event_type: String,
    #[prost(string, tag = "4")]
    pub producer: String,
    #[prost(message, optional, tag = "5")]
    pub occurred_at: Option<Timestamp>,
    #[prost(string, tag = "6")]
    pub correlation_id: String,
    #[prost(string, tag = "7")]
    pub causation_id: String,
    #[prost(string, tag = "8")]
    pub idempotency_key: String,
    #[prost(string, tag = "9")]
    pub tenant_id: String,
}

#[derive(Clone, PartialEq, Message)]
pub struct MarketBarEvent {
    #[prost(message, optional, tag = "1")]
    pub envelope: Option<EventEnvelope>,
    #[prost(string, tag = "2")]
    pub symbol: String,
    #[prost(enumeration = "AssetClass", tag = "3")]
    pub asset_class: i32,
    #[prost(string, tag = "4")]
    pub interval: String,
    #[prost(message, optional, tag = "5")]
    pub window_start: Option<Timestamp>,
    #[prost(message, optional, tag = "6")]
    pub window_end: Option<Timestamp>,
    #[prost(string, tag = "7")]
    pub open: String,
    #[prost(string, tag = "8")]
    pub high: String,
    #[prost(string, tag = "9")]
    pub low: String,
    #[prost(string, tag = "10")]
    pub close: String,
    #[prost(string, tag = "11")]
    pub volume: String,
    #[prost(uint64, tag = "12")]
    pub trade_count: u64,
    #[prost(string, tag = "13")]
    pub volume_weighted_price: String,
    #[prost(uint64, tag = "14")]
    pub provider_sequence: u64,
}

#[derive(Clone, PartialEq, Message)]
pub struct MarketQuoteEvent {
    #[prost(message, optional, tag = "1")]
    pub envelope: Option<EventEnvelope>,
    #[prost(string, tag = "2")]
    pub symbol: String,
    #[prost(enumeration = "AssetClass", tag = "3")]
    pub asset_class: i32,
    #[prost(message, optional, tag = "4")]
    pub observed_at: Option<Timestamp>,
    #[prost(string, tag = "5")]
    pub bid_price: String,
    #[prost(string, tag = "6")]
    pub ask_price: String,
    #[prost(string, tag = "7")]
    pub bid_size: String,
    #[prost(string, tag = "8")]
    pub ask_size: String,
    #[prost(string, repeated, tag = "9")]
    pub conditions: Vec<String>,
    #[prost(string, tag = "10")]
    pub tape: String,
    #[prost(uint64, tag = "11")]
    pub provider_sequence: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub enum AssetClass {
    Unspecified = 0,
    Equity = 1,
    Crypto = 2,
}

#[derive(Clone, Debug)]
pub enum NormalizedEvent {
    Bar(MarketBarEvent),
    Quote(MarketQuoteEvent),
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct LiveEvent {
    pub id: String,
    pub event_type: &'static str,
    pub symbol: String,
    pub observed_at: DateTime<Utc>,
    pub payload: serde_json::Value,
}

#[derive(Debug, Error)]
pub enum EventError {
    #[error("event is missing its envelope")]
    MissingEnvelope,
    #[error("event is missing timestamp {0}")]
    MissingTimestamp(&'static str),
    #[error("invalid timestamp {0}")]
    InvalidTimestamp(&'static str),
    #[error("unsupported schema version {0}")]
    UnsupportedVersion(u32),
    #[error("unsupported Kafka topic {0}")]
    UnsupportedTopic(String),
    #[error("protobuf decode failed: {0}")]
    Decode(#[from] prost::DecodeError),
}

impl NormalizedEvent {
    pub fn topic(&self) -> &'static str {
        match self {
            Self::Bar(_) => BARS_TOPIC,
            Self::Quote(_) => QUOTES_TOPIC,
        }
    }

    pub fn symbol(&self) -> &str {
        match self {
            Self::Bar(event) => &event.symbol,
            Self::Quote(event) => &event.symbol,
        }
    }

    pub fn envelope(&self) -> Result<&EventEnvelope, EventError> {
        match self {
            Self::Bar(event) => event.envelope.as_ref(),
            Self::Quote(event) => event.envelope.as_ref(),
        }
        .ok_or(EventError::MissingEnvelope)
    }

    pub fn encode(&self) -> Vec<u8> {
        match self {
            Self::Bar(event) => event.encode_to_vec(),
            Self::Quote(event) => event.encode_to_vec(),
        }
    }

    pub fn decode(topic: &str, payload: &[u8]) -> Result<Self, EventError> {
        let event = match topic {
            BARS_TOPIC => Self::Bar(MarketBarEvent::decode(payload)?),
            QUOTES_TOPIC => Self::Quote(MarketQuoteEvent::decode(payload)?),
            _ => return Err(EventError::UnsupportedTopic(topic.to_owned())),
        };
        let version = event.envelope()?.schema_version;
        if version != SCHEMA_VERSION {
            return Err(EventError::UnsupportedVersion(version));
        }
        Ok(event)
    }

    pub fn live_event(&self) -> Result<LiveEvent, EventError> {
        let envelope = self.envelope()?;
        match self {
            Self::Bar(event) => Ok(LiveEvent {
                id: envelope.event_id.clone(),
                event_type: "bar",
                symbol: event.symbol.clone(),
                observed_at: timestamp(event.window_end.as_ref(), "window_end")?,
                payload: serde_json::json!({
                    "symbol": event.symbol,
                    "interval": event.interval,
                    "open": event.open,
                    "high": event.high,
                    "low": event.low,
                    "close": event.close,
                    "volume": event.volume,
                    "tradeCount": event.trade_count,
                    "vwap": event.volume_weighted_price,
                }),
            }),
            Self::Quote(event) => Ok(LiveEvent {
                id: envelope.event_id.clone(),
                event_type: "quote",
                symbol: event.symbol.clone(),
                observed_at: timestamp(event.observed_at.as_ref(), "observed_at")?,
                payload: serde_json::json!({
                    "symbol": event.symbol,
                    "bidPrice": event.bid_price,
                    "askPrice": event.ask_price,
                    "bidSize": event.bid_size,
                    "askSize": event.ask_size,
                    "conditions": event.conditions,
                    "tape": event.tape,
                }),
            }),
        }
    }
}

pub fn envelope(event_type: &str, identity: &str, occurred_at: DateTime<Utc>) -> EventEnvelope {
    let idempotency_key = format!("alpaca:{event_type}:{identity}");
    EventEnvelope {
        event_id: Uuid::new_v5(&EVENT_NAMESPACE, idempotency_key.as_bytes()).to_string(),
        schema_version: SCHEMA_VERSION,
        event_type: event_type.into(),
        producer: "indus-market-data".into(),
        occurred_at: Some(to_timestamp(occurred_at)),
        correlation_id: Uuid::new_v5(&EVENT_NAMESPACE, identity.as_bytes()).to_string(),
        causation_id: String::new(),
        idempotency_key,
        tenant_id: String::new(),
    }
}

pub fn to_timestamp(value: DateTime<Utc>) -> Timestamp {
    Timestamp {
        seconds: value.timestamp(),
        nanos: value.timestamp_subsec_nanos() as i32,
    }
}

pub fn timestamp(
    value: Option<&Timestamp>,
    field: &'static str,
) -> Result<DateTime<Utc>, EventError> {
    let value = value.ok_or(EventError::MissingTimestamp(field))?;
    DateTime::from_timestamp(value.seconds, value.nanos as u32)
        .ok_or(EventError::InvalidTimestamp(field))
}

pub fn minute_end(start: DateTime<Utc>) -> DateTime<Utc> {
    start + Duration::minutes(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replay_identity_is_deterministic() {
        let at = "2026-01-01T12:00:00Z".parse().unwrap();
        let first = envelope("market.bar.v1", "AAPL|2026-01-01T12:00:00Z|1m", at);
        let replay = envelope("market.bar.v1", "AAPL|2026-01-01T12:00:00Z|1m", at);
        assert_eq!(first.event_id, replay.event_id);
        assert_eq!(first.idempotency_key, replay.idempotency_key);
    }

    #[test]
    fn decoding_rejects_unknown_topics_missing_envelopes_and_future_versions() {
        assert!(matches!(
            NormalizedEvent::decode("market.unknown.v1", &[]),
            Err(EventError::UnsupportedTopic(_))
        ));

        let missing = MarketQuoteEvent::default().encode_to_vec();
        assert!(matches!(
            NormalizedEvent::decode(QUOTES_TOPIC, &missing),
            Err(EventError::MissingEnvelope)
        ));

        let mut quote = MarketQuoteEvent {
            envelope: Some(envelope("market.quote.v1", "future", Utc::now())),
            ..Default::default()
        };
        quote.envelope.as_mut().unwrap().schema_version = SCHEMA_VERSION + 1;
        assert!(matches!(
            NormalizedEvent::decode(QUOTES_TOPIC, &quote.encode_to_vec()),
            Err(EventError::UnsupportedVersion(2))
        ));
    }

    #[test]
    fn timestamp_validation_rejects_missing_and_out_of_range_values() {
        assert!(matches!(
            timestamp(None, "observed_at"),
            Err(EventError::MissingTimestamp("observed_at"))
        ));
        let invalid = Timestamp {
            seconds: i64::MAX,
            nanos: 0,
        };
        assert!(matches!(
            timestamp(Some(&invalid), "observed_at"),
            Err(EventError::InvalidTimestamp("observed_at"))
        ));
    }
}
