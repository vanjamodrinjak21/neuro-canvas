<script setup lang="ts">
const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  authenticated: []
}>()

const desktopAuth = useDesktopAuth()

const email = ref('')
const password = ref('')
const totpCode = ref('')
const showTOTP = ref(false)
const showPassword = ref(false)
const localError = ref<string | null>(null)
const failedOnce = ref(false)
const emailInput = ref<HTMLInputElement | null>(null)

async function handleSubmit() {
  if (!email.value.trim() || !password.value) return
  localError.value = null

  try {
    await desktopAuth.loginWithCredentials(
      email.value.trim(),
      password.value,
      showTOTP.value ? totpCode.value : undefined,
    )
    // Success — clear form and notify parent
    email.value = ''
    password.value = ''
    totpCode.value = ''
    showTOTP.value = false
    failedOnce.value = false
    emit('authenticated')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    // After first failure, show 2FA option (user might need to enter TOTP)
    if (!showTOTP.value) {
      failedOnce.value = true
    }
    localError.value = msg || 'Sign-in failed.'
  }
}

function handleClose() {
  email.value = ''
  password.value = ''
  totpCode.value = ''
  showTOTP.value = false
  failedOnce.value = false
  localError.value = null
  emit('close')
}

async function openInBrowser() {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(`${desktopAuth.authBaseUrl}/auth/signin`)
  } catch {
    window.open(`${desktopAuth.authBaseUrl}/auth/signin`, '_blank')
  }
}

// Focus email input when modal opens
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => emailInput.value?.focus())
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="visible" class="auth-overlay" @click.self="handleClose">
        <div class="auth-container">
          <div class="auth-logo">
            <NcLogo :size="20" :container-size="44" :radius="11" />
          </div>

          <form class="auth-form" @submit.prevent="handleSubmit">
            <h2 class="auth-title">Sign in to NeuroCanvas</h2>
            <p class="auth-desc">
              Sign in to sync your maps across devices and access community templates.
            </p>

            <!-- Error banner -->
            <div v-if="localError || desktopAuth.loginError.value" class="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              <span>{{ localError || desktopAuth.loginError.value }}</span>
            </div>

            <!-- Email -->
            <div class="auth-field">
              <label for="desktop-email" class="auth-label">Email</label>
              <input
                id="desktop-email"
                ref="emailInput"
                v-model="email"
                type="email"
                class="auth-input"
                placeholder="you@example.com"
                autocomplete="email"
                required
                :disabled="desktopAuth.isLoggingIn.value"
              >
            </div>

            <!-- Password -->
            <div class="auth-field">
              <label for="desktop-password" class="auth-label">Password</label>
              <div class="auth-input-wrap">
                <input
                  id="desktop-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="auth-input auth-input-password"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  required
                  :disabled="desktopAuth.isLoggingIn.value"
                  @keyup.enter="!showTOTP && handleSubmit()"
                >
                <button
                  type="button"
                  class="auth-toggle-pw"
                  tabindex="-1"
                  @click="showPassword = !showPassword"
                >
                  <svg v-if="showPassword" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
              </div>
            </div>

            <!-- 2FA toggle (shown after first failed attempt) -->
            <button
              v-if="failedOnce && !showTOTP"
              type="button"
              class="auth-totp-toggle"
              @click="showTOTP = true"
            >
              I have two-factor authentication enabled
            </button>

            <!-- TOTP field -->
            <div v-if="showTOTP" class="auth-field">
              <label for="desktop-totp" class="auth-label">Two-Factor Code</label>
              <input
                id="desktop-totp"
                v-model="totpCode"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="6"
                class="auth-input auth-input-totp"
                placeholder="000000"
                autocomplete="one-time-code"
                :disabled="desktopAuth.isLoggingIn.value"
                @keyup.enter="handleSubmit"
              >
            </div>

            <!-- Submit -->
            <button
              type="submit"
              class="auth-submit"
              :disabled="!email.trim() || !password || desktopAuth.isLoggingIn.value"
            >
              <div v-if="desktopAuth.isLoggingIn.value" class="auth-spinner" />
              {{ desktopAuth.isLoggingIn.value ? 'Signing in...' : 'Sign In' }}
            </button>
          </form>

          <div class="auth-divider">
            <span>or</span>
          </div>

          <!-- OAuth fallback — opens in system browser -->
          <button class="auth-browser-btn" @click="openInBrowser">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            Sign in with Google or GitHub in browser
          </button>

          <button class="auth-close-btn" @click="handleClose">
            Cancel
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
}

