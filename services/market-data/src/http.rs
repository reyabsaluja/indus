use std::{convert::Infallible, sync::Arc};

use axum::{
    Json, Router,
    extract::{OriginalUri, Path, State},
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response, Sse, sse::Event},
    routing::get,
};
use serde::Serialize;
use tokio::{sync::broadcast, time};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::{
    auth::{AuthError, Authenticate},
    health::ServiceHealth,
    metrics::Metrics,
    provider::normalize_symbol,
    streaming::{LimitError, StreamHub, StreamLimits},
};

#[derive(Clone)]
pub struct AppState {
    pub authenticator: Arc<dyn Authenticate>,
    pub hub: Arc<StreamHub>,
    pub limits: Arc<StreamLimits>,
    pub health: Arc<ServiceHealth>,
    pub metrics: Metrics,
    pub heartbeat: std::time::Duration,
}

pub fn router(state: AppState, allowed_origins: &[String]) -> Result<Router, http::Error> {
    let origins = allowed_origins
        .iter()
        .map(|origin| origin.parse::<HeaderValue>())
        .collect::<Result<Vec<_>, _>>()?;
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([axum::http::Method::GET])
        .allow_headers([
            header::AUTHORIZATION,
            HeaderName::from_static("last-event-id"),
            header::CONTENT_TYPE,
        ])
        .expose_headers([header::CONTENT_TYPE])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(600));
    Ok(Router::new()
        .route("/health/live", get(liveness))
        .route("/health/ready", get(readiness))
        .route("/metrics", get(metrics))
        .route("/v1/streams/{symbol}", get(stream))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state))
}

async fn liveness(State(state): State<AppState>) -> impl IntoResponse {
    let status = if state.health.is_live() {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (
        status,
        Json(serde_json::json!({"status": if status.is_success() { "ok" } else { "stopping" }})),
    )
}

async fn readiness(State(state): State<AppState>) -> impl IntoResponse {
    let readiness = state.health.readiness();
    let status = if readiness.ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, Json(readiness))
}

async fn metrics(State(state): State<AppState>) -> Response {
    match state.metrics.encode() {
        Ok(body) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
            body,
        )
            .into_response(),
        Err(_) => {
            ApiError::unavailable("metrics_unavailable", "Metrics are unavailable").into_response()
        }
    }
}

async fn stream(
    State(state): State<AppState>,
    Path(raw_symbol): Path<String>,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
) -> Response {
    if query_contains_credentials(uri.query()) {
        return ApiError::bad_request(
            "query_credentials_forbidden",
            "Credentials must be supplied in the Authorization header",
        )
        .into_response();
    }
    let principal = match state.authenticator.authenticate(&headers).await {
        Ok(principal) => principal,
        Err(error) => return ApiError::from(error).into_response(),
    };
    let symbol = match normalize_symbol(&raw_symbol) {
        Ok(symbol) => symbol,
        Err(_) => {
            return ApiError::bad_request("invalid_symbol", "Symbol is invalid").into_response();
        }
    };
    let lease = match state.limits.acquire(&principal.subject) {
        Ok(lease) => lease,
        Err(error) => return ApiError::from(error).into_response(),
    };
    let last_id = headers
        .get(HeaderName::from_static("last-event-id"))
        .and_then(|value| value.to_str().ok());
    let subscription = state.hub.subscribe(&symbol, last_id);
    let hub = state.hub.clone();
    let metrics = state.metrics.clone();
    let heartbeat_duration = state.heartbeat;
    let event_stream = async_stream::stream! {
        let _lease = lease;
        if subscription.replay_gap {
            yield Ok::<_, Infallible>(json_event("gap", serde_json::json!({"reason":"replay_cursor_evicted"})));
        }
        for event in subscription.replay {
            yield Ok(live_event(&event));
        }
        let mut receiver = subscription.receiver;
        let mut heartbeat = time::interval(heartbeat_duration);
        heartbeat.set_missed_tick_behavior(time::MissedTickBehavior::Delay);
        loop {
            tokio::select! {
                _ = heartbeat.tick() => {
                    if hub.is_stale(&symbol) {
                        yield Ok(json_event("stale", serde_json::json!({"symbol":symbol,"reason":"provider_timeout"})));
                    } else {
                        yield Ok(Event::default().comment("heartbeat"));
                    }
                }
                result = receiver.recv() => match result {
                    Ok(event) => yield Ok(live_event(&event)),
                    Err(broadcast::error::RecvError::Lagged(count)) => {
                        metrics.stream_lagged_events.inc_by(count);
                        yield Ok(json_event("gap", serde_json::json!({"reason":"slow_consumer","skipped":count})));
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    };
    Sse::new(event_stream).into_response()
}

fn live_event(event: &crate::event::LiveEvent) -> Event {
    Event::default()
        .id(event.id.clone())
        .event(event.event_type)
        .data(serde_json::to_string(event).expect("live event is serializable"))
}

fn json_event<T: Serialize>(event_type: &'static str, payload: T) -> Event {
    Event::default()
        .event(event_type)
        .data(serde_json::to_string(&payload).expect("SSE payload is serializable"))
}

fn query_contains_credentials(query: Option<&str>) -> bool {
    const CREDENTIAL_KEYS: &[&str] = &["access_token", "api_key", "authorization", "jwt", "token"];
    query.is_some_and(|query| {
        url::form_urlencoded::parse(query.as_bytes())
            .any(|(key, _)| CREDENTIAL_KEYS.contains(&key.to_ascii_lowercase().as_str()))
    })
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: ErrorDetail,
}

#[derive(Debug, Serialize)]
struct ErrorDetail {
    code: &'static str,
    message: &'static str,
}

struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: &'static str,
    retry_after: Option<&'static str>,
}

impl ApiError {
    fn bad_request(code: &'static str, message: &'static str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code,
            message,
            retry_after: None,
        }
    }

    fn unavailable(code: &'static str, message: &'static str) -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            code,
            message,
            retry_after: Some("5"),
        }
    }
}

