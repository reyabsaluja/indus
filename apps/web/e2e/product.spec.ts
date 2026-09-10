import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const emptyPage = { next_cursor: null, items: [] }

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('indus:e2e-auth', 'true'))
})

test('sends the favorite mutation contract and an idempotency key', async ({ page }) => {
  let mutation: { body: unknown; idempotencyKey: string | null } | undefined
  await page.route('**/v1/favorites*', async route => {
    const request = route.request()
    if (request.method() === 'POST') {
      mutation = {
        body: request.postDataJSON(),
        idempotencyKey: await request.headerValue('idempotency-key'),
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000005',
          symbol: 'TSLA',
          instrument_type: 'equity',
          created_at: '2026-08-05T12:00:00.000Z',
        }),
      })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(emptyPage) })
  })

  await page.goto('/favorites')
  await expect(page.getByText('No favorites yet')).toBeVisible()
  await page.getByLabel('Symbol').fill('tsla')
  await page.getByRole('button', { name: 'Add' }).click()

  await expect.poll(() => mutation).toBeDefined()
  expect(mutation?.body).toEqual({ symbol: 'TSLA', instrument_type: 'equity' })
  expect(mutation?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  await expect(page.getByLabel('Symbol')).toHaveValue('')
})

test('bounds a failed API response and recovers through the visible retry', async ({ page }) => {
  let attempts = 0
  await page.route('**/v1/market/summary', route => {
    attempts += 1
    if (attempts <= 2) {
      return route.fulfill({ status: 503, contentType: 'text/plain', body: 'sensitive provider outage detail' })
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ indices: [], watchlist: [] }),
    })
  })

  await page.goto('/dashboard')
  await expect(page.getByRole('alert')).toContainText('Data is temporarily unavailable', { timeout: 10_000 })
  await expect(page.getByText(/sensitive provider outage detail/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry' }).click()

  await expect(page.getByText('No instruments yet')).toBeVisible()
  expect(attempts).toBe(3)
})

test('supports navigation at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/v1/market/summary', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ indices: [], watchlist: [] }),
  }))
  await page.route('**/v1/reports?*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(emptyPage),
  }))

  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Reports' })).toBeHidden()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible()
  await page.getByRole('link', { name: 'Reports' }).click()

  await expect(page).toHaveURL(/\/reports$/)
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
})

test('company research has no serious accessibility violations', async ({ page }) => {
  await page.route('**/v1/fundamentals/AAPL', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      symbol: 'AAPL',
      as_of: '2026-08-05T12:00:00.000Z',
      source: 'Yahoo Finance',
      metrics: { market_cap: 3_200_000_000_000, trailing_pe: 31.2 },
    }),
  }))

  await page.goto('/company/aapl')
  await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])
})

test('keeps the not-found boundary stable for an authenticated session', async ({ page }) => {
  await page.goto('/not-a-route')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Return to dashboard' })).toHaveAttribute('href', '/dashboard')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
