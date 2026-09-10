import { Alpaca } from "@alpacahq/alpaca-trade-api";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { finishRequestLog, getRequestHeaders, startRequestLog } from "@/lib/observability/request";
import {
	extractBarSymbol,
	formatSseMessage,
	getNextEventId,
	isCryptoSymbol,
	normalizeStreamSymbol,
	toCryptoCandlestickData,
	toStockCandlestickData,
} from "@/lib/realtime/alpaca-stream";
import { streamParamsSchema } from "@/lib/schemas/api";
import {
	FixedWindowRateLimiter,
	getClientIp,
	getRateLimitHeaders,
} from "@/lib/security/request-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AlpacaStockStream = ReturnType<Alpaca["marketData"]["stockStream"]>;
type AlpacaCryptoStream = ReturnType<Alpaca["marketData"]["cryptoStream"]>;
type AlpacaStream = AlpacaStockStream | AlpacaCryptoStream;

const encoder = new TextEncoder();
const streamRateLimiter = new FixedWindowRateLimiter({ limit: 30, windowMs: 60_000 });

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
	const requestLog = startRequestLog(request, "/api/stream/[symbol]");
	let decodedSymbol: string;

	try {
		const resolvedParams = await params;
		decodedSymbol = decodeURIComponent(resolvedParams.symbol);
	} catch {
		finishRequestLog(requestLog, 400);
		return Response.json(
			{ error: "Invalid stream symbol" },
			{ status: 400, headers: getRequestHeaders(requestLog) },
		);
	}

	const parsed = streamParamsSchema.safeParse({ symbol: decodedSymbol });
	if (!parsed.success) {
		finishRequestLog(requestLog, 400);
		return Response.json(
			{ error: "Invalid stream symbol" },
			{ status: 400, headers: getRequestHeaders(requestLog) },
		);
	}

	const symbol = normalizeStreamSymbol(parsed.data.symbol);
	const assetType = isCryptoSymbol(symbol) ? "crypto" : "stock";
	const rateLimit = streamRateLimiter.check(getClientIp(request));
	const responseHeaders = {
		"Cache-Control": "private, no-store, no-transform",
		...getRequestHeaders(requestLog),
		...getRateLimitHeaders(rateLimit),
	};
	if (!rateLimit.allowed) {
		finishRequestLog(requestLog, 429, { symbol, assetType });
		return Response.json(
			{ error: "Too many live market connections" },
			{ status: 429, headers: responseHeaders },
		);
	}

	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let alpacaStream: AlpacaStream | null = null;
			let eventId = getNextEventId(request.headers.get("last-event-id"));
			let heartbeat: ReturnType<typeof setInterval> | null = null;
			let connectTimeout: ReturnType<typeof setTimeout> | null = null;
			let closed = false;
			let closeReason = "client_closed";

			const enqueue = (chunk: string) => {
				if (!closed) {
					controller.enqueue(encoder.encode(chunk));
				}
			};

			const close = (reason = closeReason) => {
				if (closed) {
					return;
				}

				closed = true;
				closeReason = reason;

				if (heartbeat) {
					clearInterval(heartbeat);
					heartbeat = null;
				}
				if (connectTimeout) {
					clearTimeout(connectTimeout);
					connectTimeout = null;
				}

				try {
					if (assetType === "crypto") {
						(alpacaStream as AlpacaCryptoStream | null)?.unsubscribeFromBars([symbol]);
					} else {
						(alpacaStream as AlpacaStockStream | null)?.unsubscribeFromBars([symbol]);
					}
				} catch (error) {
					logger.error("market_stream.unsubscribe_failed", error, {
						requestId: requestLog.requestId,
						symbol,
						assetType,
					});
				}

				try {
					alpacaStream?.disconnect();
				} catch (error) {
					logger.error("market_stream.disconnect_failed", error, {
						requestId: requestLog.requestId,
						symbol,
						assetType,
					});
				}

				try {
					controller.close();
				} catch {
					// The browser may have already closed the connection.
				}
				finishRequestLog(requestLog, 200, { symbol, assetType, closeReason });
			};

			cleanup = () => close("stream_cancelled");

			const sendStreamError = () => {
				enqueue(
					formatSseMessage({
						id: eventId++,
						event: "stream-error",
						data: { message: "Live market data is temporarily unavailable" },
					}),
				);
				close("provider_error");
			};

			const sendReady = () => {
				if (connectTimeout) {
					clearTimeout(connectTimeout);
					connectTimeout = null;
				}
				enqueue(formatSseMessage({ id: eventId++, event: "ready", data: { symbol, assetType } }));
			};

			const sendBar = (bar: unknown) => {
				const barSymbol = extractBarSymbol(bar) ?? symbol;
				if (normalizeStreamSymbol(barSymbol) !== symbol) {
					return;
				}

				const data =
					assetType === "crypto" ? toCryptoCandlestickData(bar) : toStockCandlestickData(bar);
				enqueue(formatSseMessage({ id: eventId++, event: "bar", data }));
			};

			const startAlpacaStream = () => {
				try {
					const alpaca = new Alpaca({
						keyId: env.ALPACA_API_KEY,
						secret: env.ALPACA_SECRET_KEY,
						paper: env.ALPACA_IS_PAPER,
					});

					heartbeat = setInterval(() => enqueue(": keep-alive\n\n"), 15_000);
					connectTimeout = setTimeout(() => {
						logger.warn("market_stream.connect_timeout", {
							requestId: requestLog.requestId,
							symbol,
							assetType,
						});
						sendStreamError();
					}, 8_000);

					if (assetType === "crypto") {
						const cryptoStream = alpaca.marketData.cryptoStream();
						alpacaStream = cryptoStream;

						cryptoStream.onConnect(() => {
							sendReady();
							cryptoStream.subscribeForBars([symbol]);
						});
						cryptoStream.onBar((bar) => sendBar(bar));
						cryptoStream.onDisconnect(() => close("provider_disconnect"));
						cryptoStream.onError((error) => {
							logger.error("market_stream.provider_failed", error, {
								requestId: requestLog.requestId,
								symbol,
								assetType,
							});
							sendStreamError();
						});
						cryptoStream.connect();
					} else {
						const stockStream = alpaca.marketData.stockStream({ feed: "iex" });
						alpacaStream = stockStream;

						stockStream.onConnect(() => {
							sendReady();
							stockStream.subscribeForBars([symbol]);
						});
						stockStream.onBar((bar) => sendBar(bar));
						stockStream.onDisconnect(() => close("provider_disconnect"));
						stockStream.onError((error) => {
							logger.error("market_stream.provider_failed", error, {
								requestId: requestLog.requestId,
								symbol,
								assetType,
							});
							sendStreamError();
						});
						stockStream.connect();
					}
				} catch (error) {
					logger.error("market_stream.start_failed", error, {
						requestId: requestLog.requestId,
						symbol,
						assetType,
					});
					sendStreamError();
				}
			};

			if (request.signal.aborted) {
				close("client_abort");
				return;
			}
			request.signal.addEventListener("abort", () => close("client_abort"), { once: true });
			startAlpacaStream();
		},
		cancel() {
			cleanup?.();
		},
	});

	return new Response(stream, {
		headers: {
			...responseHeaders,
			Connection: "keep-alive",
			"Content-Type": "text/event-stream",
			"X-Accel-Buffering": "no",
		},
	});
}
