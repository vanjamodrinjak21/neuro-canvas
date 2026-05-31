/**
 * useAIPreload — background pre-warm of the embedding model.
 *
 * Why this exists
 *   The first user-facing semantic action (semantic search, smart expand,
 *   Auto-Connect, etc.) used to block on a cold ONNX session load: ~3-5s
 *   download + tokenizer parse + WebGPU pipeline compile in the worker, or
 *   the Rust ml_init round-trip on Tauri. By kicking the model load on a
 *   background task right after auth resolves, the model is usually warm
 *   by the time the user makes their first request, so search feels
 *   instant.
 *
 * Where it runs
 *   Mounted once in `app.vue`. We deliberately do NOT call this from every
 *   page composable — useAI() has an internal "lazy init on first method
 *   call" path that handles the cold-start case correctly. This composable
 *   is purely opportunistic warm-up; failure is logged and discarded.
 *
 * Why behind `requestIdleCallback`
 *   We want the splash / shell to render and become interactive BEFORE the
 *   AI worker eats main-thread time spinning up. requestIdleCallback (with
 *   a setTimeout fallback for Safari) defers preload until the browser is
 *   actually idle, avoiding TTI regressions.
 *
 * Native shell
 *   On Tauri, the Rust backend already pre-warms its own ONNX engine at
 *   app launch (see `commands::ml::spawn_preload_default_model`), so the
 *   web preload would just race against that. We skip the web path on
 *   native shells.
 */

import { useAI } from '~/composables/useAI'

function _isNativeShell(): boolean {
  if (typeof window === 'undefined') return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) return true
  if ('Capacitor' in window && win.Capacitor?.isNativePlatform?.()) return true
  return false
}

/**
 * Schedule a non-blocking AI model pre-warm. Safe to call at app mount —
 * idempotent (useAI.initialize() short-circuits when already loaded) and
 * never throws into the caller.
 *
 * Returns nothing — fire-and-forget.
 */
export function useAIPreload(): void {
  // SSR guard. Nuxt 4 still calls onMounted in client; we just want belt
  // + braces so this composable is never imported in a server render.
  if (typeof window === 'undefined') return

  onMounted(() => {
    if (_isNativeShell()) {
      // Rust backend handles its own preload — see spawn_preload_default_model.
      return
    }

    // Defer until the browser is idle so we don't compete with hydration,
    // route resolution, or first paint. 5s timeout cap protects against
    // a page that never goes idle.
    const schedule = (cb: () => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      if (typeof win.requestIdleCallback === 'function') {
        win.requestIdleCallback(cb, { timeout: 5000 })
      } else {
        // Safari fallback. 1.5s gives the shell enough time to settle on
        // a slow connection without delaying the warm-up so long that the
        // user beats it to a search.
        setTimeout(cb, 1500)
      }
    }

    schedule(() => {
      const ai = useAI()
      // initialize() handles its own error reporting via the semantic
      // store; we only catch here to keep the unhandled-promise channel
      // clean.
      ai.initialize().catch((err) => {
        console.debug('[useAIPreload] background init skipped:', err)
      })
    })
  })
}
