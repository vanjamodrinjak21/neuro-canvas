<script setup lang="ts">
definePageMeta({
  layout: false
})

const { t } = useI18n()
const route = useRoute()
const { isCapacitor } = usePlatform()

// Mobile auth for Capacitor
const mobileAuth = useMobileAuth()

let signIn: any = null
let authStatus: any = null
try {
  const auth = useAuth()
  signIn = auth.signIn
  authStatus = auth.status
} catch (e) {
  console.error('useAuth failed:', e)
}

// OAuth
const isGoogleLoading = ref(false)
const isGithubLoading = ref(false)

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
const showPassword = ref(false)
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
  }
})
</script>

<template>
  <div class="auth-page">
    <!-- Brand Panel -->
    <div class="brand-panel">
      <NuxtLink to="/" class="brand-logo">
        <NcLogo :size="18" :container-size="32" :radius="8" />
        <span class="logo-text">NeuroCanvas</span>
      </NuxtLink>

      <div class="brand-content">
        <h1 class="brand-headline">{{ $t('auth.signin.brand_headline') }}</h1>
        <p class="brand-desc">{{ $t('auth.signin.brand_desc') }}</p>
      </div>

      <div class="testimonial">
        <p class="testimonial-quote">"{{ $t('auth.signin.testimonial_quote') }}"</p>
        <div class="testimonial-author">
          <div class="author-avatar">
            <span>AK</span>
          </div>
          <div class="author-info">
            <span class="author-name">{{ $t('auth.signin.testimonial_author') }}</span>
            <span class="author-role">{{ $t('auth.signin.testimonial_role') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Form Panel -->
    <div class="form-panel">
      <div class="form-container">
        <div class="form-header">
          <h2 class="form-title">{{ $t('auth.signin.form_title') }}</h2>
          <p class="form-subtitle">{{ $t('auth.signin.form_subtitle') }}</p>
        </div>

        <!-- Error from callback -->
        <Transition name="nc-fade-down">
          <div v-if="callbackError" class="form-message error">{{ callbackError }}</div>
        </Transition>

        <!-- OAuth -->
        <div class="oauth-buttons">
          <button class="oauth-btn" :disabled="isGoogleLoading || isGithubLoading" @click="handleGoogleSignin">
            <svg v-if="!isGoogleLoading" class="oauth-icon" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <span v-else class="i-lucide-loader-2 animate-spin" />
            <span>{{ $t('auth.oauth.google') }}</span>
          </button>
          <button v-if="!isCapacitor" class="oauth-btn" :disabled="isGoogleLoading || isGithubLoading" @click="handleGithubSignin">
            <svg v-if="!isGithubLoading" class="oauth-icon" viewBox="0 0 24 24"><path :fill="'currentColor'" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            <span v-else class="i-lucide-loader-2 animate-spin" />
            <span>{{ $t('auth.oauth.github') }}</span>
          </button>
        </div>

        <!-- Divider -->
        <div class="divider">
          <div class="divider-line" />
          <span class="divider-text">{{ $t('auth.signin.divider') }}</span>
          <div class="divider-line" />
        </div>

        <!-- Form -->
        <form class="fields" @submit.prevent="handleSignin">
          <div class="field">
            <label class="field-label">{{ $t('auth.signin.email_label') }}</label>
            <input
              v-model="email"
              type="email"
              :placeholder="$t('auth.signin.email_placeholder')"
              class="field-input"
              :disabled="isLoading"
            >
          </div>
          <div class="field">
            <div class="field-label-row">
              <label class="field-label">{{ $t('auth.signin.password_label') }}</label>
              <NuxtLink to="#" class="forgot-link">{{ $t('auth.signin.forgot_password') }}</NuxtLink>
            </div>
            <div class="input-wrap">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="$t('auth.signin.password_placeholder')"
                class="field-input"
                :disabled="isLoading"
              >
              <button type="button" class="toggle-pw" :aria-label="showPassword ? $t('auth.password.toggle_hide') : $t('auth.password.toggle_show')" @click="showPassword = !showPassword">
                <span :class="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" />
              </button>
            </div>
          </div>

          <!-- 2FA Code Input -->
          <Transition name="nc-fade-down">
            <div v-if="totpRequired" class="form-group">
              <label class="field-label">{{ $t('auth.signin.2fa_label') }}</label>
              <input
                v-model="totpCode"
                type="text"
                :placeholder="$t('auth.signin.2fa_placeholder')"
                class="field-input"
                maxlength="6"
                inputmode="numeric"
                autocomplete="one-time-code"
                :disabled="isLoading"
              >
            </div>
          </Transition>

          <Transition name="nc-fade-down">
            <div v-if="message" :class="['form-message', messageType]">{{ message }}</div>
          </Transition>

          <button type="submit" class="submit-btn" :disabled="!canSubmit || isLoading">
            {{ isLoading ? $t('auth.signin.submit_loading') : $t('auth.signin.submit') }}
          </button>
        </form>

        <p class="form-footer">
          {{ $t('auth.signin.footer') }}
          <NuxtLink to="/auth/signup" class="footer-link">{{ $t('auth.signin.footer_link') }}</NuxtLink>
        </p>

        <!-- Skip for mobile — sign-in is optional -->
        <button v-if="isCapacitor" class="skip-btn" @click="navigateTo('/settings')">
          {{ $t('auth.signin.skip_button') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  --a-bg: #09090B;
  --a-surface: #0D0D10;
  --a-border: #1A1A1E;
  --a-text: #FAFAFA;
  --a-text-2: #888890;
  --a-text-3: #555560;
  --a-accent: #00D2BE;

  display: flex;
  min-height: 100vh;
  background: var(--a-bg);
  color: var(--a-text);
  font-family: 'Inter', system-ui, sans-serif;
}

/* Brand Panel */
.brand-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 640px;
  flex-shrink: 0;
  padding: 48px 56px;
  background: var(--a-surface);
  border-right: 1px solid var(--a-border);
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--a-text);
}

.logo-text {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-bottom: 80px;
}

.brand-headline {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 44px;
  font-weight: 400;
  font-style: italic;
  line-height: 52px;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--a-text);
}

