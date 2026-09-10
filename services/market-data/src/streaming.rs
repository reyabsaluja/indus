use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use thiserror::Error;
use tokio::sync::broadcast;

use crate::{event::LiveEvent, metrics::Metrics};

#[derive(Debug)]
pub struct StreamHub {
    feeds: Mutex<HashMap<String, SymbolFeed>>,
    broadcast_capacity: usize,
    replay_capacity: usize,
    stale_after: Duration,
}

#[derive(Debug)]
struct SymbolFeed {
    sender: broadcast::Sender<LiveEvent>,
    replay: VecDeque<LiveEvent>,
    last_received: Option<Instant>,
}

pub struct Subscription {
    pub replay: Vec<LiveEvent>,
    pub receiver: broadcast::Receiver<LiveEvent>,
    pub replay_gap: bool,
}

impl StreamHub {
    pub fn new(broadcast_capacity: usize, replay_capacity: usize, stale_after: Duration) -> Self {
        Self {
            feeds: Mutex::new(HashMap::new()),
            broadcast_capacity: broadcast_capacity.max(1),
            replay_capacity,
            stale_after,
        }
    }

    pub fn publish(&self, event: LiveEvent) {
        let mut feeds = self.feeds.lock().expect("stream hub lock poisoned");
        let feed = feeds.entry(event.symbol.clone()).or_insert_with(|| {
            let (sender, _) = broadcast::channel(self.broadcast_capacity);
            SymbolFeed {
                sender,
                replay: VecDeque::new(),
                last_received: None,
            }
        });
        feed.last_received = Some(Instant::now());
        feed.replay.push_back(event.clone());
        while feed.replay.len() > self.replay_capacity {
            feed.replay.pop_front();
        }
        let _ = feed.sender.send(event);
    }

    pub fn subscribe(&self, symbol: &str, last_event_id: Option<&str>) -> Subscription {
        let mut feeds = self.feeds.lock().expect("stream hub lock poisoned");
        let feed = feeds.entry(symbol.to_owned()).or_insert_with(|| {
            let (sender, _) = broadcast::channel(self.broadcast_capacity);
            SymbolFeed {
                sender,
                replay: VecDeque::new(),
                last_received: None,
            }
        });
        let receiver = feed.sender.subscribe();
        let (replay, replay_gap) = match last_event_id {
            Some(id) => match feed.replay.iter().position(|event| event.id == id) {
                Some(position) => (
                    feed.replay.iter().skip(position + 1).cloned().collect(),
                    false,
                ),
                None => (
                    feed.replay.iter().cloned().collect(),
                    !feed.replay.is_empty(),
                ),
            },
            None => (Vec::new(), false),
        };
        Subscription {
            replay,
            receiver,
            replay_gap,
        }
    }

    pub fn is_stale(&self, symbol: &str) -> bool {
        self.feeds
            .lock()
            .expect("stream hub lock poisoned")
            .get(symbol)
            .and_then(|feed| feed.last_received)
            .is_none_or(|last| last.elapsed() > self.stale_after)
    }
}

#[derive(Debug)]
pub struct StreamLimits {
    state: Mutex<LimitState>,
    max_per_user: usize,
    max_global: usize,
    metrics: Metrics,
}

#[derive(Debug, Default)]
struct LimitState {
    total: usize,
    users: HashMap<String, usize>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum LimitError {
    #[error("per-user stream quota exceeded")]
    UserQuota,
    #[error("service stream capacity exceeded")]
    GlobalQuota,
}

pub struct StreamLease {
    user_id: String,
    limits: Arc<StreamLimits>,
}

impl StreamLimits {
    pub fn new(max_per_user: usize, max_global: usize, metrics: Metrics) -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(LimitState::default()),
            max_per_user,
            max_global,
            metrics,
        })
    }

    pub fn acquire(self: &Arc<Self>, user_id: &str) -> Result<StreamLease, LimitError> {
        let mut state = self.state.lock().expect("stream limit lock poisoned");
        if state.total >= self.max_global {
            return Err(LimitError::GlobalQuota);
        }
        if state.users.get(user_id).copied().unwrap_or_default() >= self.max_per_user {
            return Err(LimitError::UserQuota);
        }
        state.total += 1;
        *state.users.entry(user_id.to_owned()).or_default() += 1;
        self.metrics.active_streams.inc();
        Ok(StreamLease {
            user_id: user_id.to_owned(),
            limits: self.clone(),
        })
    }

    #[cfg(test)]
    fn active(&self) -> usize {
        self.state.lock().unwrap().total
    }
}

