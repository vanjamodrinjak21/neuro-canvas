<script setup lang="ts">
definePageMeta({
  layout: false
})

const { t } = useI18n()

useHead(() => ({ title: `${t('topo.auth.signinTitle').replace(/\*/g, '')} — NeuroCanvas` }))

const route = useRoute()
const { isCapacitor, isNative, isWindows } = usePlatform()
// GitHub is web-only (hidden in the Mac/iOS apps); Apple shows once configured,
// but never on Windows where Sign in with Apple isn't offered.
const appleAuthEnabled = computed(() => !!useRuntimeConfig().public.appleAuthEnabled && !isWindows.value)

// Mobile auth for Capacitor
const mobileAuth = useMobileAuth()

let signIn: any = null
try {
  const auth = useAuth()
  signIn = auth.signIn
} catch (e) {
  console.error('useAuth failed:', e)
}

// OAuth
const isGoogleLoading = ref(false)
const isGithubLoading = ref(false)
const isAppleLoading = ref(false)

async function handleGoogleSignin() {
  isGoogleLoading.value = true
  try {
    if (isCapacitor.value) {
      await mobileAuth.loginWithOAuth('google')
      message.value = t('auth.signin.success')
      messageType.value = 'success'
      try { const { getSession } = useAuth(); await getSession({ force: true }) } catch {}
      await navigateTo('/dashboard')
      return
    }
    if (!signIn) return
    const cb = (route.query.callbackUrl as string) || '/dashboard'
    await signIn('google', { callbackUrl: cb })
  } catch (e: any) {
    message.value = e.message || 'Google sign-in failed'
    messageType.value = 'error'
  } finally {
    isGoogleLoading.value = false
  }
}

async function handleGithubSignin() {
  isGithubLoading.value = true
  try {
    if (isCapacitor.value) {
      await mobileAuth.loginWithOAuth('github')
      message.value = t('auth.signin.success')
      messageType.value = 'success'
      try { const { getSession } = useAuth(); await getSession({ force: true }) } catch {}
      await navigateTo('/dashboard')
      return
    }
    if (!signIn) return
    const cb = (route.query.callbackUrl as string) || '/dashboard'
    await signIn('github', { callbackUrl: cb })
  } catch (e: any) {
    message.value = e.message || 'GitHub sign-in failed'
    messageType.value = 'error'
  } finally {
    isGithubLoading.value = false
  }
}

async function handleAppleSignin() {
  isAppleLoading.value = true
  try {
    if (isCapacitor.value) {
      await mobileAuth.loginWithOAuth('apple')
      message.value = t('auth.signin.success')
      messageType.value = 'success'
      try { const { getSession } = useAuth(); await getSession({ force: true }) } catch {}
      await navigateTo('/dashboard')
      return
    }
    if (!signIn) return
    const cb = (route.query.callbackUrl as string) || '/dashboard'
    await signIn('apple', { callbackUrl: cb })
  } catch (e: any) {
    message.value = e.message || 'Apple sign-in failed'
    messageType.value = 'error'
  } finally {
    isAppleLoading.value = false
  }
}

// Callback error
const callbackError = computed(() => {
  const err = route.query.error as string | undefined
  if (err === 'CredentialsSignin') return t('auth.signin.error.credentials')
  if (err === 'OAuthAccountNotLinked') return t('auth.signin.error.account_not_linked')
  if (err === 'OAuthSignin' || err === 'OAuthCallback') return t('auth.signin.error.oauth')
  if (err) return t('auth.signin.error.generic')
  return null
})

// Form
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const message = ref('')
const messageType = ref<'error' | 'success'>('error')
const totpRequired = ref(false)
const totpCode = ref('')

const emailRegex = /^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const isEmailValid = computed(() => emailRegex.test(email.value))
const canSubmit = computed(() => email.value && password.value && isEmailValid.value && !isLoading.value && (!totpRequired.value || totpCode.value.length === 6))

async function handleSignin() {
  message.value = ''
  if (!email.value || !password.value) {
    message.value = t('auth.signin.validation.empty')
    messageType.value = 'error'
    return
  }
  if (!isEmailValid.value) {
    message.value = t('auth.signin.validation.invalid_email')
    messageType.value = 'error'
    return
  }
  if (totpRequired.value && totpCode.value.length !== 6) {
    message.value = t('auth.signin.validation.2fa_invalid')
    messageType.value = 'error'
    return
  }

  isLoading.value = true

  // Capacitor: use mobile auth (direct API calls)
  if (isCapacitor.value) {
    try {
      await mobileAuth.loginWithCredentials(
        email.value,
        password.value,
        totpCode.value || undefined
      )
      // Refresh nuxt-auth so UI updates reactively (reads new localStorage session)
      try { const { getSession } = useAuth(); await getSession({ force: true }) } catch {}
      message.value = t('auth.signin.success')
      messageType.value = 'success'
      await navigateTo('/dashboard')
      return
    } catch (e: any) {
      const msg = e.message || t('auth.signin.error.failed')
      if (msg.includes('TOTP') || msg.includes('two-factor')) {
        totpRequired.value = true
        message.value = t('auth.signin.validation.2fa_required')
      } else {
        message.value = msg
      }
      messageType.value = 'error'
      isLoading.value = false
    }
    return
  }

  // Web: use nuxt-auth
  if (!signIn) {
    message.value = t('auth.signin.error.service_unavailable')
    messageType.value = 'error'
    isLoading.value = false
    return
  }
  try {
    const result = await signIn('credentials', {
      email: email.value,
      password: password.value,
      totpCode: totpCode.value || '',
      redirect: false
    })
    if (result?.error) {
      if (result.error.includes('TOTP_REQUIRED')) {
        totpRequired.value = true
        message.value = t('auth.signin.validation.2fa_required')
        messageType.value = 'error'
        isLoading.value = false
        return
      }
      message.value = result.error === 'CredentialsSignin' ? t('auth.signin.error.credentials') : result.error
      messageType.value = 'error'
      isLoading.value = false
      return
    }
    if (result?.ok) {
      message.value = t('auth.signin.success')
      messageType.value = 'success'
      try { const { getSession } = useAuth(); await getSession({ force: true }) } catch {}
      await navigateTo('/dashboard')
    } else {
      message.value = t('auth.signin.error.failed')
      messageType.value = 'error'
      isLoading.value = false
    }
  } catch (e: any) {
    message.value = 'Error: ' + (e.message || t('auth.signin.error.failed'))
    messageType.value = 'error'
    isLoading.value = false
  }
}

