use async_trait::async_trait;
use sqlx::{PgPool, postgres::PgPoolOptions};
use thiserror::Error;
use uuid::Uuid;

use crate::{
    event::{AssetClass, EventError, NormalizedEvent, timestamp},
    kafka::KafkaRecord,
};

#[derive(Clone)]
pub struct PostgresStore {
    pool: PgPool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PersistOutcome {
    Stored,
    Duplicate,
    Rejected,
}

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("database operation failed: {0}")]
    Database(#[from] sqlx::Error),
    #[error("database migration failed: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("event is invalid: {0}")]
    Event(#[from] EventError),
    #[error("event ID is invalid")]
    EventId,
}

#[async_trait]
pub trait EventStore: Send + Sync {
    async fn persist(&self, record: &KafkaRecord) -> Result<PersistOutcome, StoreError>;
}

impl PostgresStore {
    pub async fn connect(database_url: &str) -> Result<Self, StoreError> {
        let pool = PgPoolOptions::new()
            .min_connections(1)
            .max_connections(10)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect(database_url)
            .await?;
        sqlx::migrate!().run(&pool).await?;
        Ok(Self { pool })
    }

    pub async fn ping(&self) -> Result<(), StoreError> {
        sqlx::query("SELECT 1").execute(&self.pool).await?;
        Ok(())
    }

    pub async fn has_consumed_event(&self, event_id: Uuid) -> Result<bool, StoreError> {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM market_data.consumed_events WHERE event_id = $1)",
        )
        .bind(event_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(exists)
    }

    pub async fn run_retention(&self, retention_days: u32) -> Result<(), StoreError> {
        sqlx::query("SELECT market_data.ensure_monthly_partitions(2)")
            .execute(&self.pool)
            .await?;
        sqlx::query("SELECT market_data.apply_retention($1)")
            .bind(i32::try_from(retention_days).unwrap_or(i32::MAX))
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn record_feed_measurement(
        &self,
        connected: bool,
        last_event_epoch: Option<i64>,
    ) -> Result<(), StoreError> {
        sqlx::query(
            "INSERT INTO market_data.feed_measurements (measured_at, connected, last_event_at) \
             VALUES (clock_timestamp(), $1, to_timestamp($2))",
        )
        .bind(connected)
        .bind(last_event_epoch.map(|value| value as f64))
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn reject(
        &self,
        record: &KafkaRecord,
        reason: &str,
    ) -> Result<PersistOutcome, StoreError> {
        sqlx::query(
            "INSERT INTO market_data.rejected_events \
             (event_id, topic, partition_id, offset_id, reason, payload) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (topic, partition_id, offset_id) DO NOTHING",
        )
        .bind(record.event_id.as_deref())
        .bind(&record.topic)
        .bind(record.partition)
        .bind(record.offset)
        .bind(reason)
        .bind(&record.payload)
        .execute(&self.pool)
        .await?;
        Ok(PersistOutcome::Rejected)
    }
}

#[async_trait]
impl EventStore for PostgresStore {
    async fn persist(&self, record: &KafkaRecord) -> Result<PersistOutcome, StoreError> {
        let event = match NormalizedEvent::decode(&record.topic, &record.payload) {
            Ok(event) => event,
            Err(error) => return self.reject(record, &error.to_string()).await,
        };
        let envelope = event.envelope()?;
        let event_id = match Uuid::parse_str(&envelope.event_id) {
            Ok(event_id) => event_id,
            Err(_) => return self.reject(record, &StoreError::EventId.to_string()).await,
        };
        let occurred_at = match timestamp(envelope.occurred_at.as_ref(), "occurred_at") {
            Ok(occurred_at) => occurred_at,
            Err(error) => return self.reject(record, &error.to_string()).await,
        };
        let market_timestamp = match &event {
            NormalizedEvent::Bar(event) => timestamp(event.window_start.as_ref(), "window_start")
                .and_then(|_| timestamp(event.window_end.as_ref(), "window_end")),
            NormalizedEvent::Quote(event) => timestamp(event.observed_at.as_ref(), "observed_at"),
        };
        if let Err(error) = market_timestamp {
            return self.reject(record, &error.to_string()).await;
        }
        let mut transaction = self.pool.begin().await?;
        let inserted = sqlx::query(
            "INSERT INTO market_data.consumed_events \
             (event_id, topic, partition_id, offset_id, occurred_at) \
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (event_id) DO NOTHING",
        )
        .bind(event_id)
        .bind(&record.topic)
        .bind(record.partition)
        .bind(record.offset)
        .bind(occurred_at)
        .execute(&mut *transaction)
        .await?;
        if inserted.rows_affected() == 0 {
            transaction.commit().await?;
            return Ok(PersistOutcome::Duplicate);
        }

        match event {
            NormalizedEvent::Bar(event) => {
                sqlx::query(
                    "INSERT INTO market_data.bars \
                     (event_id, symbol, asset_class, interval_name, window_start, window_end, \
                      open_price, high_price, low_price, close_price, volume, trade_count, \
                      volume_weighted_price, provider_sequence, occurred_at) \
                     VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8::numeric,$9::numeric,$10::numeric, \
                             $11::numeric,$12,NULLIF($13,'')::numeric,$14,$15)",
                )
                .bind(event_id)
                .bind(event.symbol)
                .bind(asset_name(event.asset_class))
                .bind(event.interval)
                .bind(timestamp(event.window_start.as_ref(), "window_start")?)
                .bind(timestamp(event.window_end.as_ref(), "window_end")?)
                .bind(event.open)
                .bind(event.high)
                .bind(event.low)
                .bind(event.close)
                .bind(event.volume)
                .bind(i64::try_from(event.trade_count).unwrap_or(i64::MAX))
                .bind(event.volume_weighted_price)
                .bind(i64::try_from(event.provider_sequence).unwrap_or(i64::MAX))
                .bind(occurred_at)
                .execute(&mut *transaction)
                .await?;
            }
            NormalizedEvent::Quote(event) => {
                sqlx::query(
                    "INSERT INTO market_data.quotes \
                     (event_id, symbol, asset_class, observed_at, bid_price, ask_price, bid_size, \
                      ask_size, conditions, tape, provider_sequence, occurred_at) \
                     VALUES ($1,$2,$3,$4,$5::numeric,$6::numeric,$7::numeric,$8::numeric,$9,$10,$11,$12)",
                )
                .bind(event_id)
                .bind(event.symbol)
                .bind(asset_name(event.asset_class))
                .bind(timestamp(event.observed_at.as_ref(), "observed_at")?)
                .bind(event.bid_price)
                .bind(event.ask_price)
                .bind(event.bid_size)
                .bind(event.ask_size)
                .bind(event.conditions)
                .bind(event.tape)
                .bind(i64::try_from(event.provider_sequence).unwrap_or(i64::MAX))
                .bind(occurred_at)
                .execute(&mut *transaction)
                .await?;
            }
        }
        transaction.commit().await?;
        Ok(PersistOutcome::Stored)
    }
}

fn asset_name(value: i32) -> &'static str {
    match AssetClass::try_from(value).unwrap_or(AssetClass::Unspecified) {
        AssetClass::Equity => "equity",
        AssetClass::Crypto => "crypto",
        AssetClass::Unspecified => "unspecified",
    }
}
