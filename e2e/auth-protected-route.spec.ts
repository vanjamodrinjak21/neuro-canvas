import { test, expect } from '@playwright/test'

/**
 * Protected-route middleware smoke: hitting a page that declares
 * `middleware: 'auth'` while signed out redirects to the sign-in page.
 *
 * `/dashboard` uses `middleware: 'auth'`. Because the app is an SPA
 * (`ssr: false`), the redirect happens client-side via `navigateTo`, so we
 * wait for the client router to land on `/auth/signin`.
 */
test.describe('protected-route middleware', () => {
  test('unauthenticated visit to a protected page redirects to signin', async ({ page }) => {
    // Fresh context (no signed-in cookie): the `page` fixture starts clean.
    await page.goto('/dashboard')

    await page.waitForURL('**/auth/signin', { timeout: 30_000 })
    await expect(page).toHaveURL(/\/auth\/signin/)

    // Sanity: the sign-in form is actually rendered, not a blank shell.
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('a second protected page (/settings) also redirects when signed out', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForURL('**/auth/signin', { timeout: 30_000 })
    await expect(page).toHaveURL(/\/auth\/signin/)
  })
})
