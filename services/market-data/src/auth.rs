use std::{collections::HashSet, sync::Arc};

use async_trait::async_trait;
use axum::http::{HeaderMap, header::AUTHORIZATION};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header, jwk::JwkSet};
use serde::Deserialize;
use thiserror::Error;
use tokio::sync::RwLock;

use crate::config::AuthConfig;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Principal {
    pub subject: String,
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    #[allow(dead_code)]
    exp: u64,
}

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("missing bearer token")]
    Missing,
    #[error("malformed authorization header")]
    Malformed,
    #[error("token is invalid")]
    Invalid,
    #[error("authentication configuration failed: {0}")]
    Configuration(String),
    #[error("identity provider is unavailable")]
    Unavailable,
}

#[async_trait]
pub trait Authenticate: Send + Sync {
    async fn authenticate(&self, headers: &HeaderMap) -> Result<Principal, AuthError>;
}

pub struct JwtAuthenticator {
    issuer: String,
    audience: String,
    mode: AuthMode,
}

enum AuthMode {
    Hmac(DecodingKey),
    Jwks {
        url: String,
        client: reqwest::Client,
        keys: Arc<RwLock<JwkSet>>,
    },
}

impl JwtAuthenticator {
    pub async fn new(config: &AuthConfig) -> Result<Self, AuthError> {
        let mode = if let Some(secret) = &config.hs256_secret {
            if secret.len() < 32 {
                return Err(AuthError::Configuration(
                    "HS256 verification secret must contain at least 32 bytes".into(),
                ));
            }
            AuthMode::Hmac(DecodingKey::from_secret(secret.as_bytes()))
        } else if let Some(url) = &config.jwks_url {
            let parsed = reqwest::Url::parse(url)
                .map_err(|error| AuthError::Configuration(error.to_string()))?;
            let local = matches!(parsed.host_str(), Some("127.0.0.1" | "localhost" | "::1"));
            if parsed.scheme() != "https" && !local {
                return Err(AuthError::Configuration(
                    "JWKS URL must use HTTPS outside loopback development".into(),
                ));
            }
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .map_err(|error| AuthError::Configuration(error.to_string()))?;
            let keys = fetch_jwks(&client, url).await?;
            AuthMode::Jwks {
                url: url.clone(),
                client,
                keys: Arc::new(RwLock::new(keys)),
            }
        } else {
            return Err(AuthError::Configuration("no verifier configured".into()));
        };
        Ok(Self {
            issuer: config.issuer.clone(),
            audience: config.audience.clone(),
            mode,
        })
    }

    async fn verify(&self, token: &str) -> Result<Principal, AuthError> {
        match &self.mode {
            AuthMode::Hmac(key) => self.decode(token, key, Algorithm::HS256),
            AuthMode::Jwks { url, client, keys } => {
                let header = decode_header(token).map_err(|_| AuthError::Invalid)?;
                if !matches!(
                    header.alg,
                    Algorithm::RS256 | Algorithm::RS384 | Algorithm::RS512
                ) {
                    return Err(AuthError::Invalid);
                }
                let kid = header.kid.ok_or(AuthError::Invalid)?;
                let cached_key = {
                    let cached = keys.read().await;
                    decoding_key(&cached, &kid)?
                };
                if let Some(key) = cached_key {
                    return self.decode(token, &key, header.alg);
                }
                let refreshed = fetch_jwks(client, url).await?;
                let key = decoding_key(&refreshed, &kid)?.ok_or(AuthError::Invalid)?;
                *keys.write().await = refreshed;
                self.decode(token, &key, header.alg)
            }
        }
    }

    fn decode(
        &self,
        token: &str,
        key: &DecodingKey,
        algorithm: Algorithm,
    ) -> Result<Principal, AuthError> {
        let mut validation = Validation::new(algorithm);
        validation.set_audience(&[&self.audience]);
        validation.set_issuer(&[&self.issuer]);
        validation.required_spec_claims =
            HashSet::from(["exp".into(), "iss".into(), "sub".into(), "aud".into()]);
        validation.leeway = 30;
        let claims = decode::<Claims>(token, key, &validation)
            .map_err(|_| AuthError::Invalid)?
            .claims;
        if claims.sub.trim().is_empty() {
            return Err(AuthError::Invalid);
        }
        Ok(Principal {
            subject: claims.sub,
        })
    }
}