.auth-container {
  width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 32px 28px;
  background: #0d0d11;
  border-radius: 16px;
  border: 1px solid #1a1a2e;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
}

.auth-logo {
  margin-bottom: 20px;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.auth-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #FAFAFA;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
  text-align: center;
}

.auth-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: rgba(250, 250, 250, 0.4);
  margin: 0 0 24px;
  line-height: 1.5;
  text-align: center;
}

.auth-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #f87171;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.4;
}

.auth-error svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.auth-field {
  margin-bottom: 14px;
}

.auth-label {
  display: block;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: rgba(250, 250, 250, 0.5);
  margin-bottom: 6px;
  letter-spacing: 0.01em;
}

.auth-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #252529;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  color: #FAFAFA;
  outline: none;
  transition: border-color 150ms ease;
}

.auth-input::placeholder {
  color: #3F3F46;
}

.auth-input:focus {
  border-color: rgba(0, 210, 190, 0.4);
}

.auth-input:disabled {
  opacity: 0.5;
}

.auth-input-wrap {
  position: relative;
  display: flex;
}

.auth-input-password {
  padding-right: 40px;
}

.auth-toggle-pw {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #52525B;
  border-radius: 4px;
  transition: color 150ms ease;
}

.auth-toggle-pw:hover {
  color: #A1A1AA;
}

.auth-totp-toggle {
  width: 100%;
  padding: 0;
  margin-bottom: 14px;
  background: none;
  border: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: #00D2BE;
  cursor: pointer;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.8;
  transition: opacity 150ms ease;
}

.auth-totp-toggle:hover {
  opacity: 1;
}

.auth-input-totp {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  letter-spacing: 0.3em;
  padding: 12px 14px;
}

.auth-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px 16px;
  margin-top: 4px;
  background: #00D2BE;
  border: none;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #09090B;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.auth-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.auth-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(9, 9, 11, 0.3);
  border-top-color: #09090B;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.auth-divider {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 20px 0;
  gap: 12px;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #1a1a2e;
}

.auth-divider span {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: #3F3F46;
}

.auth-browser-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: 1px solid #252529;
  border-radius: 8px;
  background: transparent;
  color: rgba(250, 250, 250, 0.6);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}

.auth-browser-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(250, 250, 250, 0.8);
  border-color: #333;
}

.auth-close-btn {
  margin-top: 16px;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(250, 250, 250, 0.4);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  cursor: pointer;
  transition: background 150ms ease;
}

.auth-close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Light theme */
:root.light .auth-container {
  background: #FAFAF9;
  border-color: #E8E8E6;
}

:root.light .auth-title { color: #111111; }
:root.light .auth-desc { color: #71717A; }
:root.light .auth-label { color: #71717A; }

:root.light .auth-input {
  background: #FFFFFF;
  border-color: #E8E8E6;
  color: #111111;
}

:root.light .auth-input::placeholder { color: #A1A1AA; }
:root.light .auth-input:focus { border-color: rgba(0, 210, 190, 0.5); }

:root.light .auth-submit { color: #FFFFFF; }
:root.light .auth-divider::before,
:root.light .auth-divider::after { background: #E8E8E6; }
:root.light .auth-divider span { color: #A1A1AA; }

:root.light .auth-browser-btn {
  border-color: #E8E8E6;
  color: #52525B;
}

:root.light .auth-browser-btn:hover {
  background: rgba(0, 0, 0, 0.03);
  color: #111111;
}

:root.light .auth-close-btn {
  background: rgba(0, 0, 0, 0.04);
  color: #71717A;
}
</style>
