/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { favoritePageSchema, fundamentalsSchema, instrumentPageSchema, portfolioPageSchema, reportPageSchema, userSchema } from './api'

const generatedRoot = resolve(process.cwd(), '../../contracts/generated/openapi/typescript')
const readGenerated = (path: string) => readFileSync(resolve(generatedRoot, path), 'utf8')

const modelFields: Record<string, string[]> = {
  'models/InstrumentSearchResult.ts': ['symbol', 'name', 'instrument_type', 'exchange'],
  'models/Favorite.ts': ['id', 'symbol', 'instrument_type', 'created_at'],
  'models/Portfolio.ts': ['id', 'name', 'base_currency', 'created_at', 'updated_at'],
  'models/Report.ts': ['id', 'symbol', 'portfolio_id', 'title', 'status', 'failure_code', 'created_at', 'updated_at'],
  'models/Fundamentals.ts': ['symbol', 'as_of', 'source', 'metrics'],
  'models/User.ts': ['id', 'email', 'display_name', 'created_at', 'updated_at'],
}

const endpoints: Record<string, string[]> = {
  'apis/InstrumentsApi.ts': ['`/v1/instruments/search`', "method: 'GET'"],
  'apis/FundamentalsApi.ts': ['`/v1/fundamentals/{symbol}`', "method: 'GET'"],
  'apis/FavoritesApi.ts': ['`/v1/favorites`', "method: 'POST'", "headerParameters['Idempotency-Key']"],
  'apis/PortfoliosApi.ts': ['`/v1/portfolios`', "method: 'POST'", "headerParameters['Idempotency-Key']"],
  'apis/ReportsApi.ts': ['`/v1/reports`', "method: 'POST'", "headerParameters['Idempotency-Key']"],
  'apis/IdentityApi.ts': ['`/v1/me`', "method: 'PATCH'", "headerParameters['Idempotency-Key']"],
}

describe('hand-maintained Rails wire adapter', () => {
  it('tracks every generated response wire field used by the application', () => {
    for (const [path, fields] of Object.entries(modelFields)) {
      const generated = readGenerated(path)
      for (const field of fields) expect(generated, `${path} no longer maps ${field}`).toContain(`'${field}':`)
    }
  })

  it('tracks generated endpoint paths, methods, and idempotency requirements', () => {
    for (const [path, fragments] of Object.entries(endpoints)) {
      const generated = readGenerated(path)
      for (const fragment of fragments) expect(generated, `${path} no longer contains ${fragment}`).toContain(fragment)
    }
  })

  it('accepts generated-contract fixtures and rejects application-cased wire drift', () => {
    const at = '2026-08-05T12:00:00.000Z'; const id = '00000000-0000-4000-8000-000000000001'
    expect(instrumentPageSchema.safeParse({ next_cursor: null, items: [{ symbol: 'BTC/USD', name: 'Bitcoin', instrument_type: 'crypto' }] }).success).toBe(true)
    expect(favoritePageSchema.safeParse({ next_cursor: null, items: [{ id, symbol: 'BTC/USD', instrument_type: 'crypto', created_at: at }] }).success).toBe(true)
    expect(portfolioPageSchema.safeParse({ next_cursor: null, items: [{ id, name: 'Core', base_currency: 'USD', created_at: at, updated_at: at }] }).success).toBe(true)
    expect(reportPageSchema.safeParse({ next_cursor: null, items: [{ id, symbol: 'AAPL', title: 'Apple research', status: 'queued', created_at: at, updated_at: at }] }).success).toBe(true)
    expect(fundamentalsSchema.safeParse({ symbol: 'AAPL', as_of: at, source: 'provider', metrics: {} }).success).toBe(true)
    expect(userSchema.safeParse({ id, email: 'user@example.test', display_name: 'Investor', created_at: at, updated_at: at }).success).toBe(true)
    expect(userSchema.safeParse({ id, email: 'user@example.test', displayName: 'drifted', createdAt: at, updatedAt: at }).success).toBe(false)
  })
})
