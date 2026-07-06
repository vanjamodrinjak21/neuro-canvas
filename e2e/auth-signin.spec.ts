import { test, expect } from '@playwright/test'
import {
  makeTestUser,
  registerUser,
  signInViaUi,
  fillCredentials,
  submitAuthForm,
} from './fixtures'

/**
 * Sign-in smoke suite: wrong password rejected, correct password authenticates,
 * and the session survives a full page reload.
 */
test.describe('signin', () => {
  test('wrong password is rejected and stays on the signin page', async ({ page, request }) => {
    const user = makeTestUser('badpw')
    await registerUser(request, user)

    await page.goto('/auth/signin')
    await fillCredentials(page, user.email, `${user.password}WRONG`)
    await submitAuthForm(page)

    // Must NOT navigate to the dashboard. Give the SPA a beat to (not) redirect.
    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/auth\/signin/)

    // An error must be surfaced to the user. The app renders a `.form-message`
    // with the "invalid credentials" copy; assert an error message is visible
    // without pinning to a specific (i18n) string.
    const errorMessage = page.locator('.form-message.error')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).not.toHaveText('')
  })

  test('correct password reaches the authenticated dashboard', async ({ page, request }) => {
    const user = makeTestUser('goodpw')
    await registerUser(request, user)

    await signInViaUi(page, user)

    await expect(page).toHaveURL(/\/dashboard/)
    // The session endpoint must now report an authenticated user.
    const session = await page.request.get('/api/auth/session').then((r) => r.json())
    expect(session?.user?.email).toBe(user.email)
  })

  test('session persists across a full reload', async ({ page, request }) => {
    const user = makeTestUser('persist')
    await registerUser(request, user)
    await signInViaUi(page, user)
    await expect(page).toHaveURL(/\/dashboard/)

    // Hard reload — the auth middleware re-runs getSession() on the fresh load.
    await page.reload()

    // Still authenticated: we stay on the protected route, not bounced to
    // signin. NOT `networkidle` — the dev server keeps an HMR websocket open,
    // so network-idle never fires and the wait times out (AER-74).
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    const session = await page.request.get('/api/auth/session').then((r) => r.json())
    expect(session?.user?.email).toBe(user.email)
  })
})
