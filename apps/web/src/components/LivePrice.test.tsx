import { QueryClient } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppContextProvider } from '../app-context'
import type { ApiClient } from '../lib/api'
import type { AuthAdapter } from '../lib/auth'
import type { MarketStream, MarketStreamStatus, PriceTick } from '../lib/market-stream'
import { LivePriceCard } from './LivePrice'

describe('LivePriceCard', () => {
  it('renders connection states and ticks, then cleans up the subscription', () => {
    let emitTick: (tick: PriceTick) => void = () => undefined
    let emitStatus: (status: MarketStreamStatus) => void = () => undefined
    const unsubscribe = vi.fn()
    const marketStream: MarketStream = {
      subscribe(_symbol, onTick, onStatus) {
        emitTick = onTick
        emitStatus = onStatus ?? (() => undefined)
        return unsubscribe
      },
    }
    const view = render(
      <AppContextProvider value={context(marketStream)}><LivePriceCard symbol="AAPL" /></AppContextProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Connecting securely')

    act(() => emitStatus('reconnecting'))
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting')
    act(() => emitStatus('stale'))
    expect(screen.getByRole('status')).toHaveTextContent('Feed stale')
    act(() => emitTick({ symbol: 'AAPL', price: 230.88, timestamp: '2026-08-05T14:31:02Z' }))
    expect(screen.getByRole('status')).toHaveTextContent('$230.88')
    expect(screen.getByRole('status')).toHaveTextContent('Live')

    view.unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})

function context(marketStream: MarketStream) {
  return {
    marketStream,
    queryClient: new QueryClient(),
    api: {} as ApiClient,
    auth: {} as AuthAdapter,
  }
}
