<script setup lang="ts">
/**
 * Mobile/Desktop OAuth Callback (hardened for AER-106)
 *
 * After OAuth completes in the native app's in-app browser sheet
 * (SFSafariViewController on iOS) or the desktop system browser, next-auth
 * redirects here. This page hands the session back to the native app via the
 * neurocanvas:// scheme.
 *
 * Hardening notes — each of these stranded App Review inside the sheet
 * (Guideline 4 rejection, build 22):
 * - SFSafariViewController drops JS-initiated custom-scheme navigations that
 *   lack a user gesture, so the automatic hop is only an attempt; the visible
 *   "Return to NeuroCanvas" button provides the gesture that reliably
 *   re-enters the app.
 * - The session cookie can land a beat after the redirect (Apple's form_post
 *   hop), so the session is polled instead of a single 300ms wait.
 * - The payload is UTF-8-safe base64 and percent-encoded — the old
 *   btoa(JSON) threw on non-Latin-1 names, and raw base64 '+' in the query
 *   was parsed as a space, corrupting the native atob().
 * - NEVER fall back to /dashboard here: that leaves the user browsing the
 *   web app inside the sheet, which is exactly what the reviewer screenshot
 *   showed.
 */
import { encodeMobileSessionPayload } from '~/utils/mobileSessionPayload'

definePageMeta({ layout: false })

const { t } = useI18n()

const state = ref<'working' | 'ready' | 'failed'>('working')
const schemeUrl = ref('neurocanvas://auth/callback?error=session')

function openApp() {
  window.location.href = schemeUrl.value
}

onMounted(async () => {
  // The signin page stamps this when a ?auto= mobile/desktop OAuth starts;
  // clearing it keeps the dashboard rescue redirect from re-firing later in
  // this browsing context.
  try { sessionStorage.removeItem('nc-mobile-oauth-pending') } catch { /* unavailable */ }

  try {
    const { data, getSession } = useAuth()

    // Poll for the session — the cookie can lag the redirect. 12 × 500ms
    // also covers slow review-device networks.
    let user = data.value?.user
    for (let i = 0; i < 12 && !user?.email; i++) {
      try { await getSession({ force: true }) } catch { /* poll again */ }
      user = data.value?.user
      if (user?.email) break
      await new Promise(r => setTimeout(r, 500))
    }

    if (!user?.email) {
      state.value = 'failed'
      return
    }

    // Fetch the raw JWT so the native app can attach it as an explicit
    // Cookie header (the native cookie jar is unreliable on iOS).
    let token = ''
    let cookieName = ''
    try {
      // Widened to `string` to skip nitro's typed-route matching, which blows
      // TypeScript's instantiation depth on this path (TS2321).
      const tokenUrl: string = '/api/auth/mobile-token'
      const tokenData = await $fetch<{ token: string; cookieName: string }>(tokenUrl)
      token = tokenData.token
      cookieName = tokenData.cookieName
    } catch {
      // Token fetch failed — still pass user data, sync just won't work
    }

    const payload = encodeMobileSessionPayload({
      user: {
        id: (user as { id?: string }).id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      token,
      cookieName,
    })
    schemeUrl.value = `neurocanvas://auth/callback?session=${encodeURIComponent(payload)}`
    state.value = 'ready'
    // Best-effort automatic hop — blocked without a gesture on iOS, in which
    // case the button below does the same navigation with one.
    openApp()
  } catch {
    state.value = 'failed'
  }
})
</script>

<template>
  <div class="callback-page">
    <div class="callback-card">
      <NcLogo :size="20" :container-size="44" :radius="11" />

      <template v-if="state === 'working'">
        <div class="callback-spinner" aria-hidden="true" />
        <p class="callback-text">{{ t('auth.mobile_callback.completing') }}</p>
      </template>

      <template v-else-if="state === 'ready'">
        <h1 class="callback-title">{{ t('auth.mobile_callback.ready_title') }}</h1>
        <p class="callback-text">{{ t('auth.mobile_callback.ready_desc') }}</p>
        <button class="callback-btn" type="button" @click="openApp">
          {{ t('auth.mobile_callback.return_button') }}
        </button>
      </template>

      <template v-else>
        <h1 class="callback-title">{{ t('auth.mobile_callback.failed_title') }}</h1>
        <p class="callback-text">{{ t('auth.mobile_callback.failed_desc') }}</p>
        <button class="callback-btn" type="button" @click="openApp">
          {{ t('auth.mobile_callback.back_button') }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.callback-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--nc-bg);
}

.callback-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: 360px;
  text-align: center;
}

.callback-title {
  font-family: var(--nc-font-display);
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 8px 0 0;
}

.callback-text {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  line-height: 1.5;
  color: var(--nc-text-secondary);
  margin: 0;
}

/* Primary CTA — ink pill grammar (REDESIGN.md §5). */
.callback-btn {
  margin-top: 10px;
  padding: 12px 24px;
  background: var(--nc-text);
  border: none;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-bg);
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.callback-btn:active {
  transform: scale(0.97);
}

.callback-btn:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.callback-spinner {
  width: 18px;
  height: 18px;
  margin-top: 8px;
  border: 2px solid var(--nc-border);
  border-top-color: var(--nc-accent);
  border-radius: 50%;
  animation: callback-spin 0.6s linear infinite;
}

@keyframes callback-spin {
  to { transform: rotate(360deg); }
}
</style>
