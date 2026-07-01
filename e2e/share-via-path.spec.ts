import { randomBytes } from 'node:crypto'
import { test, expect, request as playwrightRequest } from '@playwright/test'
import {
  makeTestUser,
  registerUser,
  signInViaUi,
  getSessionCookie,
  requestContextOptions,
} from './fixtures'

/**
 * Share `?via=` path (recipient access).
 *
 * A `/map/{id}?via={token}` visit for a VALID, non-revoked share must load
 * without requiring sign-in. This is the regression from AER (share recipients
 * saw a blank map because the auth middleware / map-load never honoured `?via=`).
 *
 * We seed a real share end-to-end via the API:
 *   1. register + sign in an owner (to get an authenticated cookie),
 *   2. push a map (`/api/sync/push`),
 *   3. create a viewer share (`/api/maps/{id}/shares`),
 *   4. then, in a FRESH unauthenticated context, assert both:
 *      a. the unauthenticated `/api/share/{token}` contract returns the map, and
 *      b. the SPA `/map/{id}?via={token}` route does not bounce to sign-in.
 *
 * The `/api/share/{token}` assertion is the load-bearing contract the middleware
 * and canvas both rely on; the page-level assertion confirms the middleware's
 * `?via=` allowance actually lets an anonymous visitor stay on the map route.
 */

/** Generate a client-style id accepted by the lenient `cuid` schema validator. */
function clientMapId(): string {
  return `c${randomBytes(12).toString('hex')}`
}

test.describe('share ?via= path', () => {
  test('valid share loads for an unauthenticated visitor', async ({ page, request, baseURL }) => {
    const owner = makeTestUser('shareowner')
    await registerUser(request, owner)
    await signInViaUi(page, owner)
    await expect(page).toHaveURL(/\/dashboard/)

    const sessionCookie = await getSessionCookie(page)
    const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}`

    // Authenticated owner context for seeding.
    const ownerCtx = await playwrightRequest.newContext(
      requestContextOptions(baseURL, { cookie: cookieHeader }),
    )

    // Unauthenticated visitor context for the share assertions.
    const anonCtx = await playwrightRequest.newContext(
      requestContextOptions(baseURL),
    )

    try {
      // 1. Seed a map via the sync push endpoint.
      const mapId = clientMapId()
      const mapData = { nodes: [], edges: [], rootNodeId: null }
      const push = await ownerCtx.post('/api/sync/push', {
        data: {
          mapId,
          title: 'E2E Shared Map',
          data: mapData,
          // Server recomputes the authoritative checksum from `data`; this field
          // is schema-required but its value is not trusted.
          checksum: 'client-placeholder',
          syncVersion: 0,
          deviceId: 'e2e-playwright',
        },
      })
      expect(
        push.ok(),
        `sync push failed (${push.status()}): ${await push.text()}`,
      ).toBeTruthy()

      // 2. Create a viewer share for the map.
      const shareRes = await ownerCtx.post(`/api/maps/${mapId}/shares`, {
        data: { role: 'viewer', label: 'e2e' },
      })
      expect(
        shareRes.ok(),
        `share create failed (${shareRes.status()}): ${await shareRes.text()}`,
      ).toBeTruthy()
      const share = (await shareRes.json()) as { token: string }
      expect(share.token, 'share response must carry a token').toBeTruthy()

      // 3a. Contract: the public share endpoint resolves the map for anon.
      const shareView = await anonCtx.get(`/api/share/${share.token}`)
      expect(
        shareView.status(),
        `public share fetch should be 200, got ${shareView.status()}`,
      ).toBe(200)
      const viewed = (await shareView.json()) as { id: string }
      expect(viewed.id).toBe(mapId)

      // 3b. Page-level: an unauthenticated visitor on /map/{id}?via={token}
      // must NOT be redirected to sign-in (the middleware honours ?via=).
      const anonPage = await (await page.context().browser()!.newContext()).newPage()
      try {
        await anonPage.goto(`/map/${mapId}?via=${share.token}`)
        // Give the client-side auth middleware time to run and (not) redirect.
        await anonPage.waitForTimeout(3_000)
        expect(
          anonPage.url(),
          'anon share visitor should stay on the map route, not bounce to signin',
        ).not.toContain('/auth/signin')
        expect(anonPage.url()).toContain(`/map/${mapId}`)
      } finally {
        await anonPage.context().close()
      }
    } finally {
      await ownerCtx.dispose()
      await anonCtx.dispose()
    }
  })
})
