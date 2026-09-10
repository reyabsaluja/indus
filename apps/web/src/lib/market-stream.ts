export interface PriceTick { symbol: string; price: number; timestamp: string }
export interface MarketStream { subscribe(symbol: string, onTick: (tick: PriceTick) => void): () => void }

export const unavailableMarketStream: MarketStream = {
  subscribe() { return () => undefined },
}
