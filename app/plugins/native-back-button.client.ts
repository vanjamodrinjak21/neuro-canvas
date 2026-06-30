// Wire the Android hardware back button to the in-app navigation stack on
// native (Capacitor). Without this, hardware back pops the webview route and
// blows past in-page sub-screens — e.g. Settings → General jumps straight to
// Home instead of returning to Settings.
//
// Pages register interceptors via useMobileBack(); we give them first chance to
// consume the back, then fall back to router history, then exit at the root.
import { useMobileBack } from '~/composables/useMobileBack'

export default defineNuxtPlugin(async () => {
  if (typeof window === 'undefined') return
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (!cap?.isNativePlatform?.()) return

  const { App } = await import('@capacitor/app')
  const router = useRouter()
  const { handleBack } = useMobileBack()

  await App.addListener('backButton', ({ canGoBack }) => {
    if (handleBack()) return // a page popped its own sub-screen
    if (canGoBack) router.back()
    else void App.exitApp()
  })
})
