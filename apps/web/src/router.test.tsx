import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppContextProvider } from './app-context'
import type { AppContext } from './lib/context'
import { unavailableMarketStream } from './lib/market-stream'
import { makeRouter } from './router'

const now = '2026-08-05T12:00:00.000Z'
function responseFor(path: string): unknown {
  if (path === '/v1/market/summary') return { indices: [], watchlist: [] }
  if (path.startsWith('/v1/fundamentals/')) return { symbol: 'AAPL', as_of: now, source: 'Yahoo Finance', metrics: { market_cap: 3_200_000_000_000 } }
  if (path === '/v1/me') return { id: '00000000-0000-4000-8000-000000000001', email: 'user@example.test', display_name: 'Avery Investor', created_at: now, updated_at: now }
  return { next_cursor: null, items: [] }
}

function context(authenticated: boolean, resolve: (path: string) => unknown | Promise<unknown> = responseFor, mutate: (path: string, method: string, body: unknown, idempotencyKey: string) => unknown | Promise<unknown> = (_path, _method, body) => body): AppContext {
  let authState = authenticated
  return {
    auth: {
      getUser: vi.fn(async () => authState ? { id: 'user-1', email: 'user@example.test' } : null),
      signIn: vi.fn(async () => { authState = true }),
      signOut: vi.fn(async () => { authState = false }),
      accessToken: vi.fn(async () => null),
    },
    api: {
      get: async (path, schema) => schema.parse(await resolve(path)),
      mutate: async (path, method, body, schema, idempotencyKey) => schema.parse(await mutate(path, method, body, idempotencyKey)),
    },
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } }),
    marketStream: unavailableMarketStream,
  }
}

async function renderPath(path: string, authenticated: boolean, resolve?: (path: string) => unknown | Promise<unknown>, mutate?: (path: string, method: string, body: unknown, idempotencyKey: string) => unknown | Promise<unknown>) {
  const value = context(authenticated, resolve, mutate)
  const router = makeRouter(value, createMemoryHistory({ initialEntries: [path] }))
  render(<AppContextProvider value={value}><QueryClientProvider client={value.queryClient}><RouterProvider router={router} /></QueryClientProvider></AppContextProvider>)
  await waitFor(() => expect(router.state.status).toBe('idle'))
  return router
}

