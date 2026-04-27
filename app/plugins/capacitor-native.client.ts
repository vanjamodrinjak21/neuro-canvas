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
    const isLight = document.documentElement.classList.contains('light')
    await StatusBar.setStyle({ style: isLight ? Style.Light : Style.Dark })
    await StatusBar.setBackgroundColor({ color: isLight ? '#FAFAF9' : '#0A0A0C' })

    // Watch for theme changes and sync status bar
    const observer = new MutationObserver(() => {
      const light = document.documentElement.classList.contains('light')
      StatusBar.setStyle({ style: light ? Style.Light : Style.Dark })
      StatusBar.setBackgroundColor({ color: light ? '#FAFAF9' : '#0A0A0C' })
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  } catch {
    // @capacitor/status-bar not installed — skip
  }

})
