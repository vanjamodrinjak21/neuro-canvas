import { test, expect, request as playwrightRequest } from '@playwright/test'
import {
  makeTestUser,
  registerUser,
  signInViaUi,
  getSessionCookie,
  requestContextOptions,
} from './fixtures'

/**
 * CROWN JEWEL (AER-59): server-side session revocation.
 *
 * Proves the end-to-end contract that a raw JWT captured before logout is
 * REJECTED (401) by `requireAuthSession` after `POST /api/auth/logout` bumps the
 * user's `sessionsValidFrom` watermark. This is the regression that broke
 * before: client-side signOut cleared the cookie but a stolen/cached copy of the
 * token stayed valid until its natural exp.
 *
 * We hold the OLD session token in a standalone APIRequestContext (independent
 * of the browser's cookie jar) so that clearing the browser session can't
 * confound the result — we are testing the token itself, server-side.
 */
test.describe('logout server revocation', () => {
  test('old session token is 401 on an authenticated route after logout', async ({ page, request, baseURL }) => {
    const user = makeTestUser('revoke')
    await registerUser(request, user)
    await signInViaUi(page, user)
    await expect(page).toHaveURL(/\/dashboard/)

    // Capture the raw session JWT cookie minted at sign-in.
    const sessionCookie = await getSessionCookie(page)
    const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}`

    // A context that sends ONLY the captured token — this is "the old token".
    const oldToken = await playwrightRequest.newContext(
      requestContextOptions(baseURL, { cookie: cookieHeader }),
    )

    try {
      // 1. Baseline: the token is accepted on a protected API route.
      const before = await oldToken.get('/api/user/profile')
      expect(
        before.status(),
        `expected profile 200 before logout, got ${before.status()}: ${await before.text()}`,
      ).toBe(200)
      const profile = (await before.json()) as { email?: string }
      expect(profile.email).toBe(user.email)

      // sessionsValidFrom is compared (seconds) against the token's iat with a
      // strict `>`; if sign-in and logout land in the same wall-clock second the
      // revocation would be a no-op. Pause past the second boundary so the epoch
      // is unambiguously AFTER the token was issued.
      await page.waitForTimeout(1_500)

      // 2. Revoke: bump the user's sessionsValidFrom to now. Must carry the
      // cookie so the endpoint can resolve the user via getToken().
      const logout = await oldToken.post('/api/auth/logout')
      expect(
        logout.status(),
        `logout should be 200 (idempotent), got ${logout.status()}`,
      ).toBe(200)
      expect(((await logout.json()) as { ok?: boolean }).ok).toBeTruthy()

      // 3. The crown assertion: the SAME old token is now rejected.
      const after = await oldToken.get('/api/user/profile')
      expect(
        after.status(),
        `old token should be 401 after logout, got ${after.status()}`,
      ).toBe(401)
    } finally {
      await oldToken.dispose()
    }
  })
})
