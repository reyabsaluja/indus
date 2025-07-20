import { Item } from "@/lib/prompts";

// Global cache and loading state
const explanationCache = new Map<string, string>();
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

// Track if batch preload is in progress
let batchPreloadInProgress = false;

export async function fetchExplanation(
  symbol: string,
  metric: string,
  value: number,
): Promise<void> {
  const key = makeKey(symbol, metric);

  if (explanationCache.has(key) || loadingState.get(key)) {
    return;
  }

  // If batch preload is in progress, don't send individual requests
  if (batchPreloadInProgress) {
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
  // Only fetch if not already cached
  const toFetch = items.filter(
    (item) => !explanationCache.has(makeKey(item.symbol, item.metric)),
  );

  if (toFetch.length === 0) {
    return;
  }

  // Set batch preload flag to prevent individual requests
  batchPreloadInProgress = true;

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
    } else if (data.error && data.error.includes("429")) {
      // Rate limit exceeded - use fallback explanations
      for (const item of items) {
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
    // Reset batch preload flag
    batchPreloadInProgress = false;
  }
}
