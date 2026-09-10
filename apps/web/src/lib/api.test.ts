import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from './api'

describe('Rails API client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('adds a bearer token and validates successful responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 42 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await createApiClient('https://api.example.test', async () => 'access-token').get('/v1/value', z.object({ value: z.number() }))
    expect(result).toEqual({ value: 42 })
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://api.example.test/v1/value'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-token' }) }))
  })

  it('does not send an authorization header for anonymous requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await createApiClient('https://api.example.test', async () => null).get('/health', z.object({ ok: z.boolean() }))
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ Accept: 'application/json' })
  })

  it('exposes bounded error metadata without leaking provider payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive upstream body', { status: 503, headers: { 'x-request-id': 'req-1' } })))
    const request = createApiClient('https://api.example.test', async () => null).get('/v1/value', z.unknown())
    const error = await request.catch(cause => cause)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ message: 'The request could not be completed.', status: 503, requestId: 'req-1' })
  })

  it('rejects responses that violate the shared schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: '42' }), { status: 200 })))
    await expect(createApiClient('https://api.example.test', async () => null).get('/v1/value', z.object({ value: z.number() }))).rejects.toBeInstanceOf(z.ZodError)
  })

  it('sends JSON mutations with a caller-stable idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'created' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await createApiClient('https://api.example.test', async () => 'token').mutate('/v1/resources', 'POST', { name: 'Core' }, z.object({ id: z.string() }), 'mutation-1')
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://api.example.test/v1/resources'), expect.objectContaining({ method: 'POST', body: '{"name":"Core"}', headers: expect.objectContaining({ 'Content-Type': 'application/json', 'Idempotency-Key': 'mutation-1' }) }))
  })

  it('supports empty delete responses without parsing JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(createApiClient('https://api.example.test', async () => 'token').mutate('/v1/resources/1', 'DELETE', undefined, z.undefined(), 'mutation-2')).resolves.toBeUndefined()
  })

  it('does not make a request when token resolution fails', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(createApiClient('https://api.example.test', async () => { throw new Error('identity unavailable') })
      .get('/v1/value', z.unknown())).rejects.toThrow('identity unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propagates cancellation to reads and mutations', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const client = createApiClient('https://api.example.test', async () => 'token')

    await client.get('/v1/value', z.object({ ok: z.boolean() }), controller.signal)
    await client.mutate('/v1/value', 'PATCH', { ok: true }, z.object({ ok: z.boolean() }), 'mutation-3', controller.signal)

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ signal: controller.signal }))
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ signal: controller.signal }))
  })

  it('never includes an error response body in the public error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"secret":"provider detail"}', { status: 429 })))

    const error = await createApiClient('https://api.example.test', async () => 'token')
      .get('/v1/value', z.unknown()).catch(cause => cause)

    expect(error).toMatchObject({ message: 'The request could not be completed.', status: 429 })
    expect(JSON.stringify(error)).not.toContain('provider detail')
  })

  it('keeps wire serializers in snake case and omits absent optional fields', async () => {
    const { favoriteRequest, portfolioRequest, reportRequest, userUpdateRequest } = await import('./api')

    expect(favoriteRequest({ symbol: 'BTC/USD', instrumentType: 'crypto' })).toEqual({ symbol: 'BTC/USD', instrument_type: 'crypto' })
    expect(portfolioRequest({ name: 'Core', baseCurrency: 'CAD' })).toEqual({ name: 'Core', base_currency: 'CAD' })
    expect(reportRequest({ symbol: 'AAPL' })).toEqual({ symbol: 'AAPL' })
    expect(JSON.parse(JSON.stringify(userUpdateRequest({})))).toEqual({})
  })
})
