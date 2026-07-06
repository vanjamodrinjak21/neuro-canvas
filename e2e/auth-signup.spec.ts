import { test, expect } from '@playwright/test'
import { makeTestUser, fillCredentials, submitAuthForm, signInViaUi } from './fixtures'

/**
 * Signup smoke: a brand-new account can be created through the signup form and
 * the user ends up authenticated.
 *
 * NOTE ON APP BEHAVIOUR: the signup page (`app/pages/auth/signup.vue`) posts to
 * `/api/auth/register` and then, on success, redirects to `/auth/signin` (it
 * does NOT auto-sign-in). "Lands authenticated" is therefore verified by
 * completing the sign-in with the just-created credentials and reaching the
 * protected `/dashboard`. This mirrors the real product flow.
 */
test.describe('signup', () => {
  test('new account can sign up and then reach an authenticated page', async ({ page }) => {
    const user = makeTestUser('signup')

    await page.goto('/auth/signup')
    // The form collects no display name — email + password + confirm only.
    await fillCredentials(page, user.email, user.password)
    await submitAuthForm(page)

    // Signup succeeds → the page shows a success message and routes to signin.
    await page.waitForURL('**/auth/signin', { timeout: 30_000 })

    // Now authenticate with the new credentials and confirm we land signed in.
    await signInViaUi(page, user)
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
