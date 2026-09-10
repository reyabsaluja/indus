import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('protected routes fail closed to sign in', async ({ page }) => {
  await page.goto('/reports')
  await expect(page).toHaveURL(/\/auth(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: 'Welcome to Indus' })).toBeVisible()
})

test('signs in and signs out through the browser auth adapter', async ({ page }) => {
  await page.route('**/v1/market/summary', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ indices: [], watchlist: [] }),
  }))

  await page.goto('/auth')
  await page.getByLabel('Email').fill('investor@example.test')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in securely' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Good morning' })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByRole('heading', { name: 'Welcome to Indus' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('indus:e2e-auth'))).toBeNull()

  await page.goto('/reports')
  await expect(page).toHaveURL(/\/auth(?:\?.*)?$/)
})

test('sign-in surface has no serious accessibility violations', async ({ page }) => {
  await page.goto('/auth')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])
})

test('sign-in shell stays within its local performance budget', async ({ page }) => {
  const started = Date.now()
  await page.goto('/auth')
  await expect(page.getByRole('button', { name: 'Sign in securely' })).toBeVisible()
  expect(Date.now() - started).toBeLessThan(3_000)
})
