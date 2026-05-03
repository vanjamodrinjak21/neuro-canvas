export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  let os: 'ios' | 'android' | null = null

  if (cap?.getPlatform) {
    const p = cap.getPlatform()
    if (p === 'ios') os = 'ios'
    else if (p === 'android') os = 'android'
  }
  if (!os) {
    const ua = navigator.userAgent || ''
    if (/iPhone|iPad|iPod/i.test(ua)) os = 'ios'
    else if (/Android/i.test(ua)) os = 'android'
  }

  if (os === 'ios') root.classList.add('platform-ios')
  if (os === 'android') root.classList.add('platform-android')
})
