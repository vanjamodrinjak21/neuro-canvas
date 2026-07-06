import { randomUUID } from 'node:crypto'
import type { APIRequest, APIRequestContext, Cookie, Page } from '@playwright/test'
import { expect } from '@playwright/test'

type NewContextOptions = Parameters<APIRequest['newContext']>[0]

/**
 * Build APIRequestContext options, only setting `baseURL` when defined.
 *
 * `exactOptionalPropertyTypes` forbids assigning `string | undefined` to an
 * optional `string`, and Playwright's `baseURL` from a test is nullable — so we
 * spread it in only when present rather than passing `undefined`.
 */
export function requestContextOptions(
  baseURL: string | null | undefined,
  extraHeaders?: Record<string, string>,
): NewContextOptions {
  return {
    ...(baseURL ? { baseURL } : {}),
    ...(extraHeaders ? { extraHTTPHeaders: extraHeaders } : {}),
  }
}

/**
 * Shared test bootstrap for the NeuroCanvas auth E2E suite (AER-71).
 *
 * Users are created PROGRAMMATICALLY via the public signup API — not the UI —
 * for every spec that needs a pre-existing account, so the tests stay fast and
 * decoupled from signup-form markup. Each run uses a unique email to avoid
 * cross-run collisions on the shared DB (there is no per-run teardown of the
 * `User` table; unique emails are the isolation strategy). See `uniqueEmail`.
 */

// In dev (`NODE_ENV !== 'production'`) next-auth uses the un-prefixed cookie
// name; in prod it is `__Secure-next-auth.session-token`. The E2E suite runs
// against the dev server, so this is the name we expect. Kept in one place so
// a future prod-target run only changes here.
export const SESSION_COOKIE_NAME = 'next-auth.session-token'

export interface TestUser {
  email: string
  password: string
  name: string
}

/**
 * A unique, HIBP-clean, policy-satisfying credential set.
 *
 * Password satisfies the register schema (>=8 chars, upper + lower + digit)
 * and embeds a UUID so it never appears in HaveIBeenPwned's breach corpus
 * (which would 400 the registration).
 */
export function makeTestUser(label = 'user'): TestUser {
  const id = randomUUID().replace(/-/g, '').slice(0, 16)
  return {
    email: `e2e+${label}-${id}@neurocanvas.test`,
    // Capitalised prefix + digits + the random hex ⇒ upper/lower/number all present.
    password: `Ncq${id}9`,
    name: `E2E ${label} ${id.slice(0, 6)}`,
  }
}

/** Alias kept for readability at call sites that only need an email. */
export function uniqueEmail(label = 'user'): string {
  return makeTestUser(label).email
}

interface RegisterResponse {
  success: boolean
  user: { id: string | null; email: string; name: string | null }
}

/**
 * Create a user through the public signup API. Returns the credentials so the
 * caller can then sign in through the UI.
 *
 * The register endpoint is intentionally enumeration-safe: it returns
 * `{ success: true }` even for a duplicate email (with `user.id === null`).
 * We assert `success` only; a fresh unique email guarantees a real insert.
 */
export async function registerUser(
  request: APIRequestContext,
  user: TestUser,
): Promise<void> {
  const res = await request.post('/api/auth/register', {
    data: { email: user.email, password: user.password, name: user.name },
  })
  expect(
    res.ok(),
    `register failed (${res.status()}): ${await res.text()}`,
  ).toBeTruthy()
  const body = (await res.json()) as RegisterResponse
  expect(body.success).toBeTruthy()
}

/**
 * Drive the credentials sign-in form and wait for the authenticated landing.
 *
 * The app is an SPA: sign-in resolves via the next-auth client, then the page
 * calls `navigateTo('/dashboard')`. We wait for that client-side URL change.
 */
export async function signInViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth/signin')
  await fillCredentials(page, user.email, user.password)
  await submitAuthForm(page)
  await page.waitForURL('**/dashboard', { timeout: 30_000 })
}

/**
 * Wait until Vue has hydrated the page. The auth forms rely on
 * `@submit.prevent` — a click that lands BEFORE hydration performs a NATIVE
 * form submit (full-page GET back to the same route) that wipes the inputs
 * and never navigates, so the spec times out waiting for /dashboard. The dev
 * server in CI compiles routes on first hit, which makes that window wide
 * enough to lose the race reliably (AER-74).
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const app = (window as { useNuxtApp?: () => { isHydrating?: boolean } }).useNuxtApp
      if (!app) return false
      try {
        return app().isHydrating === false
      } catch {
        return false
      }
    },
    { timeout: 30_000 },
  )
}

/** Fill the email + password inputs on the signin/signup form by type. */
export async function fillCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  // Interacting before hydration loses keystrokes and native-submits the form.
  await waitForHydration(page)
  // Resilient selectors: target inputs by their `type` attribute, which is
  // stable across i18n/markup churn (the app owns the components; we don't).
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').first().fill(password)
}

/** Click the form's submit button (role + type=submit is markup-stable). */
export async function submitAuthForm(page: Page): Promise<void> {
  await page.locator('button[type="submit"]').click()
}

/**
 * Pull the next-auth session cookie for the current page context. Throws a
 * descriptive error if absent (i.e. the caller thought they were signed in but
 * weren't) so failures point at the real cause.
 */
export async function getSessionCookie(page: Page): Promise<Cookie> {
  const cookies = await page.context().cookies()
  const session = cookies.find((c) => c.name === SESSION_COOKIE_NAME)
  if (!session) {
    const names = cookies.map((c) => c.name).join(', ') || '<none>'
    throw new Error(
      `Session cookie "${SESSION_COOKIE_NAME}" not found. Present cookies: ${names}`,
    )
  }
  return session
}
