use std::{env, fs};

use indus_market_data::{
    config::KafkaConfig,
    kafka::{EventPublisher, KafkaPublisher},
    provider::{FeedKind, parse_message},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = env::args().skip(1);
    let path = arguments
        .next()
        .ok_or("usage: replay <fixture.json> <equity|crypto>")?;
    let feed = match arguments.next().as_deref() {
        Some("equity") => FeedKind::Equity,
        Some("crypto") => FeedKind::Crypto,
        _ => return Err("usage: replay <fixture.json> <equity|crypto>".into()),
    };
    if arguments.next().is_some() {
        return Err("usage: replay <fixture.json> <equity|crypto>".into());
    }
    let payload = fs::read_to_string(path)?;
    let events = parse_message(&payload, feed)?;
    let publisher = KafkaPublisher::new(&KafkaConfig::from_env()?)?;
    publisher.publish(&events).await?;
    println!("replayed {} normalized events", events.len());
    Ok(())
}