.brand-desc {
  font-size: 16px;
  line-height: 26px;
  color: var(--a-text-3);
  margin: 0;
  max-width: 420px;
}

.testimonial {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 32px;
  border-top: 1px solid var(--a-border);
}

.testimonial-quote {
  font-size: 15px;
  font-style: italic;
  line-height: 24px;
  color: var(--a-text-2);
  margin: 0;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background: var(--a-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--a-accent);
  flex-shrink: 0;
}

.author-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--a-text);
}

.author-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.author-role {
  font-size: 13px;
  color: var(--a-text-3);
}

/* Form Panel */
.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.form-container {
  display: flex;
  flex-direction: column;
  width: 400px;
  gap: 32px;
}

.form-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 38px;
  margin: 0;
}

.form-subtitle {
  font-size: 15px;
  color: var(--a-text-3);
  margin: 0;
  line-height: 22px;
}

/* OAuth */
.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.oauth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  gap: 10px;
  border-radius: 6px;
  background: var(--a-surface);
  border: 1px solid var(--a-border);
  color: var(--a-text);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 150ms var(--nc-ease-out);
}

.oauth-btn:hover:not(:disabled) {
  border-color: #27272A;
}

.oauth-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.oauth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.oauth-icon {
  width: 18px;
  height: 18px;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: 16px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--a-border);
}

.divider-text {
  font-size: 13px;
  color: var(--a-text-3);
}

/* Fields */
.fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-text-2);
}

.forgot-link {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-accent);
  text-decoration: none;
}

.forgot-link:hover {
  text-decoration: underline;
}

.input-wrap {
  position: relative;
}

.field-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  background: var(--a-surface);
  border: 1px solid var(--a-border);
  border-radius: 6px;
  color: var(--a-text);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 150ms var(--nc-ease-out);
}

.field-input::placeholder {
  color: var(--a-text-3);
}

.field-input:focus {
  border-color: var(--a-accent);
}

.field-input:disabled {
  opacity: 0.5;
}

.input-wrap .field-input {
  padding-right: 44px;
}

.toggle-pw {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--a-text-3);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
}

/* Message */
.form-message {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 18px;
}

.form-message.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #EF4444;
}

.form-message.success {
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.2);
  color: var(--a-accent);
}

/* Submit */
.submit-btn {
  height: 48px;
  border-radius: 6px;
  background: var(--a-accent);
  color: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 150ms var(--nc-ease-out), transform 100ms var(--nc-ease-out);
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Footer */
.form-footer {
  font-size: 14px;
  color: var(--a-text-3);
  text-align: center;
  margin: 0;
}

.footer-link {
  color: var(--a-accent);
  font-weight: 500;
  text-decoration: none;
}

.footer-link:hover {
  text-decoration: underline;
}

/* Utilities */
.animate-spin {
  animation: spin 600ms linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .animate-spin {
    animation-duration: 2s;
  }
}

/* Ensure error messages have high contrast on dark bg */
.form-message.error {
  font-weight: 500;
}

/* Skip button (mobile) */
.skip-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  background: none;
  border: none;
  color: var(--a-text-3);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.skip-btn:active {
  color: var(--a-text-2);
}

/* Light theme */
:root.light .auth-page {
  --a-bg: #FAFAF9;
  --a-surface: #F5F5F3;
  --a-border: #E8E8E6;
  --a-text: #111111;
  --a-text-2: #71717A;
  --a-text-3: #777777;
  --a-accent: #00D2BE;
}

:root.light .submit-btn {
  color: #FFFFFF;
}

:root.light .author-avatar {
  background: #E8E8E6;
}

/* Laptop breakpoint */
@media (max-width: 1366px) {
  .brand-panel {
    width: 520px;
    padding: 48px 48px;
  }

  .brand-headline {
    font-size: 38px;
    line-height: 46px;
  }

  .brand-desc {
    font-size: 15px;
    line-height: 24px;
  }

  .form-container {
    width: 380px;
    gap: 28px;
  }

  .form-title {
    font-size: 28px;
    line-height: 34px;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .brand-panel {
    display: none;
  }

  .form-panel {
    padding: 32px 24px;
  }
}

@media (max-width: 768px) {
  .form-panel {
    padding: calc(env(safe-area-inset-top, 0px) + 20px) 24px env(safe-area-inset-bottom, 0px);
    justify-content: flex-start;
  }

  .form-container {
    width: 100%;
  }

  .form-title {
    font-size: 32px;
    line-height: 40px;
    letter-spacing: -0.03em;
    font-weight: 800;
  }

  .form-subtitle {
    font-size: 15px;
    line-height: 22px;
    margin-bottom: 12px;
  }

  .oauth-buttons {
    gap: 12px;
    margin-bottom: 28px;
  }

  .oauth-btn {
    height: 52px;
    border-radius: 8px;
    font-size: 15px;
  }

  .divider {
    margin-bottom: 28px;
  }

  .divider span {
    font-size: 12px;
  }

  .field-input {
    height: 52px;
    border-radius: 8px;
    padding: 0 16px;
    font-size: 15px;
  }

  .submit-btn {
    height: 52px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .form-footer {
    font-size: 14px;
    justify-content: center;
  }

  .form-footer a {
    font-size: 14px;
    font-weight: 600;
  }
}
</style>
