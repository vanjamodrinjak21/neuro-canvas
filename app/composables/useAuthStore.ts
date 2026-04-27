/**
 * Auth Store - Composable for auth state management
 */
import { useDatabase } from '~/composables/useDatabase'

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
        // Clear all user-scoped local data before signing out
        // This prevents the next user from seeing stale maps/sync state
        const { clearUserData, setCurrentUserId } = useDatabase()
        await clearUserData()
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
