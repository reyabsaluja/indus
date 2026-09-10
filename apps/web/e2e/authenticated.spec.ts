import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => localStorage.setItem('indus:e2e-auth', 'true'))
  await page.route('**/v1/market/summary', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      indices: [{ symbol: 'SPY', price: 542.1, changePercent: 0.62 }],
      watchlist: [{ symbol: 'AAPL', name: 'Apple Inc.', price: 228.12, changePercent: 1.08 }],
    }),
  }))
  await page.route('**/v1/reports?*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ next_cursor: null, items: [{ id: '00000000-0000-4000-8000-000000000004', symbol: 'MSFT', title: 'Microsoft research', status: 'completed', created_at: '2026-08-05T12:00:00.000Z', updated_at: '2026-08-05T12:00:00.000Z' }] }),
  }))
  await page.route('**/v1/instruments/search?*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ next_cursor: null, items: [{ symbol: 'BTC/USD', name: 'Bitcoin', instrument_type: 'crypto', exchange: 'Alpaca' }] }),
  }))
})

test('renders an authenticated dashboard using the Rails contract', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Good morning' })).toBeVisible()
  await expect(page.getByRole('link', { name: /AAPL/ })).toBeVisible()
})

test('renders queryless crypto navigation', async ({ page }) => {
  await page.goto('/crypto')
  await expect(page).toHaveURL(/\/crypto$/)
  await expect(page.getByRole('heading', { name: 'Crypto markets', exact: true })).toBeVisible()
  await expect(page.getByText('Bitcoin')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Live prices are unavailable')
})

test('renders authenticated reports navigation', async ({ page }) => {
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible()
  await expect(page.getByText('Microsoft research')).toBeVisible()
})

test('authenticated dashboard has no serious accessibility violations', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Good morning' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])
})
