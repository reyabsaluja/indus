import { createContext, useContext, type ReactNode } from 'react'
import type { AppContext } from './lib/context'

const Context = createContext<AppContext | null>(null)
export function AppContextProvider({ value, children }: { value: AppContext; children: ReactNode }) { return <Context value={value}>{children}</Context> }
// oxlint-disable-next-line react/only-export-components -- the hook and provider intentionally share a private context
export function useAppContext() { const value = useContext(Context); if (!value) throw new Error('App context is unavailable'); return value }
