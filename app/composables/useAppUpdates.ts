/**
 * useAppUpdates — unified, cross-platform update-availability composable.
 *
 * Surfaces ONE reactive contract regardless of platform:
 *   - Tauri (desktop): delegates to `useTauriUpdater` which talks to the
 *     `@tauri-apps/plugin-updater` plugin; `action()` downloads + installs
 *     + relaunches.
 *   - Capacitor (iOS/Android): polls the public release manifest at
 *     /api/releases/manifest and compares against `runtimeConfig.public
 *     .buildVersion`. `action()` opens the App Store / Play Store listing
 *     via @capacitor/browser so the user pulls the update through the
 *     normal store flow (TestFlight / Play internal track all work the
 *     same way).
 *   - Web: same manifest poll; `action()` does a hard reload to pull the
 *     freshly-deployed SPA bundle.
 *
 * The auto-check toggle ('nc-auto-update' in localStorage, default `true`)
 * gates the background polling — explicit `check()` calls always run.
 *
 * Designed so one UI component can consume this — no platform branching
 * leaks into templates.
 *
 * @see AER-14
 */
import { computed, onMounted, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

const AUTO_CHECK_STORAGE_KEY = 'nc-auto-update'
const SESSION_DISMISS_KEY = 'nc-update-dismissed-version'
const BACKGROUND_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6h (matches AER-14 spec)
const WEB_POLL_INTERVAL_MS = 60 * 60 * 1000       // 1h for web/mobile banner

// App Store / Play Store listings. The iOS app ID is a placeholder until
// App Store Connect provisioning lands — see USER ACTIONS in the AER-14
// final report.
const APP_STORE_URL = 'https://apps.apple.com/app/neurocanvas/id0000000000'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.neurocanvas.app'

type Platform = 'tauri' | 'capacitor-ios' | 'capacitor-android' | 'web'

interface ReleaseManifest {
  version: string
  pub_date?: string
  published_at?: string
  release_url?: string
}

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web'
  if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) return 'tauri'
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor
  if (cap?.isNativePlatform?.()) {
    const p = cap.getPlatform?.()
    if (p === 'ios') return 'capacitor-ios'
    if (p === 'android') return 'capacitor-android'
  }
  return 'web'
}

/**
 * Semver-aware "is `latest` newer than `current`?" — accepts plain x.y.z and
 * prerelease suffixes (`1.0.0-rc.2`). Returns false on parse failure to fail
 * closed (don't nag users with a bogus banner).
 */
function isNewer(current: string, latest: string): boolean {
  if (!current || !latest) return false
  // Normalise: split on first '-' so we compare numeric core, then prerelease.
  const split = (v: string): { core: number[], pre: string } => {
    const [coreStr, ...preParts] = v.replace(/^v/i, '').split('-')
    const core = (coreStr ?? '').split('.').map(n => Number.parseInt(n, 10))
    if (core.some(n => Number.isNaN(n))) return { core: [], pre: '' }
    return { core, pre: preParts.join('-') }
  }
  const a = split(current)
  const b = split(latest)
  if (a.core.length === 0 || b.core.length === 0) return false
  const len = Math.max(a.core.length, b.core.length)
  for (let i = 0; i < len; i++) {
    const av = a.core[i] ?? 0
    const bv = b.core[i] ?? 0
    if (bv > av) return true
    if (bv < av) return false
  }
  // Cores equal — a release version beats any prerelease of the same core
  // (1.0.0 > 1.0.0-rc.1), and prerelease lexicographic comparison handles
  // the rest. Equal strings → not newer.
  if (a.pre && !b.pre) return true
  if (!a.pre && b.pre) return false
  return b.pre.localeCompare(a.pre) > 0
}

export interface AppUpdatesApi {
  platform: Readonly<Ref<Platform>>
  updateAvailable: Readonly<Ref<boolean>>
  latestVersion: Readonly<Ref<string | null>>
  currentVersion: string
  isWorking: Readonly<Ref<boolean>>
  progress: Readonly<Ref<number>>
  error: Readonly<Ref<string | null>>
  releaseNotes: Readonly<Ref<string>>
  /** "Update now" — install (Tauri), refresh (web), open store (mobile). */
  action: () => Promise<void>
  /** Force a check immediately; ignores the auto-check toggle. */
  check: () => Promise<void>
  /** Persists "don't show me this version again until next session." */
  dismiss: () => void
  /** UI label for the primary CTA — already i18n'd. */
  ctaLabel: ComputedRef<string>
  /** UI message — already i18n'd, version interpolated. */
  message: ComputedRef<string>
}