// Auto-trigger OAuth when ?auto=google|github is in the URL.
// Used by mobile app to skip the signin page and go directly to the provider.
onMounted(() => {
  const autoProvider = route.query.auto as string | undefined
  if (autoProvider === 'google') {
    nextTick(() => handleGoogleSignin())
  } else if (autoProvider === 'github') {
    nextTick(() => handleGithubSignin())
  } else if (autoProvider === 'apple' && appleAuthEnabled.value) {
    nextTick(() => handleAppleSignin())
  }
})
</script>
<template>
  <LandingShell>
    <main id="content" class="subpage auth">
    <div class="auth__card survey-frame">
      <p class="subpage__eyebrow">
        <span class="num">ACCESS</span> · {{ t('topo.auth.eyebrowIn') }}
      </p>
      <LandingRevealText
        :text="t('topo.auth.signinTitle')"
        as="h1"
        class="auth__title"
        immediate
        :delay="0.15"
      />
      <p class="auth__sub">{{ t('topo.auth.signinSub') }}</p>

      <div class="auth__providers">
        <button
          class="auth__provider"
          type="button"
          :disabled="isGoogleLoading"
          data-cursor="link"
          @click="handleGoogleSignin"
        >
          <LandingProviderIcon name="google" />
          {{ t('topo.auth.continueWith', { provider: 'Google' }) }}
        </button>
        <button
          v-if="!isNative"
          class="auth__provider"
          type="button"
          :disabled="isGithubLoading"
          data-cursor="link"
          @click="handleGithubSignin"
        >
          <LandingProviderIcon name="github" />
          {{ t('topo.auth.continueWith', { provider: 'GitHub' }) }}
        </button>
        <button
          v-if="appleAuthEnabled"
          class="auth__provider"
          type="button"
          :disabled="isAppleLoading"
          data-cursor="link"
          @click="handleAppleSignin"
        >
          <LandingProviderIcon name="apple" />
          {{ t('topo.auth.continueWith', { provider: 'Apple' }) }}
        </button>
      </div>

      <div class="auth__divider" aria-hidden="true">
        <span>{{ t('topo.auth.or') }}</span>
      </div>

      <form class="auth__form" @submit.prevent="handleSignin">
        <label class="auth__label" for="auth-email">{{ t('topo.auth.emailLabel') }}</label>
        <input
          id="auth-email"
          v-model="email"
          class="auth__input"
          type="email"
          name="email"
          autocomplete="email"
          :placeholder="t('topo.auth.emailPlaceholder')"
        >

        <!-- opens automatically once the email is valid -->
        <Transition name="field">
          <div v-if="isEmailValid" class="auth__reveal">
            <label class="auth__label" for="auth-pass">{{ t('topo.auth.passwordLabel') }}</label>
            <input
              id="auth-pass"
              v-model="password"
              class="auth__input"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="••••••••"
            >
          </div>
        </Transition>

        <!-- second factor — only when the server asks for it -->
        <Transition name="field">
          <div v-if="totpRequired" class="auth__reveal">
            <label class="auth__label" for="auth-totp">{{ t('topo.auth.twofaLabel') }}</label>
            <input
              id="auth-totp"
              v-model="totpCode"
              class="auth__input"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              placeholder="000000"
            >
          </div>
        </Transition>

        <button
          class="btn-primary auth__submit"
          type="submit"
          data-cursor="link"
          :disabled="!canSubmit"
        >
          {{ t('topo.auth.continue') }}
        </button>
      </form>

      <p
        v-if="message || callbackError"
        class="auth__hint"
        :class="messageType === 'success' ? 'is-ok' : 'is-bad'"
        role="status"
        data-testid="auth-message"
      >
        {{ message || callbackError }}
      </p>

      <p class="auth__switch">
        {{ t('topo.auth.noAccount') }}
        <NuxtLink to="/auth/signup" data-cursor="link">{{ t('topo.auth.switchUp') }}</NuxtLink>
      </p>

      <p class="auth__legal">
        {{ t('topo.auth.legalNote') }}
        <NuxtLink to="/terms" data-cursor="link">{{ t('topo.footer.terms') }}</NuxtLink>
        ·
        <NuxtLink to="/privacy" data-cursor="link">{{ t('topo.footer.privacy') }}</NuxtLink>
      </p>
    </div>
  </main>
  </LandingShell>
</template>

<style scoped>
/* landing had provider anchors — the app uses real buttons */
.auth__provider:disabled {
  opacity: 0.5;
  cursor: wait;
}
</style>
