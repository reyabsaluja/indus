export type CacheStatus = "hit" | "miss" | "stale" | "deduplicated";

export interface CacheResult<T> {
	value: T;
	status: CacheStatus;
}

interface CacheEntry<T> {
	value: T;
	freshUntil: number;
	staleUntil: number;
}

interface ResilientCacheOptions {
	freshForMs: number;
	staleForMs: number;
	maxEntries?: number;
	now?: () => number;
}

interface InFlightLoad<T> {
	promise: Promise<T>;
	controller: AbortController;
	consumers: number;
	settled: boolean;
}

export class ResilientCache<T> {
	private readonly entries = new Map<string, CacheEntry<T>>();
	private readonly inFlight = new Map<string, InFlightLoad<T>>();
	private readonly maxEntries: number;
	private readonly now: () => number;

	constructor(private readonly options: ResilientCacheOptions) {
		this.maxEntries = Math.max(1, options.maxEntries ?? 250);
		this.now = options.now ?? Date.now;
	}

	async getOrLoad(
		key: string,
		loader: (signal: AbortSignal) => Promise<T>,
		signal?: AbortSignal,
	): Promise<CacheResult<T>> {
		signal?.throwIfAborted();
		const now = this.now();
		const cached = this.entries.get(key);

		if (cached && cached.freshUntil > now) {
			this.touch(key, cached);
			return { value: cached.value, status: "hit" };
		}

		const existingLoad = this.inFlight.get(key);
		if (existingLoad) {
			return this.consume(key, existingLoad, "deduplicated", cached, signal);
		}

		const controller = new AbortController();
		let pending: Promise<T>;
		try {
			pending = loader(controller.signal);
		} catch (error) {
			pending = Promise.reject(error);
		}
		const load: InFlightLoad<T> = {
			controller,
			consumers: 0,
			settled: false,
			promise: pending,
		};
		load.promise = pending
			.then((value) => {
				if (!controller.signal.aborted) {
					const loadedAt = this.now();
					this.entries.set(key, {
						value,
						freshUntil: loadedAt + this.options.freshForMs,
						staleUntil: loadedAt + this.options.freshForMs + this.options.staleForMs,
					});
					this.prune();
				}
				return value;
			})
			.finally(() => {
				load.settled = true;
				if (this.inFlight.get(key) === load) {
					this.inFlight.delete(key);
				}
			});
		this.inFlight.set(key, load);
		return this.consume(key, load, "miss", cached, signal);
	}

	clear(): void {
		for (const load of this.inFlight.values()) {
			load.controller.abort(new DOMException("Cache cleared", "AbortError"));
		}
		this.entries.clear();
		this.inFlight.clear();
	}

	private async consume(
		key: string,
		load: InFlightLoad<T>,
		status: "miss" | "deduplicated",
		cached: CacheEntry<T> | undefined,
		signal: AbortSignal | undefined,
	): Promise<CacheResult<T>> {
		load.consumers += 1;
		try {
			return { value: await this.waitForConsumer(load.promise, signal), status };
		} catch (error) {
			if (signal?.aborted) {
				throw signal.reason ?? error;
			}
			if (cached && cached.staleUntil > this.now()) {
				this.touch(key, cached);
				return { value: cached.value, status: "stale" };
			}
			this.entries.delete(key);
			throw error;
		} finally {
			load.consumers -= 1;
			if (load.consumers === 0 && !load.settled) {
				load.controller.abort(new DOMException("No active cache consumers", "AbortError"));
			}
		}
	}

	private waitForConsumer(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
		if (!signal) return promise;
		if (signal.aborted) return Promise.reject(signal.reason);

		return new Promise<T>((resolve, reject) => {
			const onAbort = () => reject(signal.reason);
			signal.addEventListener("abort", onAbort, { once: true });
			promise.then(
				(value) => {
					signal.removeEventListener("abort", onAbort);
					resolve(value);
				},
				(error) => {
					signal.removeEventListener("abort", onAbort);
					reject(error);
				},
			);
		});
	}

	private touch(key: string, entry: CacheEntry<T>): void {
		this.entries.delete(key);
		this.entries.set(key, entry);
	}

	private prune(): void {
		const now = this.now();
		for (const [key, entry] of this.entries) {
			if (entry.staleUntil <= now) {
				this.entries.delete(key);
			}
		}

		while (this.entries.size > this.maxEntries) {
			const oldestKey = this.entries.keys().next().value;
			if (oldestKey === undefined) {
				break;
			}
			this.entries.delete(oldestKey);
		}
	}
}
