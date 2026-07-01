/**
 * Auth Store - Composable for auth state management
 */
import { useDatabase } from '~/composables/useDatabase'
import { useSyncEngine } from '~/composables/useSyncEngine'

interface AuthState {
  isRegistering: boolean
  registrationError: string | null
  isSigningIn: boolean
  signInError: string | null
  isSendingMagicLink: boolean
  magicLinkSent: boolean
  magicLinkError: string | null
  isLoading: boolean
}

// Shared state across all instances
const state = reactive<AuthState>({
  isRegistering: false,
  registrationError: null,
  isSigningIn: false,
  signInError: null,
  isSendingMagicLink: false,
  magicLinkSent: false,
  magicLinkError: null,
  isLoading: false
})

export function useAuthStore() {
  const _isNative = typeof window !== 'undefined' && (
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
    || ('Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.())
  )

  // In native mode (Tauri/Capacitor), provide no-op stubs (no auth server available)
  let signIn: any = async () => ({})
  let signOut: any = async () => {}
  if (!_isNative) {
    try {
      const auth = useAuth()
      signIn = auth.signIn
      signOut = auth.signOut
    } catch {
      // Auth module not available
    }
  }

  const actions = {
    async register(email: string, password: string, name?: string): Promise<boolean> {
      state.isRegistering = true
      state.registrationError = null

      try {
        const response = await $fetch('/api/auth/register', {
          method: 'POST',
          body: { email, password, name }
        })

        if (response.success) {
          return true
        }
        return false
      } catch (error: any) {
        state.registrationError = error.data?.statusMessage || error.message || 'Registration failed'
        return false
      } finally {
        state.isRegistering = false
      }
    },

    async signInWithCredentials(email: string, password: string, totpCode?: string): Promise<boolean | 'TOTP_REQUIRED'> {
      state.isSigningIn = true
      state.signInError = null

      try {
        const result = await signIn('credentials', {
          email,
          password,
          totpCode: totpCode || '',
          redirect: false
        })

        if (result?.error) {
          // Check if 2FA is required
          if (result.error.includes('TOTP_REQUIRED')) {
            return 'TOTP_REQUIRED'
          }
          state.signInError = result.error === 'CredentialsSignin'
            ? 'Invalid email or password'
            : result.error
          return false
        }

        return true
      } catch (error: any) {
        state.signInError = error.message || 'Sign in failed'
        return false
      } finally {
        state.isSigningIn = false
      }
    },

    async signInWithOAuth(provider: 'google' | 'github'): Promise<void> {
      state.isLoading = true

      try {
        await signIn(provider, { callbackUrl: '/dashboard' })
      } catch (error: any) {
        console.error(`OAuth sign in failed for ${provider}:`, error)
      } finally {
        state.isLoading = false
      }
    },

    async sendMagicLink(email: string): Promise<boolean> {
      state.isSendingMagicLink = true
      state.magicLinkError = null
      state.magicLinkSent = false

      try {
        const result = await signIn('email', {
          email,
          redirect: false,
          callbackUrl: '/dashboard'
        })

        if (result?.error) {
          state.magicLinkError = result.error
          return false
        }

        state.magicLinkSent = true
        return true
      } catch (error: any) {
        state.magicLinkError = error.message || 'Failed to send magic link'
        return false
      } finally {
        state.isSendingMagicLink = false
      }
    },

    async handleSignOut(): Promise<void> {
      state.isLoading = true

      try {
        // 1. Best-effort flush: push never-synced / queued maps + pending
        //    debounced edits to the server before local state is wiped, so
        //    guest/offline-created maps survive the logout (AER-59/AER-60 #3).
        //    Returns `allClean` = everything is safely on the server. Never
        //    throws; defaults to NOT clean if the flush itself blows up.
        let allClean = false
        try {
          allClean = await useSyncEngine().flushBeforeLogout()
        } catch { /* best-effort — proceed with logout, treat as NOT clean */ }

        // 2. Best-effort server-side revoke: bumps the per-user session epoch +
        //    revokes collab jtis so an already-issued JWT stops working. The
        //    endpoint is idempotent ({ ok: true } always) and does NOT clear
        //    cookies — next-auth signOut() handles the cookie below. Capped at
        //    3s so a black-hole network can't stall logout (AER-59 #4).
        try {
          await Promise.race([
            $fetch('/api/auth/logout', { method: 'POST' }),
            new Promise(resolve => setTimeout(resolve, 3000)),
          ])
        } catch { /* best-effort — local sign-out still proceeds */ }

        // 3. Clear user-scoped local data ONLY when everything is safely on the
        //    server. If NOT clean (offline logout, or a push failed) we keep the
        //    on-device maps — they're the last surviving copy of some edits and
        //    are userId-scoped, so they stay inert for other accounts and are
        //    intact when this user logs back in.
        const { clearUserData, setCurrentUserId } = useDatabase()
        if (allClean) {
          await clearUserData()
        } else {
          console.warn('[auth] logout: unsynced local data present — keeping on-device maps (not wiping)')
        }
        await setCurrentUserId(null)

        await signOut({ callbackUrl: '/' })
      } catch (error) {
        console.error('Sign out failed:', error)
      } finally {
        state.isLoading = false
      }
    },

    clearErrors(): void {
      state.registrationError = null
      state.signInError = null
      state.magicLinkError = null
    },

    resetMagicLinkState(): void {
      state.magicLinkSent = false
      state.magicLinkError = null
    }
  }

  return {
    // State as refs
    isRegistering: toRef(state, 'isRegistering'),
    registrationError: toRef(state, 'registrationError'),
    isSigningIn: toRef(state, 'isSigningIn'),
    signInError: toRef(state, 'signInError'),
    isSendingMagicLink: toRef(state, 'isSendingMagicLink'),
    magicLinkSent: toRef(state, 'magicLinkSent'),
    magicLinkError: toRef(state, 'magicLinkError'),
    isLoading: toRef(state, 'isLoading'),
    // Actions
    ...actions
  }
}
