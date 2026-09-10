# Runtime Reliability

Indus bounds upstream work, degrades to useful cached or secondary data where possible, and emits structured diagnostics without logging credentials or provider payloads.

## Provider policies

| Boundary | Deadline and retry | Cache | Fallback |
|---|---|---|---|
| Gemini 3.8 Flash chat and stream setup | 10-second attempt deadline; one retry for timeouts, network failures, and provider 5xx responses. Provider `429` responses are returned without retry amplification | None for user-specific model output | Context chat makes one non-streaming fallback attempt only when stream setup fails through a timeout, transport, or protocol error before emitting text |
| Metric explanations | One on-demand Gemini attempt with a 6-second deadline | Client cache keyed by symbol, metric, and value: 15 minutes for model output and 1 minute for built-in fallback content | The server returns a non-directional explanation from the supplied value and checked-in metric definition when the provider fails or returns malformed content |
| Research reports | 10-second attempt deadline; one retry for timeouts, network failures, and provider 5xx responses | None | The server builds the same validated report document from the trusted market snapshot when model generation is unavailable |
| Historical market data | 6-second application deadline; one retry per provider. Alpaca's SDK request is capped at 5.5 seconds with SDK retries disabled so attempts cannot overlap | 30 seconds fresh plus 15 minutes stale-on-error; concurrent loads are deduplicated | Yahoo chart history is used when Alpaca fails or returns fewer than `min(2, requested limit)` bars; the better partial result is retained |
| Company fundamentals | 6-second attempt deadline; one retry for both quote and summary surfaces | 60 seconds fresh plus 15 minutes stale-on-error; concurrent loads are deduplicated | A quote-only or summary-only response is returned when the other Yahoo surface fails |
| Report evidence | 6-second attempt deadline with one retry for quote and summary; one 4-second news attempt | 60 seconds fresh plus 15 minutes stale-on-error | Reports continue with whichever bounded Yahoo snapshot remains available; news failure does not prevent generation |
| Live market stream | 8-second connection deadline | No stream cache; the chart retains historical data | The browser remains usable with historical data and reconnects through EventSource |

Market-data responses are marked `private, no-store` so request IDs, rate-limit state, and degradation metadata cannot be replayed through a shared CDN cache. The bounded in-process caches remain intentionally opportunistic: warm serverless instances reuse them, while cold instances refill from providers.

Incoming request cancellation propagates through retry and cache boundaries. Fetch-based provider calls are aborted when their final consumer disconnects; a deduplicated load remains active while another request still needs it. Alpaca SDK history calls retain the SDK's 5.5-second deadline because that helper does not expose caller cancellation, but disconnects stop local retries and Yahoo fallback work.

Gemini requests use low thinking effort and omit deprecated sampling parameters. General responses allow 4,096 output tokens; reports and batched metric explanations allow 8,192. Non-streaming responses join every non-thinking text part and reject non-`STOP` finish reasons.

Research reports use a versioned JSON document contract validated by Zod. The server retrieves up to five symbol-related Yahoo Finance articles published within the previous 30 days and rejects stale, unrelated, future-dated, malformed, or non-HTTP sources. Gemini may analyze potential impact, but source headlines, publishers, dates, and links are restored from trusted server data before storage. Application code owns headings, typography, the educational disclaimer, and PDF layout. Model-authored Markdown, HTML, or LaTeX is neither requested nor executed. Completed reports download through an authenticated tenant-scoped PDF route.

## Rate limits

Database-backed per-user quotas remain authoritative for Gemini-backed routes. Public provider routes also use bounded per-instance fixed windows:

| Route | Limit |
|---|---:|
| `/api/stock-data` | 120 requests per IP per minute |
| `/api/alpaca` | 90 requests per IP per minute |
| `/api/stream/[symbol]` | 30 connection attempts per IP per minute |

Public-route limits reduce accidental bursts and provider amplification. Distributed limits use the shared Redis boundary when global enforcement is required.

Rate-limited responses use `429`, `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.

## Health checks

- `GET /api/health?mode=live` verifies that the application process can serve requests.
- `GET /api/health` is the readiness check. It returns `503` when required Supabase, Alpaca, or Gemini configuration is missing or invalid.

Health requests bypass authentication middleware, responses are never cached, and checks do not expose secret values. Readiness deliberately avoids calling paid or rate-limited upstream APIs; provider outages are handled and surfaced by the request-level retry, fallback, cache, and logging paths.

## Observability

Provider-backed routes return an `X-Request-Id` and preserve a valid incoming request ID when supplied. Market-data responses also return:

- `X-Indus-Provider` — the provider that supplied the response.
- `X-Indus-Cache` — `hit`, `miss`, `stale`, or `deduplicated`.
- `X-Indus-Degraded` — whether fundamentals came from a partial or stale snapshot.

Structured logs include the request ID, route, status, duration, provider, cache status, retry attempt, fallback use, and symbol where relevant. Logs exclude API keys, authorization headers, prompts, and full upstream payloads.

## Failure behavior and rollback

Provider exhaustion returns `502`; bounded provider timeouts return `504` for model requests; provider rate limits remain `429` and are not retried locally. Metric explanations and reports are exceptions because they can return bounded, non-directional content from data already supplied by the application. Stale market data is used only inside its configured stale window.

These controls do not change migrations or deployed data. Rollback is a normal code revert; no data rollback is required.
