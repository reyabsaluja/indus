use std::{env, net::SocketAddr, str::FromStr, time::Duration};

use thiserror::Error;

#[derive(Clone, Debug)]
pub struct Config {
    pub bind_addr: SocketAddr,
    pub database_url: String,
    pub kafka: KafkaConfig,
    pub auth: AuthConfig,
    pub alpaca: AlpacaConfig,
    pub stream: StreamConfig,
    pub retention_days: u32,
    pub allowed_origins: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct KafkaConfig {
    pub bootstrap_servers: String,
    pub transactional_id: String,
    pub group_id: String,
    pub security_protocol: String,
    pub sasl_mechanism: Option<String>,
    pub sasl_username: Option<String>,
    pub sasl_password: Option<String>,
    pub ssl_ca_location: Option<String>,
    pub aws_region: Option<String>,
}

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub issuer: String,
    pub audience: String,
    pub jwks_url: Option<String>,
    pub hs256_secret: Option<String>,
}

#[derive(Clone, Debug)]
pub struct AlpacaConfig {
    pub enabled: bool,
    pub api_key: Option<String>,
    pub secret_key: Option<String>,
    pub stock_ws_url: String,
    pub crypto_ws_url: String,
    pub symbols: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct StreamConfig {
    pub stale_after: Duration,
    pub heartbeat: Duration,
    pub buffer_capacity: usize,
    pub replay_capacity: usize,
    pub max_per_user: usize,
    pub max_global: usize,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("missing required environment variable {0}")]
    Missing(&'static str),
    #[error("invalid {name}: {reason}")]
    Invalid { name: &'static str, reason: String },
    #[error("exactly one of MARKET_JWKS_URL or MARKET_JWT_HS256_SECRET must be configured")]
    AuthMode,
    #[error("ALPACA_API_KEY and ALPACA_SECRET_KEY are required when ingestion is enabled")]
    AlpacaCredentials,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let jwks_url = optional("MARKET_JWKS_URL");
        let hs256_secret = optional("MARKET_JWT_HS256_SECRET");
        if jwks_url.is_some() == hs256_secret.is_some() {
            return Err(ConfigError::AuthMode);
        }

        let enabled = parse("MARKET_INGESTION_ENABLED", true)?;
        let api_key = optional("ALPACA_API_KEY");
        let secret_key = optional("ALPACA_SECRET_KEY");
        if enabled && (api_key.is_none() || secret_key.is_none()) {
            return Err(ConfigError::AlpacaCredentials);
        }

        let symbols = env::var("MARKET_SYMBOLS")
            .unwrap_or_else(|_| "AAPL,BTC/USD".into())
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .collect::<Vec<_>>();
        if enabled && symbols.is_empty() {
            return Err(ConfigError::Invalid {
                name: "MARKET_SYMBOLS",
                reason: "at least one symbol is required".into(),
            });
        }

        Ok(Self {
            bind_addr: parse_with_default("MARKET_BIND_ADDR", "0.0.0.0:8081")?,
            database_url: required("DATABASE_URL")?,
            kafka: KafkaConfig::from_env()?,
            auth: AuthConfig {
                issuer: required("MARKET_JWT_ISSUER")?,
                audience: required("MARKET_JWT_AUDIENCE")?,
                jwks_url,
                hs256_secret,
            },
            alpaca: AlpacaConfig {
                enabled,
                api_key,
                secret_key,
                stock_ws_url: env::var("ALPACA_STOCK_WS_URL")
                    .unwrap_or_else(|_| "wss://stream.data.alpaca.markets/v2/iex".into()),
                crypto_ws_url: env::var("ALPACA_CRYPTO_WS_URL").unwrap_or_else(|_| {
                    "wss://stream.data.alpaca.markets/v1beta3/crypto/us".into()
                }),
                symbols,
            },
            stream: StreamConfig {
                stale_after: Duration::from_secs(parse("MARKET_STALE_AFTER_SECONDS", 30)?),
                heartbeat: Duration::from_secs(parse("MARKET_HEARTBEAT_SECONDS", 15)?),
                buffer_capacity: parse("MARKET_STREAM_BUFFER", 256)?,
                replay_capacity: parse("MARKET_REPLAY_BUFFER", 512)?,
                max_per_user: parse("MARKET_MAX_STREAMS_PER_USER", 5)?,
                max_global: parse("MARKET_MAX_STREAMS_GLOBAL", 2_000)?,
            },
            retention_days: parse("MARKET_RETENTION_DAYS", 90)?,
            allowed_origins: env::var("MARKET_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://127.0.0.1:14173".into())
                .split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
                .collect(),
        })
    }
}

impl KafkaConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(Self {
            bootstrap_servers: required("KAFKA_BOOTSTRAP_SERVERS")?,
            transactional_id: env::var("KAFKA_TRANSACTIONAL_ID")
                .unwrap_or_else(|_| "indus-market-data-producer".into()),
            group_id: env::var("KAFKA_GROUP_ID")
                .unwrap_or_else(|_| "indus-market-data-writer-v1".into()),
            security_protocol: env::var("KAFKA_SECURITY_PROTOCOL")
                .unwrap_or_else(|_| "PLAINTEXT".into()),
            sasl_mechanism: optional("KAFKA_SASL_MECHANISM"),
            sasl_username: optional("KAFKA_SASL_USERNAME"),
            sasl_password: optional("KAFKA_SASL_PASSWORD"),
            ssl_ca_location: optional("KAFKA_SSL_CA_LOCATION"),
            aws_region: optional("AWS_REGION"),
        })
    }
}

fn required(name: &'static str) -> Result<String, ConfigError> {
    optional(name).ok_or(ConfigError::Missing(name))
}

fn optional(name: &'static str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn parse<T>(name: &'static str, default: T) -> Result<T, ConfigError>
where
    T: FromStr,
    T::Err: std::fmt::Display,
{
    match env::var(name) {
        Ok(value) => value.parse().map_err(|error: T::Err| ConfigError::Invalid {
            name,
            reason: error.to_string(),
        }),
        Err(_) => Ok(default),
    }
}

fn parse_with_default<T>(name: &'static str, default: &str) -> Result<T, ConfigError>
where
    T: FromStr,
    T::Err: std::fmt::Display,
{
    env::var(name)
        .unwrap_or_else(|_| default.to_owned())
        .parse()
        .map_err(|error: T::Err| ConfigError::Invalid {
            name,
            reason: error.to_string(),
        })
}