#[async_trait]
impl Authenticate for JwtAuthenticator {
    async fn authenticate(&self, headers: &HeaderMap) -> Result<Principal, AuthError> {
        let header = headers
            .get(AUTHORIZATION)
            .ok_or(AuthError::Missing)?
            .to_str()
            .map_err(|_| AuthError::Malformed)?;
        let token = header.strip_prefix("Bearer ").ok_or(AuthError::Malformed)?;
        if token.trim().is_empty() || token.contains(char::is_whitespace) {
            return Err(AuthError::Malformed);
        }
        self.verify(token).await
    }
}

fn decoding_key(keys: &JwkSet, kid: &str) -> Result<Option<DecodingKey>, AuthError> {
    keys.find(kid)
        .map(DecodingKey::from_jwk)
        .transpose()
        .map_err(|_| AuthError::Invalid)
}

async fn fetch_jwks(client: &reqwest::Client, url: &str) -> Result<JwkSet, AuthError> {
    client
        .get(url)
        .send()
        .await
        .map_err(|_| AuthError::Unavailable)?
        .error_for_status()
        .map_err(|_| AuthError::Unavailable)?
        .json()
        .await
        .map_err(|_| AuthError::Unavailable)
}

#[cfg(test)]
mod tests {
    use axum::http::HeaderValue;
    use chrono::{Duration, Utc};
    use jsonwebtoken::{EncodingKey, Header, encode};
    use serde::Serialize;

    use super::*;

    #[derive(Serialize)]
    struct TestClaims<'a> {
        sub: &'a str,
        iss: &'a str,
        aud: &'a str,
        exp: i64,
    }

    #[tokio::test]
    async fn requires_valid_bearer_header_and_claims() {
        let authenticator = JwtAuthenticator::new(&AuthConfig {
            issuer: "https://identity.example".into(),
            audience: "indus-web".into(),
            jwks_url: None,
            hs256_secret: Some("local-test-secret-that-is-not-production".into()),
        })
        .await
        .unwrap();
        let token = encode(
            &Header::new(Algorithm::HS256),
            &TestClaims {
                sub: "user-1",
                iss: "https://identity.example",
                aud: "indus-web",
                exp: (Utc::now() + Duration::minutes(5)).timestamp(),
            },
            &EncodingKey::from_secret(b"local-test-secret-that-is-not-production"),
        )
        .unwrap();
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).unwrap(),
        );
        assert_eq!(
            authenticator.authenticate(&headers).await.unwrap().subject,
            "user-1"
        );
        assert!(authenticator.authenticate(&HeaderMap::new()).await.is_err());
    }

    #[tokio::test]
    async fn rejects_malformed_headers_and_untrusted_claims() {
        let secret = b"local-test-secret-that-is-not-production";
        let authenticator = JwtAuthenticator::new(&AuthConfig {
            issuer: "https://identity.example".into(),
            audience: "indus-web".into(),
            jwks_url: None,
            hs256_secret: Some(String::from_utf8(secret.to_vec()).unwrap()),
        })
        .await
        .unwrap();

        for value in ["Basic token", "Bearer ", "Bearer token with-spaces"] {
            let mut headers = HeaderMap::new();
            headers.insert(AUTHORIZATION, HeaderValue::from_str(value).unwrap());
            assert!(matches!(
                authenticator.authenticate(&headers).await,
                Err(AuthError::Malformed)
            ));
        }

        let wrong_audience = encode(
            &Header::new(Algorithm::HS256),
            &TestClaims {
                sub: "user-1",
                iss: "https://identity.example",
                aud: "another-service",
                exp: (Utc::now() + Duration::minutes(5)).timestamp(),
            },
            &EncodingKey::from_secret(secret),
        )
        .unwrap();
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {wrong_audience}")).unwrap(),
        );
        assert!(matches!(
            authenticator.authenticate(&headers).await,
            Err(AuthError::Invalid)
        ));
    }

    #[tokio::test]
    async fn fails_closed_for_weak_or_insecure_verifier_configuration() {
        let weak = JwtAuthenticator::new(&AuthConfig {
            issuer: "https://identity.example".into(),
            audience: "indus-web".into(),
            jwks_url: None,
            hs256_secret: Some("too-short".into()),
        })
        .await;
        assert!(matches!(weak, Err(AuthError::Configuration(_))));

        let insecure = JwtAuthenticator::new(&AuthConfig {
            issuer: "https://identity.example".into(),
            audience: "indus-web".into(),
            jwks_url: Some("http://identity.example/.well-known/jwks.json".into()),
            hs256_secret: None,
        })
        .await;
        assert!(matches!(insecure, Err(AuthError::Configuration(_))));
    }
}
