import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E smoke suite for NeuroCanvas auth flows (AER-71).
 *
 * Covers the flows testable WITHOUT external OAuth providers: credentials
 * signup / signin, session persistence, protected-route middleware, the
 * server-side logout revocation contract (AER-59), and the public share
 * `?via=` path (AER-…).
 *
 * The app is an SPA (`ssr: false`), so auth middleware runs client-side.
 * Specs therefore wait on client-side navigation rather than server 3xx.
 *
 * Env:
 *   - E2E_BASE_URL   — target a already-running server (skips webServer boot).
 *   - DATABASE_URL / REDIS_URL / AUTH_SECRET — required for the app to run.
 *
 * Rate-limit note: `checkRateLimit` fails CLOSED, so Redis MUST be reachable
 * or `/api/auth/register` and `/api/share/*` will 429. See e2e/README-less
 * comments in fixtures.ts.
 */

const PORT = Number(process.env.E2E_PORT ?? 3000)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

// When E2E_BASE_URL is set we assume the caller manages the server lifecycle
// (e.g. a long-lived dev server, or a preview build) and skip the webServer.
const MANAGED_SERVER = !!process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  // Auth flows touch shared DB rows keyed on unique per-test emails, so they
  // are safe to parallelise. Full parallelism across files AND within a file.
  fullyParallel: true,
  // Never allow accidental `.only` to pass CI silently.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // SPA + a single dev server: keep worker count modest so the dev server's
  // on-demand compilation doesn't thrash under a burst of first-hit requests.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  // Generous timeouts: the dev server compiles routes on first hit, and the
  // SPA auth middleware makes a real /api/auth/session round-trip per nav.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The SPA drives navigation via the client router; give actions room.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Boot the app for tests unless a base URL was supplied. We use the dev
  // server (`npm run dev`) rather than a production build: it is the fastest
  // way to a runnable server in CI and needs no separate build step. The
  // 3-minute timeout covers Nuxt's cold prepare + first-compile.
  webServer: MANAGED_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
        // The suite registers users / creates shares far faster than the
        // per-IP abuse ceilings (AER-74). checkRateLimit honors this flag
        // outside production only. Managed servers (E2E_BASE_URL) must set
        // it themselves.
        env: { E2E_RELAXED_RATE_LIMITS: '1' },
      },
})