export function useAppUpdates(): AppUpdatesApi {
  const cfg = useRuntimeConfig()
  const { t } = useI18n()

  const platformRef = ref<Platform>(detectPlatform())
  const currentVersion = (cfg.public.buildVersion as string) || '0.0.0'
  const latestVersion = ref<string | null>(null)
  const releaseNotes = ref<string>('')
  const updateAvailableRaw = ref(false)
  const isWorking = ref(false)
  const progress = ref(0)
  const error = ref<string | null>(null)

  // Per-session dismissal — re-appears next session if still newer.
  const dismissedVersion = ref<string | null>(
    typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_DISMISS_KEY) : null
  )

  const updateAvailable = computed(() => {
    if (!updateAvailableRaw.value) return false
    if (!latestVersion.value) return false
    if (dismissedVersion.value && dismissedVersion.value === latestVersion.value) return false
    return true
  })

  // ── Tauri path ────────────────────────────────────────────────────────
  // Only instantiated when we're actually on Tauri so the import is lazy
  // and the web/mobile bundles stay clean.
  const tauri = platformRef.value === 'tauri' ? useTauriUpdater() : null

  // Mirror Tauri composable state into the unified surface.
  if (tauri) {
    watch(tauri.updateAvailable, (v) => {
      updateAvailableRaw.value = v
      if (v) latestVersion.value = tauri.updateVersion.value
      releaseNotes.value = tauri.updateBody.value
    })
    watch(tauri.isDownloading, v => (isWorking.value = v))
    watch(tauri.downloadProgress, v => (progress.value = v))
    watch(tauri.error, v => (error.value = v))
  }

  // ── Web / Capacitor path ──────────────────────────────────────────────
  async function checkViaManifest(): Promise<void> {
    try {
      const res = await $fetch<ReleaseManifest>('/api/releases/manifest', {
        method: 'GET',
        // Don't let a stale Service Worker cache the manifest — always go
        // origin-fresh so the banner reflects reality within the poll window.
        headers: { 'cache-control': 'no-cache' },
      })
      const remote = res?.version?.trim()
      if (!remote) return
      latestVersion.value = remote
      releaseNotes.value = res?.release_url ?? ''
      updateAvailableRaw.value = isNewer(currentVersion, remote)
    } catch (e) {
      // Network/CDN flakes are normal — degrade silently. We surface the
      // error so a Settings "Check now" affordance can show it inline.
      error.value = (e as Error).message
    }
  }

  async function check(): Promise<void> {
    error.value = null
    if (tauri) {
      await tauri.checkForUpdates()
    } else {
      await checkViaManifest()
    }
  }

  async function action(): Promise<void> {
    error.value = null
    if (platformRef.value === 'tauri' && tauri) {
      await tauri.downloadAndInstall()
      return
    }
    if (platformRef.value === 'capacitor-ios' || platformRef.value === 'capacitor-android') {
      const url = platformRef.value === 'capacitor-ios' ? APP_STORE_URL : PLAY_STORE_URL
      try {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url })
      } catch (e) {
        // Fallback: at least try the standard navigation. WKWebView/Chrome WV
        // will hand the URL off to the OS, which routes to the store app.
        error.value = (e as Error).message
        if (typeof window !== 'undefined') window.location.href = url
      }
      return
    }
    // Web → hard reload to pull the freshly-deployed SPA bundle.
    if (typeof window !== 'undefined') window.location.reload()
  }

  function dismiss(): void {
    if (latestVersion.value) {
      dismissedVersion.value = latestVersion.value
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_DISMISS_KEY, latestVersion.value)
      }
    }
  }

  // ── i18n surface ──────────────────────────────────────────────────────
  const ctaLabel = computed<string>(() => {
    if (platformRef.value === 'tauri') return t('common.update.update_now')
    if (platformRef.value === 'web') return t('common.update.refresh')
    return t('common.update.open_store')
  })

  const message = computed<string>(() => {
    const version = latestVersion.value ?? ''
    if (platformRef.value === 'tauri') {
      return t('common.update.version_ready', { version })
    }
    if (platformRef.value === 'web') {
      return t('common.update.version_available_web', { version })
    }
    return t('common.update.version_available_mobile', { version })
  })

  // ── Background polling lifecycle ──────────────────────────────────────
  let pollHandle: ReturnType<typeof setInterval> | null = null

  function autoCheckEnabled(): boolean {
    if (typeof window === 'undefined') return false
    const v = window.localStorage.getItem(AUTO_CHECK_STORAGE_KEY)
    // Default true — opt-out, not opt-in.
    return v === null ? true : v === 'true'
  }

  onMounted(() => {
    if (!autoCheckEnabled()) return
    // Fire-and-forget initial check on launch.
    void check()
    const interval = platformRef.value === 'tauri' ? BACKGROUND_INTERVAL_MS : WEB_POLL_INTERVAL_MS
    pollHandle = setInterval(() => {
      if (autoCheckEnabled()) void check()
    }, interval)
  })

  onBeforeUnmount(() => {
    if (pollHandle) {
      clearInterval(pollHandle)
      pollHandle = null
    }
  })

  return {
    platform: readonly(platformRef),
    updateAvailable: readonly(updateAvailable) as Readonly<Ref<boolean>>,
    latestVersion: readonly(latestVersion),
    currentVersion,
    isWorking: readonly(isWorking),
    progress: readonly(progress),
    error: readonly(error),
    releaseNotes: readonly(releaseNotes),
    action,
    check,
    dismiss,
    ctaLabel,
    message,
  }
}

/**
 * Read/write the "auto-check for updates" toggle backing localStorage.
 * Exposed as a tiny helper so the Settings page doesn't reach into
 * localStorage directly (and stays SSR-safe).
 */
export function useAutoUpdateToggle(): { enabled: Ref<boolean>, setEnabled: (v: boolean) => void } {
  const enabled = ref(true)
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(AUTO_CHECK_STORAGE_KEY)
    enabled.value = stored === null ? true : stored === 'true'
  }
  function setEnabled(v: boolean): void {
    enabled.value = v
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTO_CHECK_STORAGE_KEY, String(v))
    }
  }
  return { enabled, setEnabled }
}
