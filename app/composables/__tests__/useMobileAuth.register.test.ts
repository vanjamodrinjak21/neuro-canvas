// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed, reactive, watch, readonly } from 'vue'

// ---------------------------------------------------------------------------
// useMobileAuth — registerWithCredentials (AER-106)
// ---------------------------------------------------------------------------
//
// App Review (Guideline 4) rejected build 22 because the signup page routed
// account creation through the system browser, and its relative
// $fetch('/api/auth/register') had no backend to hit on the capacitor://
// origin. registerWithCredentials must (a) POST to the REMOTE register
// endpoint via native HTTP with a JSON Content-Type (the CSRF middleware
// exempts /api/auth/ but the endpoint reads a JSON body), and (b) surface the
// server's statusMessage on failure — CapacitorHttp resolves 4xx/5xx instead
// of throwing, so a naive implementation would report success on errors.
// ---------------------------------------------------------------------------

Object.assign(globalThis, { ref, computed, reactive, watch, readonly })

const http = {
  get: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
}
vi.mock('@capacitor/core', () => ({ CapacitorHttp: http, Browser: {} }))

async function importFresh() {
  vi.resetModules()
  const mod = await import('../useMobileAuth')
  const auth = mod.useMobileAuth()
  // Let the init's fire-and-forget revalidateSession finish its dynamic
  // import('@capacitor/core') BEFORE the test calls into the composable — a
  // concurrent dynamic import while the mocker is still instantiating the
  // factory races past vi.mock and reaches the real module (web plugin →
  // real fetch). Same settle discipline as useMobileAuth.revalidate.test.ts.
  for (let i = 0; i < 6; i++) await Promise.resolve()
  await new Promise(r => setTimeout(r, 0))
  return auth
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  ;(window as any).Capacitor = { isNativePlatform: () => true }
  // Background revalidation fired by the module's first-call init.
  http.get.mockResolvedValue({ status: 200, data: {} })
})

describe('registerWithCredentials (AER-106)', () => {
  it('POSTs JSON to the remote register endpoint', async () => {
    http.post.mockResolvedValue({ status: 200, data: { success: true } })

    const auth = await importFresh()
    await auth.registerWithCredentials('v@x.com', 'Passw0rdX', 'Vanja')

    expect(http.post).toHaveBeenCalledTimes(1)
    const call = http.post.mock.calls[0]![0]
    expect(call.url).toBe('https://neuro-canvas.com/api/auth/register')
    expect(call.headers['Content-Type']).toBe('application/json')
    expect(call.data).toEqual({ email: 'v@x.com', password: 'Passw0rdX', name: 'Vanja' })
  })

  it('omits the name field when not provided', async () => {
    http.post.mockResolvedValue({ status: 200, data: { success: true } })

    const auth = await importFresh()
    await auth.registerWithCredentials('v@x.com', 'Passw0rdX')

    expect(http.post.mock.calls[0]![0].data).toEqual({ email: 'v@x.com', password: 'Passw0rdX' })
  })

  it('surfaces the server statusMessage on a 4xx response', async () => {
    http.post.mockResolvedValue({
      status: 400,
      data: { statusCode: 400, statusMessage: 'This password has appeared in 42 data breaches. Please choose a different password.' },
    })

    const auth = await importFresh()
    await expect(auth.registerWithCredentials('v@x.com', 'Passw0rdX'))
      .rejects.toThrow('This password has appeared in 42 data breaches. Please choose a different password.')
  })

  it('parses a string JSON error body (native HTTP returns raw text)', async () => {
    http.post.mockResolvedValue({
      status: 429,
      data: JSON.stringify({ statusMessage: 'Too many registration attempts. Try again later.' }),
    })

    const auth = await importFresh()
    await expect(auth.registerWithCredentials('v@x.com', 'Passw0rdX'))
      .rejects.toThrow('Too many registration attempts. Try again later.')
  })

  it('falls back to a generic message when the error body is unusable', async () => {
    http.post.mockResolvedValue({ status: 500, data: '<html>gateway error</html>' })

    const auth = await importFresh()
    await expect(auth.registerWithCredentials('v@x.com', 'Passw0rdX'))
      .rejects.toThrow('Registration failed. Please try again.')
  })
})
