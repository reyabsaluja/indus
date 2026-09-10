use indus_market_data::{
    event::NormalizedEvent,
    kafka::KafkaRecord,
    persistence::{EventStore, PersistOutcome, PostgresStore},
    provider::{FeedKind, parse_message},
};

#[tokio::test]
async fn duplicate_reordered_and_unsupported_events_are_explicit() {
    let Ok(database_url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("skipping PostgreSQL integration test: TEST_DATABASE_URL is unset");
        return;
    };
    let store = PostgresStore::connect(&database_url).await.unwrap();
    let mut events = parse_message(
        include_str!("fixtures/alpaca_equity.json"),
        FeedKind::Equity,
    )
    .unwrap();
    events.reverse();
    for (offset, event) in events.iter().enumerate() {
        let record = record(event, offset as i64);
        assert_eq!(
            store.persist(&record).await.unwrap(),
            PersistOutcome::Stored
        );
    }
    let duplicate = record(&events[0], 50);
    assert_eq!(
        store.persist(&duplicate).await.unwrap(),
        PersistOutcome::Duplicate
    );

    let mut unsupported = events[1].clone();
    match &mut unsupported {
        NormalizedEvent::Bar(event) => event.envelope.as_mut().unwrap().schema_version = 999,
        NormalizedEvent::Quote(event) => event.envelope.as_mut().unwrap().schema_version = 999,
    }
    let rejected = record(&unsupported, 51);
    assert_eq!(
        store.persist(&rejected).await.unwrap(),
        PersistOutcome::Rejected
    );

    let mut invalid_id = events[0].clone();
    invalid_id.envelope_mut().event_id = "not-a-uuid".into();
    assert_eq!(
        store.persist(&record(&invalid_id, 52)).await.unwrap(),
        PersistOutcome::Rejected
    );

    let mut missing_timestamp = events[1].clone();
    missing_timestamp.envelope_mut().occurred_at = None;
    assert_eq!(
        store
            .persist(&record(&missing_timestamp, 53))
            .await
            .unwrap(),
        PersistOutcome::Rejected
    );
}

trait EnvelopeMut {
    fn envelope_mut(&mut self) -> &mut indus_market_data::event::EventEnvelope;
}

impl EnvelopeMut for NormalizedEvent {
    fn envelope_mut(&mut self) -> &mut indus_market_data::event::EventEnvelope {
        match self {
            NormalizedEvent::Bar(event) => event.envelope.as_mut().unwrap(),
            NormalizedEvent::Quote(event) => event.envelope.as_mut().unwrap(),
        }
    }
}

fn record(event: &NormalizedEvent, offset: i64) -> KafkaRecord {
    KafkaRecord {
        topic: event.topic().into(),
        payload: event.encode(),
        event_id: Some(event.envelope().unwrap().event_id.clone()),
        // Cargo executes integration-test binaries concurrently. Keep this
        // synthetic database fixture disjoint from the live Kafka test,
        // which consumes the broker-assigned partition zero.
        partition: 32_767,
        offset,
    }
}
