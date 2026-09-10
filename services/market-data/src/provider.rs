use std::{sync::Arc, time::Duration};

use chrono::{DateTime, Utc};
use futures::{SinkExt, StreamExt};
use rand::Rng;
use serde_json::Value;
use thiserror::Error;
use tokio::{
    sync::{mpsc, watch},
    time,
};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{info, warn};

use crate::{
    config::AlpacaConfig,
    event::{
        AssetClass, MarketBarEvent, MarketQuoteEvent, NormalizedEvent, envelope, minute_end,
        to_timestamp,
    },
    health::ServiceHealth,
    metrics::Metrics,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FeedKind {
    Equity,
    Crypto,
}

impl FeedKind {
    fn asset_class(self) -> AssetClass {
        match self {
            Self::Equity => AssetClass::Equity,
            Self::Crypto => AssetClass::Crypto,
        }
    }
}

#[derive(Debug, Error)]
pub enum ProviderError {
    #[error("provider payload is not a JSON array: {0}")]
    InvalidJson(#[from] serde_json::Error),
    #[error("provider event is missing {0}")]
    Missing(&'static str),
    #[error("provider event contains invalid {0}")]
    Invalid(&'static str),
    #[error("unsupported symbol {0}")]
    Symbol(String),
    #[error("provider connection failed: {0}")]
    Connection(String),
}

pub fn parse_message(payload: &str, feed: FeedKind) -> Result<Vec<NormalizedEvent>, ProviderError> {
    let messages: Vec<Value> = serde_json::from_str(payload)?;
    messages
        .iter()
        .filter_map(|message| match message.get("T").and_then(Value::as_str) {
            Some("b") => Some(parse_bar(message, feed)),
            Some("q") => Some(parse_quote(message, feed)),
            _ => None,
        })
        .collect()
}

fn parse_bar(value: &Value, feed: FeedKind) -> Result<NormalizedEvent, ProviderError> {
    let symbol = normalize_symbol(text(value, "S")?)?;
    let observed_at = parse_time(text(value, "t")?)?;
    let interval = "1m";
    let identity = format!("{symbol}|{}|{interval}", observed_at.to_rfc3339());
    Ok(NormalizedEvent::Bar(MarketBarEvent {
        envelope: Some(envelope("market.bar.v1", &identity, observed_at)),
        symbol,
        asset_class: feed.asset_class() as i32,
        interval: interval.into(),
        window_start: Some(to_timestamp(observed_at)),
        window_end: Some(to_timestamp(minute_end(observed_at))),
        open: decimal(value, "o")?,
        high: decimal(value, "h")?,
        low: decimal(value, "l")?,
        close: decimal(value, "c")?,
        volume: decimal(value, "v")?,
        trade_count: unsigned_or_zero(value, "n")?,
        volume_weighted_price: decimal_or_empty(value, "vw")?,
        provider_sequence: unsigned_or_zero(value, "i")?,
    }))
}

fn parse_quote(value: &Value, feed: FeedKind) -> Result<NormalizedEvent, ProviderError> {
    let symbol = normalize_symbol(text(value, "S")?)?;
    let observed_at = parse_time(text(value, "t")?)?;
    let bid_price = decimal(value, "bp")?;
    let ask_price = decimal(value, "ap")?;
    let bid_size = decimal(value, "bs")?;
    let ask_size = decimal(value, "as")?;
    let conditions: Vec<String> = value
        .get("c")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default();
    let tape = value
        .get("z")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let identity = format!(
        "{symbol}|{}|{bid_price}|{ask_price}|{bid_size}|{ask_size}|{}|{tape}",
        observed_at.to_rfc3339(),
        conditions.join(",")
    );
    Ok(NormalizedEvent::Quote(MarketQuoteEvent {
        envelope: Some(envelope("market.quote.v1", &identity, observed_at)),
        symbol,
        asset_class: feed.asset_class() as i32,
        observed_at: Some(to_timestamp(observed_at)),
        bid_price,
        ask_price,
        bid_size,
        ask_size,
        conditions,
        tape,
        provider_sequence: unsigned_or_zero(value, "i")?,
    }))
}

pub async fn run(
    config: AlpacaConfig,
    tx: mpsc::Sender<NormalizedEvent>,
    health: Arc<ServiceHealth>,
    metrics: Metrics,
    shutdown: watch::Receiver<bool>,
) -> Result<(), ProviderError> {
    if !config.enabled {
        health.set_upstream_required(false);
        return Ok(());
    }

    let equities = config
        .symbols
        .iter()
        .filter(|symbol| !symbol.contains('/'))
        .cloned()
        .collect::<Vec<_>>();
    let crypto = config
        .symbols
        .iter()
        .filter(|symbol| symbol.contains('/'))
        .cloned()
        .collect::<Vec<_>>();
    let key = config.api_key.ok_or(ProviderError::Missing("api key"))?;
    let secret = config
        .secret_key
        .ok_or(ProviderError::Missing("secret key"))?;

    let mut tasks = Vec::new();
    if !equities.is_empty() {
        tasks.push(tokio::spawn(run_feed(
            config.stock_ws_url,
            FeedKind::Equity,
            equities,
            key.clone(),
            secret.clone(),
            tx.clone(),
            health.clone(),
            metrics.clone(),
            shutdown.clone(),
        )));
    }
    if !crypto.is_empty() {
        tasks.push(tokio::spawn(run_feed(
            config.crypto_ws_url,
            FeedKind::Crypto,
            crypto,
            key,
            secret,
            tx,
            health,
            metrics,
            shutdown,
        )));
    }

    for task in tasks {
        task.await
            .map_err(|error| ProviderError::Connection(error.to_string()))??;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn run_feed(
    url: String,
    feed: FeedKind,
    symbols: Vec<String>,
    key: String,
    secret: String,
    tx: mpsc::Sender<NormalizedEvent>,
    health: Arc<ServiceHealth>,
    metrics: Metrics,
    mut shutdown: watch::Receiver<bool>,
) -> Result<(), ProviderError> {
    let mut attempt = 0_u32;
    loop {
        if *shutdown.borrow() {
            return Ok(());
        }
        match connect_and_consume(
            &url,
            feed,
            &symbols,
            &key,
            &secret,
            &tx,
            &health,
            &mut shutdown,
        )
        .await
        {
            Ok(()) if *shutdown.borrow() => return Ok(()),
            Ok(()) => warn!(?feed, "upstream disconnected"),
            Err(error) => warn!(?feed, %error, "upstream feed failed"),
        }
        health.set_upstream_connected(false);
        metrics.upstream_reconnects.inc();
        attempt = attempt.saturating_add(1).min(6);
        let base_ms = 250_u64.saturating_mul(1_u64 << attempt);
        let jitter_ms = rand::rng().random_range(0..=base_ms / 2);
        tokio::select! {
            _ = time::sleep(Duration::from_millis((base_ms + jitter_ms).min(30_000))) => {},
            changed = shutdown.changed() => {
                if changed.is_err() || *shutdown.borrow() { return Ok(()); }
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn connect_and_consume(
    url: &str,
    feed: FeedKind,
    symbols: &[String],
    key: &str,
    secret: &str,
    tx: &mpsc::Sender<NormalizedEvent>,
    health: &ServiceHealth,
    shutdown: &mut watch::Receiver<bool>,
) -> Result<(), ProviderError> {
    let (mut socket, _) = connect_async(url)
        .await
        .map_err(|error| ProviderError::Connection(error.to_string()))?;
    socket
        .send(Message::Text(
            serde_json::json!({"action":"auth","key":key,"secret":secret})
                .to_string()
                .into(),
        ))
        .await
        .map_err(|error| ProviderError::Connection(error.to_string()))?;
    socket
        .send(Message::Text(
            serde_json::json!({"action":"subscribe","bars":symbols,"quotes":symbols})
                .to_string()
                .into(),
        ))
        .await
        .map_err(|error| ProviderError::Connection(error.to_string()))?;
    health.set_upstream_connected(true);
    info!(?feed, symbols = symbols.len(), "upstream connected");

    loop {
        tokio::select! {
            changed = shutdown.changed() => {
                if changed.is_err() || *shutdown.borrow() {
                    let _ = socket.close(None).await;
                    return Ok(());
                }
            }
            incoming = socket.next() => match incoming {
                Some(Ok(Message::Text(payload))) => {
                    for event in parse_message(&payload, feed)? {
                        tx.send(event).await.map_err(|_| ProviderError::Connection("ingestion pipeline closed".into()))?;
                    }
                    health.record_upstream_event();
                }
                Some(Ok(Message::Ping(payload))) => {
                    socket.send(Message::Pong(payload)).await.map_err(|error| ProviderError::Connection(error.to_string()))?;
                }
                Some(Ok(Message::Close(_))) | None => return Ok(()),
                Some(Err(error)) => return Err(ProviderError::Connection(error.to_string())),
                _ => {}
            }
        }
    }
}

pub fn normalize_symbol(value: &str) -> Result<String, ProviderError> {
    let symbol = value.trim().to_ascii_uppercase();
    if symbol.is_empty()
        || symbol.len() > 20
        || symbol.chars().filter(|character| *character == '/').count() > 1
        || !symbol.split('/').all(valid_symbol_part)
    {
        return Err(ProviderError::Symbol(value.into()));
    }
    Ok(symbol)
}

fn valid_symbol_part(part: &str) -> bool {
    let mut previous_was_separator = true;
    for character in part.chars() {
        if character.is_ascii_alphanumeric() {
            previous_was_separator = false;
        } else if ".-".contains(character) && !previous_was_separator {
            previous_was_separator = true;
        } else {
            return false;
        }
    }
    !previous_was_separator
}

fn text<'a>(value: &'a Value, key: &'static str) -> Result<&'a str, ProviderError> {
    value
        .get(key)
        .and_then(Value::as_str)
        .ok_or(ProviderError::Missing(key))
}

fn decimal(value: &Value, key: &'static str) -> Result<String, ProviderError> {
    match value.get(key) {
        Some(Value::Number(value)) => Ok(value.to_string()),
        Some(Value::String(value)) if !value.is_empty() => Ok(value.clone()),
        Some(_) => Err(ProviderError::Invalid(key)),
        None => Err(ProviderError::Missing(key)),
    }
}

fn decimal_or_empty(value: &Value, key: &'static str) -> Result<String, ProviderError> {
    if value.get(key).is_none() {
        Ok(String::new())
    } else {
        decimal(value, key)
    }
}

fn unsigned_or_zero(value: &Value, key: &'static str) -> Result<u64, ProviderError> {
    value
        .get(key)
        .map(|value| value.as_u64().ok_or(ProviderError::Invalid(key)))
        .transpose()
        .map(Option::unwrap_or_default)
}

fn parse_time(value: &str) -> Result<DateTime<Utc>, ProviderError> {
    value
        .parse::<DateTime<Utc>>()
        .map_err(|_| ProviderError::Invalid("timestamp"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_symbols() {
        assert!(normalize_symbol("AAPL;DROP").is_err());
        assert_eq!(normalize_symbol(" btc/usd ").unwrap(), "BTC/USD");
    }

    #[test]
    fn ignores_control_frames_but_rejects_invalid_recognized_events() {
        assert!(
            parse_message(
                r#"[{"T":"success","msg":"authenticated"}]"#,
                FeedKind::Equity
            )
            .unwrap()
            .is_empty()
        );
        let invalid_number =
            r#"[{"T":"q","S":"AAPL","t":"2026-08-05T12:00:00Z","bp":{},"ap":2,"bs":1,"as":1}]"#;
        assert!(matches!(
            parse_message(invalid_number, FeedKind::Equity),
            Err(ProviderError::Invalid("bp"))
        ));
    }

    #[test]
    fn rejects_repeated_separators_and_overlong_symbols() {
        for symbol in ["BTC//USD", "AAPL.", "AAPL/BTC/USD", "ABCDEFGHIJKLMNOPQRSTU"] {
            assert!(normalize_symbol(symbol).is_err(), "accepted {symbol}");
        }
    }
}
