/**
 * Track the iOS / Android software keyboard so any bottom sheet can lift itself
 * above it. Sets `--kbd-h` (px) on <html> as the keyboard rises and falls.
 *
 * Falls back to the VisualViewport API on web/PWA so the same CSS works there.
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const setHeight = (px: number) => {
    root.style.setProperty('--kbd-h', `${Math.max(0, Math.round(px))}px`)
    root.classList.toggle('kbd-open', px > 0)
  }
  setHeight(0)

  const Cap = (window as any).Capacitor
  const isNative = !!Cap?.isNativePlatform?.()

  if (isNative) {
    // Capacitor Keyboard plugin — fires with the exact keyboard height.
    import('@capacitor/keyboard').then(({ Keyboard }) => {
      Keyboard.addListener('keyboardWillShow', (info) => setHeight(info.keyboardHeight))
      Keyboard.addListener('keyboardDidShow', (info) => setHeight(info.keyboardHeight))
      Keyboard.addListener('keyboardWillHide', () => setHeight(0))
      Keyboard.addListener('keyboardDidHide', () => setHeight(0))
    }).catch(() => {})
    return
  }

  // Web / PWA fallback: derive from VisualViewport when it shrinks.
  if ('visualViewport' in window && window.visualViewport) {
    const vv = window.visualViewport
    const update = () => {
      const diff = window.innerHeight - vv.height - vv.offsetTop
      setHeight(diff > 60 ? diff : 0)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
  }
})
