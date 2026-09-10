import { describe, expect, it, vi } from 'vitest'
import { createMarketStream } from './market-stream'

describe('market stream adapter', () => {
  it('uses a bearer header, parses quote ticks, and never places credentials in the URL', async () => {
    let cancel: () => void = () => undefined
    const finished = new Promise<void>(resolve => { cancel = resolve })
    const payload = JSON.stringify({
      id: 'event-1', symbol: 'BTC/USD', observed_at: '2026-08-05T12:00:00Z',
      payload: { bidPrice: '100', askPrice: '102' },
    })
    const request = vi.fn().mockResolvedValue(new Response(
      new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`id: event-1\nevent: quote\ndata: ${payload}\n\n`)) } }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    ))
    const stream = createMarketStream('https://stream.example', async () => 'private-token', request)
    let unsubscribe: () => void = () => undefined
    unsubscribe = stream.subscribe('btc/usd', tick => {
      expect(tick).toEqual({ symbol: 'BTC/USD', price: 101, timestamp: '2026-08-05T12:00:00Z' })
      unsubscribe()
      cancel()
    })
    await finished
    const [url, options] = request.mock.calls[0]
    expect(url).toBe('https://stream.example/v1/streams/BTC%2FUSD')
    expect(url).not.toContain('private-token')
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer private-token')
  })

  it('does not open an unauthenticated stream', async () => {
    const request = vi.fn()
    const statuses: string[] = []
    createMarketStream('https://stream.example', async () => null, request)
      .subscribe('AAPL', () => undefined, status => statuses.push(status))
    await Promise.resolve()
    expect(request).not.toHaveBeenCalled()
    expect(statuses).toEqual(['unauthorized'])
  })

  it('refreshes credentials and resumes from the last event after reconnecting', async () => {
    const first = eventPayload('event-1', 'AAPL', { bidPrice: '100', askPrice: '102' })
    const second = eventPayload('event-2', 'AAPL', { bidPrice: '102', askPrice: '104' })
    const request = vi.fn()
      .mockResolvedValueOnce(sseResponse([`id: event-1\nevent: quote\ndata: ${first}\n\n`]))
      .mockResolvedValueOnce(sseResponse([`id: event-2\nevent: quote\ndata: ${second}\n\n`]))
    const accessToken = vi.fn()
      .mockResolvedValueOnce('token-1')
      .mockResolvedValueOnce('token-2')
    const statuses: string[] = []
    const ticks: number[] = []
    const unsubscribe = createMarketStream('https://stream.example/', accessToken, request)
      .subscribe('aapl', tick => ticks.push(tick.price), status => statuses.push(status))

    await vi.waitFor(() => expect(ticks).toEqual([101, 103]), { timeout: 2_000 })
    unsubscribe()

    expect(request).toHaveBeenCalledTimes(2)
    expect(accessToken).toHaveBeenCalledTimes(2)
    const secondHeaders = request.mock.calls[1][1].headers as Headers
    expect(secondHeaders.get('Authorization')).toBe('Bearer token-2')
    expect(secondHeaders.get('Last-Event-ID')).toBe('event-1')
    expect(statuses).toEqual(['connecting', 'live', 'reconnecting', 'live'])
  })

  it('ignores malformed events, reports stale feeds, and continues the same connection', async () => {
    const bar = eventPayload('event-2', 'AAPL', { close: '231.45' })
    const request = vi.fn().mockResolvedValue(sseResponse([
      'event: quote\ndata: {not-json}\n\n',
      'event: stale\ndata: {"reason":"provider_timeout"}\n\n',
      `id: event-2\nevent: bar\ndata: ${bar}\n\n`,
    ]))
    const statuses: string[] = []
    const ticks: number[] = []
    let unsubscribe: () => void = () => undefined
    unsubscribe = createMarketStream('https://stream.example', async () => 'token', request)
      .subscribe('AAPL', tick => { ticks.push(tick.price); unsubscribe() }, status => statuses.push(status))

    await vi.waitFor(() => expect(ticks).toEqual([231.45]))

    expect(request).toHaveBeenCalledTimes(1)
    expect(statuses).toEqual(['connecting', 'live', 'stale'])
  })

  it('stops retrying after the server rejects authentication', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    const statuses: string[] = []
    createMarketStream('https://stream.example', async () => 'expired-token', request)
      .subscribe('AAPL', () => undefined, status => statuses.push(status))

    await vi.waitFor(() => expect(statuses).toEqual(['connecting', 'unauthorized']))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed symbols before obtaining credentials', () => {
    const accessToken = vi.fn()
    expect(() => createMarketStream('https://stream.example', accessToken, vi.fn())
      .subscribe('AAPL;token=secret', () => undefined)).toThrow('Invalid market symbol')
    expect(accessToken).not.toHaveBeenCalled()
  })
})

function eventPayload(id: string, symbol: string, payload: Record<string, unknown>) {
  return JSON.stringify({ id, symbol, observed_at: '2026-08-05T12:00:00Z', payload })
}

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}
