/**
 * Capacitor Native Setup Plugin
 *
 * Handles splash screen dismissal, status bar styling,
 * and app lifecycle events on Capacitor (iOS/Android).
 */
export default defineNuxtPlugin(async () => {
  if (typeof window === 'undefined') return
  if (!('Capacitor' in window) || !(window as any).Capacitor?.isNativePlatform?.()) return

  // Dismiss splash screen after app is ready
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch {
    // @capacitor/splash-screen not installed — skip
  }

  // Set status bar style to match current theme
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')

    // Overlay the webview so the page background shows BEHIND the status bar.
    // iOS ignores setBackgroundColor, so without overlay the bar stays a black
    // band in light mode. The mobile page roots already pad for safe-area-top.
    try { await StatusBar.setOverlaysWebView({ overlay: true }) } catch { /* Android-only API on some versions */ }

    // Style.Light = dark text (for light backgrounds); Style.Dark = light text.
    const apply = () => {
      const light = document.documentElement.classList.contains('light')
      StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {})
      StatusBar.setBackgroundColor({ color: light ? '#FAFAF9' : '#0A0A0C' }).catch(() => {})
    }
    apply()

    // Watch for in-app theme changes and re-sync the status bar.
    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  } catch {
    // @capacitor/status-bar not installed — skip
  }

})
