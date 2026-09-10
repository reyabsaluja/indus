import { useEffect, useState } from 'react'
import { useAppContext } from '../app-context'
import type { MarketStreamStatus, PriceTick } from '../lib/market-stream'

export interface LivePriceSnapshot {
  tick: PriceTick | null
  status: MarketStreamStatus
}

export function useLivePrice(symbol: string): LivePriceSnapshot {
  const { marketStream } = useAppContext()
  const [snapshot, setSnapshot] = useState<LivePriceSnapshot>({ tick: null, status: 'connecting' })

  useEffect(() => {
    setSnapshot({ tick: null, status: 'connecting' })
    return marketStream.subscribe(
      symbol,
      tick => setSnapshot({ tick, status: 'live' }),
      status => setSnapshot(previous => ({ ...previous, status })),
    )
  }, [marketStream, symbol])

  return snapshot
}