impl Drop for StreamLease {
    fn drop(&mut self) {
        let mut state = self
            .limits
            .state
            .lock()
            .expect("stream limit lock poisoned");
        state.total = state.total.saturating_sub(1);
        if let Some(count) = state.users.get_mut(&self.user_id) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                state.users.remove(&self.user_id);
            }
        }
        self.limits.metrics.active_streams.dec();
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;

    use super::*;

    fn metrics() -> Metrics {
        Metrics::new().unwrap()
    }

    #[test]
    fn enforces_load_boundary_and_releases_disconnects() {
        let limits = StreamLimits::new(2, 2, metrics());
        let first = limits.acquire("user-1").unwrap();
        let second = limits.acquire("user-1").unwrap();
        assert_eq!(
            limits.acquire("user-1").err(),
            Some(LimitError::GlobalQuota)
        );
        assert_eq!(limits.active(), 2);
        drop(first);
        assert_eq!(limits.active(), 1);
        drop(second);
        assert_eq!(limits.active(), 0);
    }

    #[test]
    fn distinguishes_per_user_quota_from_global_capacity() {
        let limits = StreamLimits::new(1, 2, metrics());
        let first = limits.acquire("user-1").unwrap();
        assert_eq!(limits.acquire("user-1").err(), Some(LimitError::UserQuota));
        let second = limits.acquire("user-2").unwrap();
        assert_eq!(
            limits.acquire("user-3").err(),
            Some(LimitError::GlobalQuota)
        );
        drop((first, second));
        assert_eq!(limits.active(), 0);
    }

    #[test]
    fn reconnect_replays_after_last_event_and_reports_evicted_cursor() {
        let hub = StreamHub::new(4, 2, Duration::from_secs(30));
        for id in ["1", "2", "3"] {
            hub.publish(LiveEvent {
                id: id.into(),
                event_type: "quote",
                symbol: "AAPL".into(),
                observed_at: Utc::now(),
                payload: serde_json::json!({}),
            });
        }
        let current = hub.subscribe("AAPL", Some("2"));
        assert_eq!(
            current
                .replay
                .iter()
                .map(|event| &event.id)
                .collect::<Vec<_>>(),
            [&"3"]
        );
        assert!(!current.replay_gap);
        let evicted = hub.subscribe("AAPL", Some("1"));
        assert_eq!(evicted.replay.len(), 2);
        assert!(evicted.replay_gap);
    }

    #[test]
    fn feed_without_events_is_stale() {
        let hub = StreamHub::new(1, 1, Duration::ZERO);
        let _subscription = hub.subscribe("AAPL", None);
        assert!(hub.is_stale("AAPL"));
    }

    #[tokio::test]
    async fn bounded_channel_reports_slow_consumer_lag() {
        let hub = StreamHub::new(1, 1, Duration::from_secs(30));
        let mut subscription = hub.subscribe("AAPL", None);
        for id in ["1", "2", "3"] {
            hub.publish(LiveEvent {
                id: id.into(),
                event_type: "quote",
                symbol: "AAPL".into(),
                observed_at: Utc::now(),
                payload: serde_json::json!({}),
            });
        }
        assert!(matches!(
            subscription.receiver.recv().await,
            Err(broadcast::error::RecvError::Lagged(_))
        ));
    }
}
