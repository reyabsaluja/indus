import { z } from 'zod'

export interface PriceTick { symbol: string; price: number; timestamp: string }
export type MarketStreamStatus = 'connecting' | 'live' | 'stale' | 'reconnecting' | 'unauthorized'
export interface MarketStream {
  subscribe(symbol: string, onTick: (tick: PriceTick) => void, onStatus?: (status: MarketStreamStatus) => void): () => void
}

export const unavailableMarketStream: MarketStream = {
  subscribe(_symbol, _onTick, onStatus) { onStatus?.('stale'); return () => undefined },
}

const liveEventSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  observed_at: z.iso.datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()),
})

export function createMarketStream(baseUrl: string, accessToken: () => Promise<string | null>, request: typeof fetch = fetch): MarketStream {
  const endpoint = baseUrl.replace(/\/$/, '')
  return {
    subscribe(rawSymbol, onTick, onStatus) {
      const symbol = normalizeSymbol(rawSymbol)
      const controller = new AbortController()
      let lastEventId: string | undefined
      void connect()
      return () => controller.abort()

      async function connect() {
        let attempt = 0
        while (!controller.signal.aborted) {
          const token = await accessToken()
          if (!token) {
            onStatus?.('unauthorized')
            return
          }
          onStatus?.(attempt === 0 ? 'connecting' : 'reconnecting')
          try {
            const headers = new Headers({ Accept: 'text/event-stream', Authorization: `Bearer ${token}` })
            if (lastEventId) headers.set('Last-Event-ID', lastEventId)
            const response = await request(`${endpoint}/v1/streams/${encodeURIComponent(symbol)}`, {
              headers,
              signal: controller.signal,
            })
            if (response.status === 401) { onStatus?.('unauthorized'); return }
            if (!response.ok || !response.body) throw new Error(`stream failed with ${response.status}`)
            attempt = 0
            onStatus?.('live')
            for await (const event of decodeSse(response.body, controller.signal)) {
              if (event.id) lastEventId = event.id
              if (event.type === 'stale') { onStatus?.('stale'); continue }
              if (event.type !== 'bar' && event.type !== 'quote') continue
              const payload = parseJson(event.data)
              if (payload === undefined) continue
              const parsed = liveEventSchema.safeParse(payload)
              if (!parsed.success) continue
              const price = event.type === 'bar'
                ? Number(parsed.data.payload.close)
                : midpoint(parsed.data.payload.bidPrice, parsed.data.payload.askPrice)
              if (!Number.isFinite(price)) continue
              onTick({ symbol: parsed.data.symbol, price, timestamp: parsed.data.observed_at })
            }
          } catch {
            if (controller.signal.aborted) return
          }
          attempt += 1
          await abortableDelay(Math.min(10_000, 250 * 2 ** Math.min(attempt, 5)), controller.signal)
        }
      }
    },
  }
}

function parseJson(value: string): unknown | undefined {
  try { return JSON.parse(value) }
  catch { return undefined }
}

interface SseMessage { id?: string; type: string; data: string }

async function* decodeSse(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<SseMessage> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const event = parseBlock(block)
        if (event) yield event
        boundary = buffer.indexOf('\n\n')
      }
      if (done) return
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function parseBlock(block: string): SseMessage | null {
  let id: string | undefined
  let type = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue
    const separator = line.indexOf(':')
    const field = separator < 0 ? line : line.slice(0, separator)
    const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '')
    if (field === 'id') id = value
    else if (field === 'event') type = value
    else if (field === 'data') data.push(value)
  }
  return data.length > 0 ? { id, type, data: data.join('\n') } : null
}

function midpoint(bid: unknown, ask: unknown): number {
  const bidNumber = Number(bid)
  const askNumber = Number(ask)
  return (bidNumber + askNumber) / 2
}

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase()
  if (!/^[A-Z0-9.-]+(?:\/[A-Z0-9.-]+)?$/.test(symbol) || symbol.length > 20) throw new Error('Invalid market symbol')
  return symbol
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timeout = setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => { clearTimeout(timeout); resolve() }, { once: true })
  })
}
