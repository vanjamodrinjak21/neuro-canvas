/**
 * Quick-Capture deep-link dispatch (AER-70).
 *
 * Registers a SINGLE, persistent listener for incoming `neurocanvas://capture`
 * deep links and routes them into the quick-capture sheet, pre-filled. This is
 * the central place capture URLs are dispatched — it lives ALONGSIDE the
 * auth-scoped deep-link handling in `useMobileAuth` / `useDesktopAuth` (which
 * attach their own transient listeners only during an OAuth login) and does not
 * touch it. Capture links and auth callbacks are disjoint (`.../capture` vs
 * `.../auth/callback`), so both listeners coexist without interference.
 *
 * Platforms:
 *   - Capacitor (iOS/Android): `@capacitor/app` `appUrlOpen` for live links +
 *     `getLaunchUrl()` for a cold start opened by a link. Android "Share"
 *     intents are rewritten to `neurocanvas://capture` in MainActivity, so they
 *     arrive through this same event.
 *   - Tauri (desktop): `@tauri-apps/plugin-deep-link` `onOpenUrl` for live
 *     links + `getCurrent()` for a cold start. The `neurocanvas` scheme is
 *     already registered (tauri.conf.json), and lib.rs already forwards URLs.
 *
 * Both plugins are ALREADY project dependencies (used by the auth composables) —
 * no new dependency is introduced.
 */
import { useQuickCapture, parseCaptureUrl } from '~/composables/useQuickCapture'

export default defineNuxtPlugin(async () => {
  if (typeof window === 'undefined') return

  const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window
  const isCapacitor =
    'Capacitor' in window && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.() === true

  if (!isTauri && !isCapacitor) return

  // Dispatch a raw deep-link URL to the capture sheet iff it is a capture link.
  // Returns true when handled (so cold-start backstops can stop looking).
  function dispatch(raw: string | null | undefined): boolean {
    if (!raw) return false
    const payload = parseCaptureUrl(raw)
    if (!payload) return false
    // Defer opening until the app is interactive so the sheet mounts cleanly on
    // a cold start (the mounted <QuickCaptureSheet/> reacts to the shared state).
    const openSheet = () => useQuickCapture().open(payload)
    if (document.readyState === 'complete') openSheet()
    else window.addEventListener('load', openSheet, { once: true })
    return true
  }

  if (isCapacitor) {
    try {
      const { App } = await import('@capacitor/app')

      // Live links / share intents while the app is running.
      App.addListener('appUrlOpen', (event: { url: string }) => {
        dispatch(event.url)
      })

      // Cold start: the app was launched by a capture link / share.
      try {
        const launch = await App.getLaunchUrl()
        dispatch(launch?.url)
      } catch {
        // getLaunchUrl unsupported / no launch URL — ignore.
      }
    } catch {
      // @capacitor/app unavailable — capture deep links simply won't fire.
    }
    return
  }

  // Tauri desktop.
  try {
    const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link')

    await onOpenUrl((urls: string[]) => {
      for (const raw of urls) {
        if (dispatch(raw)) break
      }
    })

    // Cold-start backstop (Windows/Linux may deliver the URL before the
    // listener is attached; getCurrent() replays it).
    try {
      const initial = await getCurrent()
      if (initial) {
        for (const raw of initial) {
          if (dispatch(raw)) break
        }
      }
    } catch {
      // getCurrent unsupported — ignore.
    }
  } catch {
    // deep-link plugin unavailable — ignore.
  }
})
