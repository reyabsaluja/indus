import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthAdapter } from './auth'

describe('authentication adapter selection', () => {
  afterEach(() => { vi.unstubAllEnvs(); window.localStorage.clear() })

  it('fails closed when identity configuration and the test flag are absent', async () => {
    vi.stubEnv('VITE_E2E_AUTH', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const auth = createAuthAdapter()
    expect(await auth.getUser()).toBeNull()
    expect(await auth.accessToken()).toBeNull()
    await expect(auth.signIn('user@example.test', 'password')).rejects.toThrow('Authentication is not configured')
  })

  it('requires both the build flag and explicit browser opt-in for test identity', async () => {
    vi.stubEnv('VITE_E2E_AUTH', 'true')
    const auth = createAuthAdapter()
    expect(await auth.getUser()).toBeNull()
    window.localStorage.setItem('indus:e2e-auth', 'true')
    expect(await auth.getUser()).toEqual({ id: 'e2e-user', email: 'investor@example.test' })
    expect(await auth.accessToken()).toBe('e2e-access-token')
  })

  it('supports the complete local E2E sign-in and sign-out lifecycle', async () => {
    vi.stubEnv('VITE_E2E_AUTH', 'true')
    const auth = createAuthAdapter()

    await auth.signIn('ignored@example.test', 'ignored')
    expect(await auth.getUser()).toEqual({ id: 'e2e-user', email: 'investor@example.test' })
    expect(await auth.accessToken()).toBe('e2e-access-token')

    await auth.signOut()
    expect(await auth.getUser()).toBeNull()
    expect(await auth.accessToken()).toBeNull()
  })
})
