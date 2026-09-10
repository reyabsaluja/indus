import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

window.scrollTo = vi.fn()

const stored = new Map<string, string>()
const memoryStorage: Storage = {
  get length() { return stored.size },
  clear: () => stored.clear(),
  getItem: key => stored.get(key) ?? null,
  key: index => [...stored.keys()][index] ?? null,
  removeItem: key => { stored.delete(key) },
  setItem: (key, value) => { stored.set(key, value) },
}
Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage })

afterEach(cleanup)
