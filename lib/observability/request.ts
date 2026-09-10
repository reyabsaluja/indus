import { logger } from "@/lib/observability/logger";

type RequestLogContext = Record<string, boolean | number | string | null | undefined>;

export interface RequestLog {
	requestId: string;
	route: string;
	startedAt: number;
}

function safeRequestId(value: string | null): string | null {
	if (!value) {
		return null;
	}

	const trimmed = value.trim();
	return /^[A-Za-z0-9._:-]{1,128}$/.test(trimmed) ? trimmed : null;
}

export function startRequestLog(request: Request, route: string): RequestLog {
	return {
		requestId: safeRequestId(request.headers.get("x-request-id")) ?? crypto.randomUUID(),
		route,
		startedAt: performance.now(),
	};
}

export function getRequestHeaders(requestLog: RequestLog): Record<string, string> {
	return { "X-Request-Id": requestLog.requestId };
}

export function finishRequestLog(
	requestLog: RequestLog,
	status: number,
	context: RequestLogContext = {},
): void {
	const entry = {
		requestId: requestLog.requestId,
		route: requestLog.route,
		status,
		durationMs: Math.round((performance.now() - requestLog.startedAt) * 100) / 100,
		...context,
	};

	if (status >= 500) {
		logger.warn("http.request_completed", entry);
	} else {
		logger.info("http.request_completed", entry);
	}
}
