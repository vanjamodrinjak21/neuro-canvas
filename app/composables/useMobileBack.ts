// Shared back-navigation interceptor stack for native (Capacitor) mobile.
//
// The Android hardware back button should pop the in-page view stack FIRST —
// e.g. Settings → General → [back] returns to Settings, not to the previous
// route/tab. Mobile sub-screens (like the settings drill-down) are local
// component state with no router history entry, so without this the hardware
// back blows straight past them to the last main route.
//
// Pages register an interceptor that consumes ONE level of their local view
// stack; the native back-button plugin calls handleBack() before falling back
// to router.back() / exitApp().

type BackInterceptor = () => boolean // return true if it consumed the back

const interceptors: BackInterceptor[] = []

export function useMobileBack() {
  /**
   * Register a back interceptor for the lifetime of the calling component.
   * `fn` returns true when it handled the back (e.g. popped a sub-screen) and
   * false to let the back propagate. No-op on the server; auto-unregisters on
   * unmount. Returns a manual unregister fn.
   */
  function registerBackInterceptor(fn: BackInterceptor): () => void {
    if (import.meta.server) return () => {}
    interceptors.push(fn)
    const remove = () => {
      const i = interceptors.indexOf(fn)
      if (i !== -1) interceptors.splice(i, 1)
    }
    if (getCurrentInstance()) onUnmounted(remove)
    return remove
  }

  /** Run interceptors most-recently-registered first; stop once one consumes. */
  function handleBack(): boolean {
    for (let i = interceptors.length - 1; i >= 0; i--) {
      if (interceptors[i]!()) return true
    }
    return false
  }

  return { registerBackInterceptor, handleBack }
}
