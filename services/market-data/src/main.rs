use std::{sync::Arc, time::Duration};

use indus_market_data::{
    auth::JwtAuthenticator,
    config::Config,
    health::ServiceHealth,
    http::{AppState, router},
    kafka::{EventPublisher, KafkaPublisher, run_consumer},
    metrics::Metrics,
    persistence::PostgresStore,
    provider,
    streaming::{StreamHub, StreamLimits},
};
use tokio::{
    signal,
    sync::{mpsc, watch},
    task::JoinSet,
    time,
};
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();
    let config = Config::from_env()?;
    let metrics = Metrics::new()?;
    let health = Arc::new(ServiceHealth::default());
    health.set_upstream_required(config.alpaca.enabled);

    let store = Arc::new(PostgresStore::connect(&config.database_url).await?);
    store.ping().await?;
    store.run_retention(config.retention_days).await?;
    health.set_database_ready(true);
    let publisher: Arc<dyn EventPublisher> = Arc::new(KafkaPublisher::new(&config.kafka)?);
    health.set_kafka_ready(true);
    let authenticator = Arc::new(JwtAuthenticator::new(&config.auth).await?);
    let hub = Arc::new(StreamHub::new(
        config.stream.buffer_capacity,
        config.stream.replay_capacity,
        config.stream.stale_after,
    ));
    let limits = StreamLimits::new(
        config.stream.max_per_user,
        config.stream.max_global,
        metrics.clone(),
    );
    let state = AppState {
        authenticator,
        hub: hub.clone(),
        limits,
        health: health.clone(),
        metrics: metrics.clone(),
        heartbeat: config.stream.heartbeat,
    };
    let app = router(state, &config.allowed_origins)?;
    let listener = tokio::net::TcpListener::bind(config.bind_addr).await?;

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let (event_tx, mut event_rx) = mpsc::channel(config.stream.buffer_capacity.max(1));
    let mut tasks = JoinSet::new();

    tasks.spawn(provider::run(
        config.alpaca.clone(),
        event_tx,
        health.clone(),
        metrics.clone(),
        shutdown_rx.clone(),
    ));
    let consumer_store = store.clone();
    let consumer_config = config.kafka.clone();
    let consumer_metrics = metrics.clone();
    let consumer_health = health.clone();
    let consumer_shutdown = shutdown_rx.clone();
    tasks.spawn(async move {
        let mut consumer_shutdown = consumer_shutdown;
        loop {
            match run_consumer(
                consumer_config.clone(),
                consumer_store.clone(),
                consumer_metrics.clone(),
                consumer_health.clone(),
                consumer_shutdown.clone(),
            )
            .await
            {
                Ok(()) if *consumer_shutdown.borrow() => return Ok(()),
                Ok(()) => warn!("Kafka consumer exited; restarting"),
                Err(error) => warn!(%error, "Kafka consumer failed; restarting without committing a later offset"),
            }
            consumer_health.set_kafka_ready(false);
            tokio::select! {
                _ = time::sleep(Duration::from_secs(1)) => {},
                changed = consumer_shutdown.changed() => {
                    if changed.is_err() || *consumer_shutdown.borrow() { return Ok(()); }
                }
            }
        }
    });

    let pipeline_hub = hub.clone();
    let pipeline_metrics = metrics.clone();
    let pipeline_publisher = publisher.clone();
    let mut pipeline_shutdown = shutdown_rx.clone();
    tasks.spawn(async move {
        loop {
            let first = tokio::select! {
                changed = pipeline_shutdown.changed() => {
                    if changed.is_err() || *pipeline_shutdown.borrow() { return Ok(()); }
                    continue;
                }
                event = event_rx.recv() => match event {
                    Some(event) => event,
                    None => return Ok(()),
                }
            };
            let mut batch = vec![first];
            let deadline = time::Instant::now() + Duration::from_millis(10);
            while batch.len() < 100 {
                match time::timeout_at(deadline, event_rx.recv()).await {
                    Ok(Some(event)) => batch.push(event),
                    _ => break,
                }
            }
            pipeline_metrics.ingested.inc_by(batch.len() as u64);
            loop {
                match pipeline_publisher.publish(&batch).await {
                    Ok(()) => break,
                    Err(error) => {
                        error!(%error, count = batch.len(), "publish failed; batch retained for retry");
                        tokio::select! {
                            _ = time::sleep(Duration::from_secs(1)) => {},
                            changed = pipeline_shutdown.changed() => {
                                if changed.is_err() || *pipeline_shutdown.borrow() {
                                    return Err(provider::ProviderError::Connection("shutdown before Kafka acknowledged retained batch".into()));
                                }
                            }
                        }
                    }
                }
            }
            pipeline_metrics.published.inc_by(batch.len() as u64);
            for event in batch {
                match event.live_event() {
                    Ok(event) => pipeline_hub.publish(event),
                    Err(error) => warn!(%error, "acknowledged event could not be fanned out"),
                }
            }
        }
    });

    let maintenance_store = store.clone();
    let maintenance_health = health.clone();
    let retention_days = config.retention_days;
    let mut maintenance_shutdown = shutdown_rx.clone();
    tasks.spawn(async move {
        let mut measurements = time::interval(Duration::from_secs(60));
        let mut retention = time::interval(Duration::from_secs(24 * 60 * 60));
        loop {
            tokio::select! {
                changed = maintenance_shutdown.changed() => {
                    if changed.is_err() || *maintenance_shutdown.borrow() { return Ok(()); }
                }
                _ = measurements.tick() => {
                    if let Err(error) = maintenance_store.record_feed_measurement(
                        maintenance_health.upstream_connected(),
                        maintenance_health.last_upstream_event(),
                    ).await {
                        warn!(%error, "feed measurement persistence failed");
                    }
                }
                _ = retention.tick() => {
                    if let Err(error) = maintenance_store.run_retention(retention_days).await {
                        warn!(%error, "retention maintenance failed");
                    }
                }
            }
        }
    });

    info!(address = %config.bind_addr, "market-data service ready");
    let server = axum::serve(listener, app).with_graceful_shutdown(shutdown_signal());
    let server_result = server.await;
    health.mark_shutting_down();
    let _ = shutdown_tx.send(true);
    health.set_database_ready(false);
    health.set_kafka_ready(false);
    while let Ok(Some(result)) = time::timeout(Duration::from_secs(10), tasks.join_next()).await {
        if let Err(error) = result {
            warn!(%error, "background task did not stop cleanly");
        }
    }
    server_result?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
