use indus_market_data::{
    event::NormalizedEvent,
    provider::{FeedKind, parse_message},
};

#[test]
fn captured_equity_payload_normalizes_and_replays_deterministically() {
    let fixture = include_str!("fixtures/alpaca_equity.json");
    let first = parse_message(fixture, FeedKind::Equity).unwrap();
    let replay = parse_message(fixture, FeedKind::Equity).unwrap();
    assert_eq!(first.len(), 2);
    assert_eq!(
        first[0].envelope().unwrap().event_id,
        replay[0].envelope().unwrap().event_id
    );
    assert!(matches!(first[0], NormalizedEvent::Bar(_)));
    assert!(matches!(first[1], NormalizedEvent::Quote(_)));
}

#[test]
fn captured_crypto_payload_preserves_fractional_sizes_and_slash_symbol() {
    let events = parse_message(
        include_str!("fixtures/alpaca_crypto.json"),
        FeedKind::Crypto,
    )
    .unwrap();
    assert_eq!(events[0].symbol(), "BTC/USD");
    let NormalizedEvent::Quote(quote) = &events[1] else {
        panic!("expected quote")
    };
    assert_eq!(quote.bid_size, "0.142");
    assert_eq!(quote.ask_size, "0.201");
}

#[test]
fn malformed_market_event_is_rejected_without_dropping_the_batch_silently() {
    let payload = r#"[{"T":"b","S":"AAPL","t":"bad"}]"#;
    assert!(parse_message(payload, FeedKind::Equity).is_err());
}
