import { Item } from "@/lib/prompts";

// localStorage key for persistent cache
const STORAGE_KEY = "indus_explanations_cache";

// Load cache from localStorage on initialization
function loadCacheFromStorage(): Map<string, string> {
  if (typeof window === "undefined") return new Map();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    // Silently fail - cache will be empty
  }
  return new Map();
}

// Save cache to localStorage
function saveCacheToStorage(cache: Map<string, string>) {
  if (typeof window === "undefined") return;
  try {
    const obj = Object.fromEntries(cache);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    // Silently fail - cache won't persist but app will continue working
  }
}

// Global cache and loading state - initialized from localStorage
const explanationCache = loadCacheFromStorage();
const loadingState = new Map<string, boolean>();
let preloadPromise: Promise<void> | null = null;

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

export function getCachedExplanation(symbol: string, metric: string) {
  const key = makeKey(symbol, metric);
  return explanationCache.get(key);
}

export function isLoading(symbol: string, metric: string) {
  return !!loadingState.get(makeKey(symbol, metric));
}

export function subscribeToCacheUpdates(
  symbol: string,
  metric: string,
  callback: () => void,
) {
  const key = makeKey(symbol, metric);
  if (!cacheListeners.has(key)) {
    cacheListeners.set(key, new Set());
  }
  cacheListeners.get(key)!.add(callback);
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

  if (explanationCache.has(key) || loadingState.get(key)) {
    return;
  }

  // If batch preload is in progress, wait for it instead of starting a new one
  if (pendingBatchRequest) {
    await pendingBatchRequest;
    return;
  }

  // Since we removed individual API endpoint, use batch API for single items
  await batchPreload([{ symbol, metric, value }]);
}

function getFallbackExplanation(
  symbol: string,
  metric: string,
  value: number,
): string {
  switch (metric) {
    case "price":
      return `Error`;
    case "pe_ratio":
      return `Error`;
    case "volume":
      return `Error`;
    default:
      return `Error`;
  }
}

export async function batchPreload(items: Item[]) {
  // If a batch request is already in progress, wait for it and return
  // This prevents duplicate API calls from React Strict Mode or race conditions
  if (pendingBatchRequest) {
    await pendingBatchRequest;
    return;
  }

  // Only fetch if not already cached
  const toFetch = items.filter(
    (item) => !explanationCache.has(makeKey(item.symbol, item.metric)),
  );

  if (toFetch.length === 0) {
    return;
  }

  // Create and store the promise BEFORE the async operation
  // This ensures any concurrent calls will see the pending request
  pendingBatchRequest = (async () => {
    try {
      const res = await fetch("/api/batch-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toFetch),
      });
      const data = await res.json();

      if (data.explanations) {
        for (const [key, text] of Object.entries(data.explanations)) {
          explanationCache.set(key, text as string);
          notifyCacheUpdate(key);
        }
        // Persist to localStorage
        saveCacheToStorage(explanationCache);
      } else if (data.error && data.error.includes("429")) {
        // Rate limit exceeded - use fallback explanations
        for (const item of toFetch) {
          const key = makeKey(item.symbol, item.metric);
          const fallbackExplanation = getFallbackExplanation(
            item.symbol,
            item.metric,
            item.value,
          );
          explanationCache.set(key, fallbackExplanation);
          notifyCacheUpdate(key);
        }
      }
    } catch (e) {
      console.error("Batch preload error:", e);
    } finally {
      // Clear the pending request so future calls can proceed
      pendingBatchRequest = null;
    }
  })();

  // Wait for the request to complete
  await pendingBatchRequest;
}
