import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type AuthUser = Pick<User, 'id' | 'email'>

export interface AuthAdapter {
  getUser(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  accessToken(): Promise<string | null>
}

class SupabaseAuthAdapter implements AuthAdapter {
  private readonly client: SupabaseClient
  constructor(client: SupabaseClient) { this.client = client }
  async getUser() { return (await this.client.auth.getUser()).data.user }
  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  async signOut() { const { error } = await this.client.auth.signOut(); if (error) throw error }
  async accessToken() { return (await this.client.auth.getSession()).data.session?.access_token ?? null }
}

class UnconfiguredAuthAdapter implements AuthAdapter {
  async getUser() { return null }
  async signIn() { throw new Error('Authentication is not configured for this environment.') }
  async signOut() {}
  async accessToken() { return null }
}

const E2E_AUTH_KEY = 'indus:e2e-auth'
const browserStorage = () => globalThis.window?.localStorage

class E2eAuthAdapter implements AuthAdapter {
  async getUser() { return browserStorage()?.getItem(E2E_AUTH_KEY) === 'true' ? { id: 'e2e-user', email: 'investor@example.test' } : null }
  async signIn() { browserStorage()?.setItem(E2E_AUTH_KEY, 'true') }
  async signOut() { browserStorage()?.removeItem(E2E_AUTH_KEY) }
  async accessToken() { return browserStorage()?.getItem(E2E_AUTH_KEY) === 'true' ? 'e2e-access-token' : null }
}

export function createAuthAdapter(): AuthAdapter {
  if (import.meta.env.VITE_E2E_AUTH === 'true') return new E2eAuthAdapter()
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return url && key ? new SupabaseAuthAdapter(createClient(url, key)) : new UnconfiguredAuthAdapter()
}
