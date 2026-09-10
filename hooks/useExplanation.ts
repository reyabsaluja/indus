import { normalizeMetricExplanation, parseValueAnalysis } from "@/lib/metric-explanations";
import type { Item } from "@/lib/prompts";

// localStorage key for persistent cache
const STORAGE_KEY = "indus_explanations_cache_v4";
const CACHE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_CACHE_TTL_MS = 60 * 1000;
const MAX_BATCH_SIZE = 25;

interface ExplanationCacheEntry {
	value: number;
	explanation: string;
	savedAt: number;
}

function cacheTtl(explanation: string): number {
	return parseValueAnalysis(explanation)?.source === "fallback"
		? FALLBACK_CACHE_TTL_MS
		: CACHE_TTL_MS;
}

// Load cache from localStorage on initialization
function loadCacheFromStorage(): Map<string, ExplanationCacheEntry> {
	if (typeof window === "undefined") return new Map();
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed: unknown = JSON.parse(stored);
			if (
				parsed &&
				typeof parsed === "object" &&
				"entries" in parsed &&
				parsed.entries &&
				typeof parsed.entries === "object"
			) {
				return new Map(
					Object.entries(parsed.entries).flatMap((entry) => {
						const value = entry[1];
						if (
							value === null ||
							typeof value !== "object" ||
							!("value" in value) ||
							typeof value.value !== "number" ||
							!Number.isFinite(value.value) ||
							!("explanation" in value) ||
							!("savedAt" in value) ||
							typeof value.savedAt !== "number"
						) {
							return [];
						}
						const explanation = normalizeMetricExplanation(value.explanation);
						return explanation &&
							Date.now() - value.savedAt >= 0 &&
							Date.now() - value.savedAt < cacheTtl(explanation)
							? [[entry[0], { value: value.value, explanation, savedAt: value.savedAt }]]
							: [];
					}),
				);
			}
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch (_e) {
		// Silently fail - cache will be empty
	}
	return new Map();
}

// Save cache to localStorage
function saveCacheToStorage(cache: Map<string, ExplanationCacheEntry>) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: Object.fromEntries(cache) }));
	} catch (_e) {
		// Silently fail - cache won't persist but app will continue working
	}
}

// Global cache and loading state - initialized from localStorage
const explanationCache = loadCacheFromStorage();
const loadingState = new Map<string, boolean>();
const errorState = new Map<string, string>();

// Cache update listeners - now keyed by cache key
const cacheListeners = new Map<string, Set<() => void>>();

function makeKey(symbol: string, metric: string) {
	return `${symbol}_${metric}`;
}

function notifyCacheUpdate(key: string) {
	const listeners = cacheListeners.get(key);
	if (listeners) {
		listeners.forEach((listener) => listener());
	}
}

export function getCachedExplanation(symbol: string, metric: string, value: number) {
	const key = makeKey(symbol, metric);
	const entry = explanationCache.get(key);
	if (
		!entry ||
		entry.value !== value ||
		Date.now() - entry.savedAt < 0 ||
		Date.now() - entry.savedAt >= cacheTtl(entry.explanation)
	) {
		if (entry) {
			explanationCache.delete(key);
			saveCacheToStorage(explanationCache);
		}
		return undefined;
	}
	return entry.explanation;
}

export function isLoading(symbol: string, metric: string) {
	return !!loadingState.get(makeKey(symbol, metric));
}

export function getExplanationError(symbol: string, metric: string) {
	return errorState.get(makeKey(symbol, metric));
}

export function subscribeToCacheUpdates(symbol: string, metric: string, callback: () => void) {
	const key = makeKey(symbol, metric);
	if (!cacheListeners.has(key)) {
		cacheListeners.set(key, new Set());
	}
	cacheListeners.get(key)?.add(callback);
	return () => {
		const listeners = cacheListeners.get(key);
		if (listeners) {
			listeners.delete(callback);
			if (listeners.size === 0) {
				cacheListeners.delete(key);
			}
		}
	};
}

// Track if batch preload is in progress - use a Promise for proper deduplication
let pendingBatchRequest: Promise<void> | null = null;

export async function fetchExplanation(
	symbol: string,
	metric: string,
	value: number,
): Promise<void> {
	const key = makeKey(symbol, metric);

	if (getCachedExplanation(symbol, metric, value) || loadingState.get(key)) {
		return;
	}

	// If another metric is loading, wait and then re-check this metric instead of dropping it.
	if (pendingBatchRequest) {
		await pendingBatchRequest;
		if (getCachedExplanation(symbol, metric, value) || loadingState.get(key)) return;
	}

	// Since we removed individual API endpoint, use batch API for single items
	await batchPreload([{ symbol, metric, value }]);
}

export async function batchPreload(items: Item[]) {
	const previousRequest = pendingBatchRequest;
	const request = (async () => {
		if (previousRequest) await previousRequest;

		const toFetch = items.filter(
			(item) => !getCachedExplanation(item.symbol, item.metric, item.value),
		);
		if (toFetch.length === 0) return;

		for (const item of toFetch) {
			const key = makeKey(item.symbol, item.metric);
			errorState.delete(key);
			loadingState.set(key, true);
			notifyCacheUpdate(key);
		}

		try {
			for (let offset = 0; offset < toFetch.length; offset += MAX_BATCH_SIZE) {
				const batch = toFetch.slice(offset, offset + MAX_BATCH_SIZE);
				try {
					const res = await fetch("/api/batch-explain", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(batch),
					});
					const data: unknown = await res.json().catch(() => null);
					if (!res.ok) {
						const message =
							data && typeof data === "object" && "error" in data && typeof data.error === "string"
								? data.error
								: "This explanation is temporarily unavailable.";
						throw new Error(message);
					}

					const explanations =
						data && typeof data === "object" && "explanations" in data
							? (data.explanations as Record<string, unknown>)
							: {};
					for (const item of batch) {
						const key = makeKey(item.symbol, item.metric);
						const text = normalizeMetricExplanation(explanations[key]);
						if (text) {
							explanationCache.set(key, {
								value: item.value,
								explanation: text,
								savedAt: Date.now(),
							});
							notifyCacheUpdate(key);
						}
					}
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "This explanation is temporarily unavailable.";
					for (const item of batch) {
						const key = makeKey(item.symbol, item.metric);
						errorState.set(key, message);
						notifyCacheUpdate(key);
					}
				}
			}
			saveCacheToStorage(explanationCache);
		} finally {
			for (const item of toFetch) {
				const key = makeKey(item.symbol, item.metric);
				loadingState.delete(key);
				notifyCacheUpdate(key);
			}
		}
	})();

	pendingBatchRequest = request;
	try {
		await request;
	} finally {
		if (pendingBatchRequest === request) pendingBatchRequest = null;
	}
}
