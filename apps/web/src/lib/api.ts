import { z, type ZodType } from 'zod'

export class ApiError extends Error {
  readonly status: number
  readonly requestId?: string
  constructor(message: string, status: number, requestId?: string) { super(message); this.status = status; this.requestId = requestId }
}

export interface ApiClient {
  get<T>(path: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T>
  mutate<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown, schema: ZodType<T>, idempotencyKey: string, signal?: AbortSignal): Promise<T>
}

export function createApiClient(baseUrl: string, token: () => Promise<string | null>): ApiClient {
  const request = async <T>(path: string, schema: ZodType<T>, options: RequestInit = {}) => {
    const accessToken = await token()
    const response = await fetch(new URL(path, baseUrl), {
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
    })
    if (!response.ok) throw new ApiError('The request could not be completed.', response.status, response.headers.get('x-request-id') ?? undefined)
    return schema.parse(response.status === 204 ? undefined : await response.json())
  }
  return {
    get: (path, schema, signal) => request(path, schema, { signal }),
    mutate: (path, method, body, schema, idempotencyKey, signal) => request(path, schema, { method, signal, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'Idempotency-Key': idempotencyKey } }),
  }
}

export const marketSummarySchema = z.object({
  indices: z.array(z.object({ symbol: z.string(), price: z.number(), changePercent: z.number() })),
  watchlist: z.array(z.object({ symbol: z.string(), name: z.string(), price: z.number(), changePercent: z.number() })),
})
export type MarketSummary = z.infer<typeof marketSummarySchema>

const dateTime = z.string().datetime()
const page = <T extends z.ZodType>(item: T) => z.object({ next_cursor: z.string().nullable(), items: z.array(item) })
export const instrumentSchema = z.object({ symbol: z.string(), name: z.string(), instrument_type: z.enum(['equity', 'crypto']), exchange: z.string().optional() })
export const instrumentPageSchema = page(instrumentSchema)
export const favoriteSchema = z.object({ id: z.string().uuid(), symbol: z.string(), instrument_type: z.enum(['equity', 'crypto']), created_at: dateTime })
export const favoritePageSchema = page(favoriteSchema)
export const portfolioSchema = z.object({ id: z.string().uuid(), name: z.string(), base_currency: z.string().length(3), created_at: dateTime, updated_at: dateTime })
export const portfolioPageSchema = page(portfolioSchema)
export const reportSchema = z.object({ id: z.string().uuid(), symbol: z.string(), portfolio_id: z.string().uuid().nullable().optional(), title: z.string(), status: z.enum(['queued', 'generating', 'completed', 'failed', 'cancelled']), failure_code: z.string().nullable().optional(), created_at: dateTime, updated_at: dateTime })
export const reportPageSchema = page(reportSchema)
export type Report = z.infer<typeof reportSchema>
export type ReportPage = z.infer<typeof reportPageSchema>
export const fundamentalsSchema = z.object({ symbol: z.string(), as_of: dateTime, source: z.string(), metrics: z.record(z.string(), z.union([z.number(), z.string(), z.null()])) })
export const userSchema = z.object({ id: z.string().uuid(), email: z.string().email(), display_name: z.string(), created_at: dateTime, updated_at: dateTime })

// This thin wire adapter mirrors the generated OpenAPI model names while keeping JSON casing explicit.
export const favoriteRequest = (value: { symbol: string; instrumentType: 'equity' | 'crypto' }) => ({ symbol: value.symbol, instrument_type: value.instrumentType })
export const portfolioRequest = (value: { name: string; baseCurrency: string }) => ({ name: value.name, base_currency: value.baseCurrency })
export const reportRequest = (value: { symbol: string; portfolioId?: string; focus?: string }) => ({ symbol: value.symbol, ...(value.portfolioId ? { portfolio_id: value.portfolioId } : {}), ...(value.focus ? { focus: value.focus } : {}) })
export const userUpdateRequest = (value: { displayName?: string }) => ({ display_name: value.displayName })
