export class TimeoutError extends Error {
	constructor(
		public readonly operation: string,
		public readonly timeoutMs: number,
	) {
		super(`${operation} timed out after ${timeoutMs}ms`);
		this.name = "TimeoutError";
	}
}

interface RetryOperationContext {
	attempt: number;
	signal: AbortSignal;
}

interface RetryOptions {
	operation: string;
	attempts?: number;
	timeoutMs: number;
	signal?: AbortSignal;
	baseDelayMs?: number;
	shouldRetry?: (error: unknown) => boolean;
	onRetry?: (error: unknown, nextAttempt: number) => void;
	sleep?: (delayMs: number) => Promise<void>;
}

function delay(delayMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isTransientErrorInternal(error: unknown, seen: Set<object>): boolean {
	if (error instanceof TimeoutError) {
		return true;
	}

	if (
		error instanceof TypeError ||
		(error instanceof DOMException &&
			(error.name === "AbortError" || error.name === "TimeoutError"))
	) {
		return true;
	}

	if (error && typeof error === "object") {
		if (seen.has(error)) {
			return false;
		}
		seen.add(error);

		const candidate = error as {
			code?: unknown;
			cause?: unknown;
			response?: { status?: unknown };
			status?: unknown;
			statusCode?: unknown;
		};
		const status = Number(
			candidate.status ??
				candidate.statusCode ??
				candidate.code ??
				(candidate.response && typeof candidate.response === "object"
					? candidate.response.status
					: undefined),
		);
		if (status === 408 || status === 425 || status >= 500) {
			return true;
		}

		return candidate.cause !== undefined ? isTransientErrorInternal(candidate.cause, seen) : false;
	}

	return false;
}

export function isTransientError(error: unknown): boolean {
	return isTransientErrorInternal(error, new Set());
}

function abortReason(signal: AbortSignal): unknown {
	return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

async function waitForRetry(
	sleep: (delayMs: number) => Promise<void>,
	delayMs: number,
	signal?: AbortSignal,
): Promise<void> {
	if (!signal) {
		await sleep(delayMs);
		return;
	}
	if (signal.aborted) {
		throw abortReason(signal);
	}

	let removeAbortListener: (() => void) | undefined;
	try {
		await Promise.race([
			sleep(delayMs),
			new Promise<never>((_, reject) => {
				const onAbort = () => reject(abortReason(signal));
				signal.addEventListener("abort", onAbort, { once: true });
				removeAbortListener = () => signal.removeEventListener("abort", onAbort);
			}),
		]);
	} finally {
		removeAbortListener?.();
	}
}

async function runWithTimeout<T>(
	operation: (context: RetryOperationContext) => Promise<T>,
	operationName: string,
	attempt: number,
	timeoutMs: number,
	externalSignal?: AbortSignal,
): Promise<T> {
	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let removeExternalAbortListener: (() => void) | undefined;

	if (externalSignal?.aborted) {
		throw abortReason(externalSignal);
	}

	try {
		const externalAbort = externalSignal
			? new Promise<never>((_, reject) => {
					const onAbort = () => {
						const reason = abortReason(externalSignal);
						controller.abort(reason);
						reject(reason);
					};
					externalSignal.addEventListener("abort", onAbort, { once: true });
					removeExternalAbortListener = () => externalSignal.removeEventListener("abort", onAbort);
				})
			: null;

		return await Promise.race([
			operation({ attempt, signal: controller.signal }),
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					const error = new TimeoutError(operationName, timeoutMs);
					reject(error);
					controller.abort(error);
				}, timeoutMs);
			}),
			...(externalAbort ? [externalAbort] : []),
		]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		removeExternalAbortListener?.();
	}
}

export async function executeWithRetry<T>(
	operation: (context: RetryOperationContext) => Promise<T>,
	options: RetryOptions,
): Promise<T> {
	const attempts = Math.max(1, options.attempts ?? 2);
	const baseDelayMs = Math.max(0, options.baseDelayMs ?? 150);
	const shouldRetry = options.shouldRetry ?? isTransientError;
	const sleep = options.sleep ?? delay;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await runWithTimeout(
				operation,
				options.operation,
				attempt,
				options.timeoutMs,
				options.signal,
			);
		} catch (error) {
			if (options.signal?.aborted) {
				throw error;
			}
			if (attempt === attempts || !shouldRetry(error)) {
				throw error;
			}

			const nextAttempt = attempt + 1;
			options.onRetry?.(error, nextAttempt);
			await waitForRetry(sleep, baseDelayMs * 2 ** (attempt - 1), options.signal);
		}
	}

	throw new Error(`${options.operation} exhausted its retry policy`);
}
