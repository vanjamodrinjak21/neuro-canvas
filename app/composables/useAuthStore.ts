/**
 * Auth Store - Composable for auth state management
 */

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
  // Get auth methods inside the composable (Vue setup context)
  const { signIn, signOut } = useAuth()

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

    async signInWithCredentials(email: string, password: string): Promise<boolean> {
      state.isSigningIn = true
      state.signInError = null

      try {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false
        })

        if (result?.error) {
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
