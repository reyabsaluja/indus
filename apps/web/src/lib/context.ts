import type { QueryClient } from '@tanstack/react-query'
import type { ApiClient } from './api'
import type { AuthAdapter } from './auth'
import type { MarketStream } from './market-stream'

export interface AppContext { queryClient: QueryClient; api: ApiClient; auth: AuthAdapter; marketStream: MarketStream }
