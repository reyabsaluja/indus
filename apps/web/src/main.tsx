import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { createApiClient } from './lib/api'
import { createAuthAdapter } from './lib/auth'
import { unavailableMarketStream } from './lib/market-stream'
import { AppContextProvider } from './app-context'
import { makeRouter } from './router'

const auth = createAuthAdapter()
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })
const api = createApiClient(import.meta.env.VITE_API_URL ?? window.location.origin, () => auth.accessToken())
const context = { auth, queryClient, api, marketStream: unavailableMarketStream }
const router = makeRouter(context)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppContextProvider value={context}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppContextProvider>
  </StrictMode>,
)