impl From<AuthError> for ApiError {
    fn from(error: AuthError) -> Self {
        match error {
            AuthError::Unavailable => Self::unavailable(
                "identity_unavailable",
                "Identity verification is unavailable",
            ),
            _ => Self {
                status: StatusCode::UNAUTHORIZED,
                code: "unauthorized",
                message: "A valid bearer token is required",
                retry_after: None,
            },
        }
    }
}

impl From<LimitError> for ApiError {
    fn from(error: LimitError) -> Self {
        match error {
            LimitError::UserQuota => Self {
                status: StatusCode::TOO_MANY_REQUESTS,
                code: "stream_quota_exceeded",
                message: "Concurrent stream quota exceeded",
                retry_after: Some("5"),
            },
            LimitError::GlobalQuota => Self::unavailable(
                "stream_capacity_exceeded",
                "Stream capacity is temporarily exhausted",
            ),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut response = (
            self.status,
            Json(ErrorBody {
                error: ErrorDetail {
                    code: self.code,
                    message: self.message,
                },
            }),
        )
            .into_response();
        if let Some(retry_after) = self.retry_after {
            response
                .headers_mut()
                .insert(header::RETRY_AFTER, HeaderValue::from_static(retry_after));
        }
        response
    }
}

#[cfg(test)]
mod tests {
    use async_trait::async_trait;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    use super::*;
    use crate::{
        auth::Principal,
        metrics::Metrics,
        streaming::{StreamHub, StreamLimits},
    };

    struct StubAuth(bool);

    #[async_trait]
    impl Authenticate for StubAuth {
        async fn authenticate(&self, _headers: &HeaderMap) -> Result<Principal, AuthError> {
            self.0
                .then(|| Principal {
                    subject: "user-1".into(),
                })
                .ok_or(AuthError::Invalid)
        }
    }

    #[test]
    fn query_credentials_are_rejected_case_insensitively() {
        assert!(query_contains_credentials(Some("access_token=secret")));
        assert!(query_contains_credentials(Some("JWT=secret")));
        assert!(!query_contains_credentials(Some("interval=1m")));
    }

    #[tokio::test]
    async fn stream_route_rejects_query_credentials_before_authentication() {
        let response = test_router(true)
            .oneshot(
                Request::builder()
                    .uri("/v1/streams/AAPL?access_token=secret")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn stream_route_enforces_auth_and_returns_sse_only_after_success() {
        let unauthorized = test_router(false)
            .oneshot(
                Request::builder()
                    .uri("/v1/streams/AAPL")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);

        let authenticated = test_router(true)
            .oneshot(
                Request::builder()
                    .uri("/v1/streams/BTC%2FUSD")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(authenticated.status(), StatusCode::OK);
        assert_eq!(
            authenticated.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/event-stream"
        );
    }

    #[tokio::test]
    async fn stream_route_rejects_invalid_symbols_after_authentication() {
        let response = test_router(true)
            .oneshot(
                Request::builder()
                    .uri("/v1/streams/AAPL%3BDROP")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn stream_route_distinguishes_user_quota_and_global_exhaustion() {
        let metrics = Metrics::new().unwrap();
        let user_limits = StreamLimits::new(1, 2, metrics.clone());
        let _user_lease = user_limits.acquire("user-1").unwrap();
        let response = test_router_with_limits(true, metrics.clone(), user_limits)
            .oneshot(
                Request::builder()
                    .uri("/v1/streams/AAPL")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(response.headers().get(header::RETRY_AFTER).unwrap(), "5");

        let global_limits = StreamLimits::new(2, 1, metrics.clone());
        let _global_lease = global_limits.acquire("another-user").unwrap();
        let response = test_router_with_limits(true, metrics, global_limits)
            .oneshot(
                Request::builder()
                    .uri("/v1/streams/AAPL")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(response.headers().get(header::RETRY_AFTER).unwrap(), "5");
    }

    fn test_router(authorized: bool) -> Router {
        let metrics = Metrics::new().unwrap();
        let limits = StreamLimits::new(2, 10, metrics.clone());
        test_router_with_limits(authorized, metrics, limits)
    }

    fn test_router_with_limits(
        authorized: bool,
        metrics: Metrics,
        limits: Arc<StreamLimits>,
    ) -> Router {
        let state = AppState {
            authenticator: Arc::new(StubAuth(authorized)),
            hub: Arc::new(StreamHub::new(4, 4, std::time::Duration::from_secs(30))),
            limits,
            health: Arc::new(ServiceHealth::default()),
            metrics,
            heartbeat: std::time::Duration::from_secs(15),
        };
        router(state, &["http://localhost".into()]).unwrap()
    }
}
