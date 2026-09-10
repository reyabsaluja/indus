use prometheus::{Encoder, IntCounter, IntGauge, Opts, Registry, TextEncoder};
use thiserror::Error;

#[derive(Clone, Debug)]
pub struct Metrics {
    registry: Registry,
    pub ingested: IntCounter,
    pub published: IntCounter,
    pub persisted: IntCounter,
    pub duplicates: IntCounter,
    pub rejected: IntCounter,
    pub active_streams: IntGauge,
    pub stream_lagged_events: IntCounter,
    pub upstream_reconnects: IntCounter,
}

#[derive(Debug, Error)]
pub enum MetricsError {
    #[error("metric registration failed: {0}")]
    Registration(#[from] prometheus::Error),
    #[error("metric encoding failed: {0}")]
    Encoding(#[from] std::io::Error),
    #[error("metric output was not UTF-8")]
    Utf8(#[from] std::string::FromUtf8Error),
}

impl Metrics {
    pub fn new() -> Result<Self, MetricsError> {
        let registry = Registry::new();
        let ingested = counter("market_ingested_events_total", "Normalized provider events")?;
        let published = counter("market_published_events_total", "Kafka-acknowledged events")?;
        let persisted = counter(
            "market_persisted_events_total",
            "PostgreSQL-persisted events",
        )?;
        let duplicates = counter(
            "market_duplicate_events_total",
            "Idempotently ignored events",
        )?;
        let rejected = counter("market_rejected_events_total", "Explicitly rejected events")?;
        let active_streams = IntGauge::with_opts(Opts::new(
            "market_active_streams",
            "Currently authenticated SSE streams",
        ))?;
        let stream_lagged_events = counter(
            "market_stream_lagged_events_total",
            "Events explicitly reported as skipped to slow SSE consumers",
        )?;
        let upstream_reconnects = counter(
            "market_upstream_reconnects_total",
            "Alpaca reconnect attempts",
        )?;
        registry.register(Box::new(ingested.clone()))?;
        registry.register(Box::new(published.clone()))?;
        registry.register(Box::new(persisted.clone()))?;
        registry.register(Box::new(duplicates.clone()))?;
        registry.register(Box::new(rejected.clone()))?;
        registry.register(Box::new(active_streams.clone()))?;
        registry.register(Box::new(stream_lagged_events.clone()))?;
        registry.register(Box::new(upstream_reconnects.clone()))?;
        Ok(Self {
            registry,
            ingested,
            published,
            persisted,
            duplicates,
            rejected,
            active_streams,
            stream_lagged_events,
            upstream_reconnects,
        })
    }

    pub fn encode(&self) -> Result<String, MetricsError> {
        let mut output = Vec::new();
        TextEncoder::new().encode(&self.registry.gather(), &mut output)?;
        Ok(String::from_utf8(output)?)
    }
}

fn counter(name: &str, help: &str) -> Result<IntCounter, prometheus::Error> {
    IntCounter::with_opts(Opts::new(name, help))
}
