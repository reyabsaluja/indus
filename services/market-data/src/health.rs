use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};

use chrono::Utc;
use serde::Serialize;

#[derive(Debug, Default)]
pub struct ServiceHealth {
    database_ready: AtomicBool,
    kafka_ready: AtomicBool,
    upstream_required: AtomicBool,
    upstream_connected: AtomicBool,
    last_upstream_event: AtomicI64,
    shutting_down: AtomicBool,
}

#[derive(Debug, Serialize)]
pub struct Readiness {
    pub ready: bool,
    pub database: &'static str,
    pub kafka: &'static str,
    pub upstream: &'static str,
}

impl ServiceHealth {
    pub fn set_database_ready(&self, value: bool) {
        self.database_ready.store(value, Ordering::Relaxed);
    }

    pub fn set_kafka_ready(&self, value: bool) {
        self.kafka_ready.store(value, Ordering::Relaxed);
    }

    pub fn set_upstream_required(&self, value: bool) {
        self.upstream_required.store(value, Ordering::Relaxed);
    }

    pub fn set_upstream_connected(&self, value: bool) {
        self.upstream_connected.store(value, Ordering::Relaxed);
    }

    pub fn record_upstream_event(&self) {
        self.last_upstream_event
            .store(Utc::now().timestamp(), Ordering::Relaxed);
    }

    pub fn mark_shutting_down(&self) {
        self.shutting_down.store(true, Ordering::Relaxed);
    }

    pub fn is_live(&self) -> bool {
        !self.shutting_down.load(Ordering::Relaxed)
    }

    pub fn readiness(&self) -> Readiness {
        let database = self.database_ready.load(Ordering::Relaxed);
        let kafka = self.kafka_ready.load(Ordering::Relaxed);
        let required = self.upstream_required.load(Ordering::Relaxed);
        let upstream = self.upstream_connected.load(Ordering::Relaxed);
        Readiness {
            ready: database && kafka && (!required || upstream) && self.is_live(),
            database: state(database),
            kafka: state(kafka),
            upstream: if !required {
                "disabled"
            } else {
                state(upstream)
            },
        }
    }

    pub fn last_upstream_event(&self) -> Option<i64> {
        match self.last_upstream_event.load(Ordering::Relaxed) {
            0 => None,
            value => Some(value),
        }
    }

    pub fn upstream_connected(&self) -> bool {
        self.upstream_connected.load(Ordering::Relaxed)
    }
}

fn state(value: bool) -> &'static str {
    if value { "ready" } else { "unavailable" }
}