describe('application routing', () => {
  it('redirects an anonymous user away from protected pages', async () => {
    const router = await renderPath('/reports', false)
    expect(router.state.location.pathname).toBe('/auth')
    expect(await screen.findByRole('heading', { name: 'Welcome to Indus' })).toBeVisible()
  })

  it('renders the authenticated dashboard with an empty watchlist state', async () => {
    await renderPath('/dashboard', true)
    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeVisible()
    expect(await screen.findByText('No instruments yet')).toBeVisible()
  })

  it('normalizes company symbols for display', async () => {
    await renderPath('/company/aapl', true)
    expect(await screen.findByRole('heading', { name: 'AAPL' })).toBeVisible()
    expect(screen.getByText(/Source: Yahoo Finance/)).toBeVisible()
  })

  it('renders loading and empty resource states', async () => {
    let release: ((value: unknown) => void) | undefined
    const pending = new Promise(resolve => { release = resolve })
    renderPath('/favorites', true, () => pending)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading data')
    release?.({ next_cursor: null, items: [] })
    expect(await screen.findByText('No favorites yet')).toBeVisible()
  })

  it('renders a bounded error state when a contract request fails', async () => {
    await renderPath('/portfolios', true, async () => { throw new Error('provider payload must not render') })
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Data is temporarily unavailable')
    expect(screen.queryByText(/provider payload/)).not.toBeInTheDocument()
  })

  it('renders successful favorite, portfolio, report, and settings contracts', async () => {
    const fixtures: Record<string, unknown> = {
      '/v1/favorites?page_size=100': { next_cursor: null, items: [{ id: '00000000-0000-4000-8000-000000000002', symbol: 'AAPL', instrument_type: 'equity', created_at: now }] },
      '/v1/portfolios?page_size=100': { next_cursor: null, items: [{ id: '00000000-0000-4000-8000-000000000003', name: 'Long term', base_currency: 'USD', created_at: now, updated_at: now }] },
      '/v1/reports?page_size=100': { next_cursor: null, items: [{ id: '00000000-0000-4000-8000-000000000004', symbol: 'MSFT', title: 'Microsoft research', status: 'completed', created_at: now, updated_at: now }] },
    }
    await renderPath('/favorites', true, path => fixtures[path] ?? responseFor(path))
    expect(await screen.findByText('AAPL')).toBeVisible()
    cleanupView()
    await renderPath('/portfolios', true, path => fixtures[path] ?? responseFor(path))
    expect(await screen.findByText('Long term')).toBeVisible()
    cleanupView()
    await renderPath('/reports', true, path => fixtures[path] ?? responseFor(path))
    expect(await screen.findByText('Microsoft research')).toBeVisible()
    cleanupView()
    await renderPath('/settings', true)
    expect(await screen.findByDisplayValue('Avery Investor')).toBeVisible()
  })

  it('submits searches to the bounded instrument endpoint', async () => {
    const resolver = vi.fn((path: string) => path.startsWith('/v1/instruments/search') ? { next_cursor: null, items: [{ symbol: 'NVDA', name: 'NVIDIA Corporation', instrument_type: 'equity', exchange: 'NASDAQ' }] } : responseFor(path))
    await renderPath('/search', true, resolver)
    fireEvent.change(screen.getByLabelText('Search instruments'), { target: { value: 'nvidia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('NVIDIA Corporation · NASDAQ')).toBeVisible()
    expect(resolver).toHaveBeenCalledWith('/v1/instruments/search?q=nvidia&page_size=20')
  })

  it('renders non-streaming crypto discovery from the instrument contract', async () => {
    const resolver = vi.fn((path: string) => path.startsWith('/v1/instruments/search') ? { next_cursor: null, items: [{ symbol: 'BTC/USD', name: 'Bitcoin', instrument_type: 'crypto', exchange: 'Alpaca' }, { symbol: 'COIN', name: 'Coinbase', instrument_type: 'equity' }] } : responseFor(path))
    await renderPath('/crypto', true, resolver)
    expect(await screen.findByText('Bitcoin')).toBeVisible()
    expect(screen.queryByText('Coinbase')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Live prices are unavailable in Phase 2')
    expect(resolver).toHaveBeenCalledWith('/v1/instruments/search?q=crypto&page_size=20')
  })

  it('invokes an idempotent Rails mutation from the favorites view', async () => {
    const mutation = vi.fn(() => ({ id: '00000000-0000-4000-8000-000000000005', symbol: 'TSLA', instrument_type: 'equity', created_at: now }))
    await renderPath('/favorites', true, undefined, mutation)
    await screen.findByText('No favorites yet')
    fireEvent.change(screen.getByLabelText('Symbol'), { target: { value: 'tsla' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(mutation).toHaveBeenCalled())
    expect(mutation).toHaveBeenCalledWith('/v1/favorites', 'POST', { symbol: 'TSLA', instrument_type: 'equity' }, expect.stringMatching(/^[0-9a-f-]{36}$/))
  })

  it('deletes a favorite by its unambiguous resource identifier', async () => {
    const id = '00000000-0000-4000-8000-000000000002'
    const mutation = vi.fn(() => undefined)
    await renderPath('/favorites', true, path => path === '/v1/favorites?page_size=100'
      ? { next_cursor: null, items: [{ id, symbol: 'AAPL', instrument_type: 'equity', created_at: now }] }
      : responseFor(path), mutation)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(mutation).toHaveBeenCalled())
    expect(mutation).toHaveBeenCalledWith(`/v1/favorites/${id}`, 'DELETE', undefined, expect.stringMatching(/^[0-9a-f-]{36}$/))
  })

  it('redirects an authenticated user away from the sign-in page', async () => {
    const router = await renderPath('/auth', true)

    expect(router.state.location.pathname).toBe('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeVisible()
  })

  it('completes the sign-in and sign-out navigation lifecycle', async () => {
    const router = await renderPath('/auth', false)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'investor@example.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }))

    expect(await screen.findByRole('heading', { name: 'Good morning' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/auth'))
  })

  it('renders a stable not-found boundary', async () => {
    await renderPath('/not-a-route', false)

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Return to dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('renders a bounded mutation error without provider detail', async () => {
    await renderPath('/favorites', true, undefined, async () => { throw new Error('sensitive provider detail') })
    await screen.findByText('No favorites yet')
    fireEvent.change(screen.getByLabelText('Symbol'), { target: { value: 'AAPL' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The favorite could not be updated')
    expect(screen.queryByText(/sensitive provider detail/)).not.toBeInTheDocument()
  })

  it('retries a failed read through the visible recovery control', async () => {
    let attempts = 0
    const resolver = vi.fn((path: string) => {
      if (path === '/v1/market/summary' && attempts++ < 2) throw new Error('temporary outage')
      return responseFor(path)
    })
    await renderPath('/dashboard', true, resolver)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('No instruments yet')).toBeVisible()
    expect(resolver).toHaveBeenCalledTimes(3)
  })

  it('sends a bounded idempotent profile update', async () => {
    const mutation = vi.fn((_path: string, _method: string, body: unknown) => ({
      ...responseFor('/v1/me') as object,
      display_name: (body as { display_name: string }).display_name,
    }))
    await renderPath('/settings', true, undefined, mutation)
    fireEvent.change(await screen.findByLabelText('Display name'), { target: { value: 'Updated Investor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mutation).toHaveBeenCalled())
    expect(mutation).toHaveBeenCalledWith('/v1/me', 'PATCH', { display_name: 'Updated Investor' }, expect.stringMatching(/^[0-9a-f-]{36}$/))
    expect(await screen.findByDisplayValue('Updated Investor')).toBeVisible()
  })
})

function cleanupView() { cleanup() }
