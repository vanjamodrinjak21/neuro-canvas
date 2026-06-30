import { usePlatform } from '~/composables/usePlatform'

/**
 * Definitively lock document (html/body) scrolling while a fixed-layout mobile
 * screen is mounted. The mobile home/maps/templates roots are `position: fixed`
 * and own their internal scroll, but iOS WKWebView still lets the BODY scroll /
 * rubber-band behind them — which drags the "fixed" header + tab dock with it.
 *
 * CSS `overflow:hidden` on the page container isn't enough (the body is the
 * scroller), so lock html+body directly. Mobile-only; restored on unmount so
 * the desktop layout and other pages keep their normal scroll.
 */
export function useBodyScrollLock() {
  if (!import.meta.client) return

  const { isMobile } = usePlatform()
  let prev: { ho: string; bo: string; bh: string; ob: string } | null = null

  function lock() {
    if (prev || !isMobile.value) return
    const html = document.documentElement
    const body = document.body
    prev = {
      ho: html.style.overflow,
      bo: body.style.overflow,
      bh: body.style.height,
      ob: body.style.overscrollBehavior,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.height = '100%'
    body.style.overscrollBehavior = 'none'
  }

  function unlock() {
    if (!prev) return
    const html = document.documentElement
    const body = document.body
    html.style.overflow = prev.ho
    body.style.overflow = prev.bo
    body.style.height = prev.bh
    body.style.overscrollBehavior = prev.ob
    prev = null
  }

  onMounted(lock)
  onBeforeUnmount(unlock)
}
