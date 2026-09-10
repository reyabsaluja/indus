import { afterEach, describe, expect, it, vi } from "vitest";
import { executeWithRetry, isTransientError, TimeoutError } from "@/lib/reliability/async";

afterEach(() => {
	vi.useRealTimers();
});

describe("executeWithRetry", () => {
	it("retries transient failures and returns the next successful result", async () => {
		const operation = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("network unavailable"))
			.mockResolvedValueOnce("ok");
		const sleep = vi.fn().mockResolvedValue(undefined);

		await expect(
			executeWithRetry(operation, {
				operation: "provider.test",
				attempts: 2,
				timeoutMs: 1_000,
				sleep,
			}),
		).resolves.toBe("ok");
		expect(operation).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledWith(150);
	});

	it("does not retry permanent failures", async () => {
		const operation = vi.fn().mockRejectedValue(new Error("invalid request"));
		const sleep = vi.fn().mockResolvedValue(undefined);

		await expect(
			executeWithRetry(operation, {
				operation: "provider.test",
				attempts: 3,
				timeoutMs: 1_000,
				sleep,
			}),
		).rejects.toThrow("invalid request");
		expect(operation).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it("aborts and rejects operations that exceed their deadline", async () => {
		vi.useFakeTimers();
		const operation = vi.fn(
			({ signal }: { signal: AbortSignal }) =>
				new Promise<never>((_, reject) => {
					signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
				}),
		);
		const promise = executeWithRetry(operation, {
			operation: "provider.slow",
			attempts: 1,
			timeoutMs: 50,
		});
		const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError);

		await vi.advanceTimersByTimeAsync(50);
		await assertion;
	});

	it("recognizes Yahoo-shaped transient status fields", () => {
		expect(isTransientError({ code: 429 })).toBe(false);
		expect(isTransientError({ statusCode: 503 })).toBe(true);
		expect(isTransientError({ response: { status: 502 } })).toBe(true);
		expect(isTransientError({ code: 404 })).toBe(false);
	});

	it("recognizes provider network and timeout errors wrapped as causes", () => {
		expect(
			isTransientError({
				name: "FetchError",
				cause: new DOMException("request timed out", "TimeoutError"),
			}),
		).toBe(true);
		expect(isTransientError({ cause: new TypeError("connection reset") })).toBe(true);

		const cyclic: { cause?: unknown } = {};
		cyclic.cause = cyclic;
		expect(isTransientError(cyclic)).toBe(false);
	});

	it("propagates caller cancellation without retrying", async () => {
		const controller = new AbortController();
		const operation = vi.fn(
			({ signal }: { signal: AbortSignal }) =>
				new Promise<never>((_, reject) => {
					signal.addEventListener("abort", () => reject(signal.reason));
				}),
		);
		const promise = executeWithRetry(operation, {
			operation: "provider.cancelled",
			attempts: 3,
			timeoutMs: 1_000,
			signal: controller.signal,
		});

		controller.abort(new DOMException("client disconnected", "AbortError"));

		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("interrupts retry backoff when the caller disconnects", async () => {
		const controller = new AbortController();
		const operation = vi.fn().mockRejectedValue(new TypeError("network unavailable"));
		const sleep = vi.fn(() => new Promise<void>(() => undefined));
		const promise = executeWithRetry(operation, {
			operation: "provider.backoff",
			attempts: 3,
			timeoutMs: 1_000,
			signal: controller.signal,
			sleep,
		});

		await vi.waitFor(() => expect(sleep).toHaveBeenCalledTimes(1));
		controller.abort(new DOMException("client disconnected", "AbortError"));

		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
		expect(operation).toHaveBeenCalledTimes(1);
	});
});
