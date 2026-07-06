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

// Sign in with Apple is offered on macOS (the desktop app is Mac-only). It runs
// the real web OAuth flow via the system browser + a neurocanvas:// deep-link
// bounce (see useDesktopAuth.loginWithApple). Non-Mac desktops fall back to a
// "use browser instead" escape hatch.
const isMac = computed(() =>
  typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent),
)

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

async function handleGoogle() {
  localError.value = null
  try {
    await desktopAuth.loginWithGoogle()
    emit('authenticated')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Google sign-in failed.'
    localError.value = msg
  }
}

async function handleApple() {
  localError.value = null
  try {
    await desktopAuth.loginWithApple()
    emit('authenticated')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Apple sign-in failed.'
    localError.value = msg
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
    <Transition name="auth-modal">
      <div v-if="visible" class="auth-overlay" @click.self="handleClose">
        <div class="auth-container">
          <div class="auth-logo">
            <NcLogo :size="20" :container-size="44" :radius="11" />
          </div>

          <form class="auth-form" @submit.prevent="handleSubmit">
            <h2 class="auth-title">{{ $t('auth.desktop_auth.title') }}</h2>
            <p class="auth-desc">
              {{ $t('auth.desktop_auth.desc') }}
            </p>

            <!-- Error banner -->
            <div v-if="localError || desktopAuth.loginError.value" class="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              <span>{{ localError || desktopAuth.loginError.value }}</span>
            </div>

            <!-- Email -->
            <div class="auth-field">
              <label for="desktop-email" class="auth-label">{{ $t('auth.desktop_auth.email_label') }}</label>
              <input
                id="desktop-email"
                ref="emailInput"
                v-model="email"
                type="email"
                class="auth-input"
                :placeholder="$t('auth.desktop_auth.email_placeholder')"
                autocomplete="email"
                required
                :disabled="desktopAuth.isLoggingIn.value"
              >
            </div>

            <!-- Password -->
            <div class="auth-field">
              <label for="desktop-password" class="auth-label">{{ $t('auth.desktop_auth.password_label') }}</label>
              <div class="auth-input-wrap">
                <input
                  id="desktop-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="auth-input auth-input-password"
                  :placeholder="$t('auth.desktop_auth.password_placeholder')"
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
              {{ $t('auth.desktop_auth.2fa_toggle') }}
            </button>

            <!-- TOTP field -->
            <div v-if="showTOTP" class="auth-field">
              <label for="desktop-totp" class="auth-label">{{ $t('auth.desktop_auth.2fa_label') }}</label>
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
              {{ desktopAuth.isLoggingIn.value ? $t('auth.desktop_auth.submit_loading') : $t('auth.desktop_auth.submit') }}
            </button>
          </form>

          <div class="auth-divider">
            <span>{{ $t('auth.desktop_auth.divider') }}</span>
          </div>

          <!-- Google sign-in inside the desktop app (no browser hop) -->
          <button
            class="auth-google-btn"
            :disabled="desktopAuth.isLoggingIn.value"
            @click="handleGoogle"
          >
            <!-- Official multicolor Google "G" — brand asset, exempt from the
                 zero-hex token rule (matches auth/OAuthButtons.vue exactly;
                 Google's sign-in branding requires the standard mark). -->
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>{{ desktopAuth.isLoggingIn.value ? $t('auth.desktop_auth.google_loading') : $t('auth.desktop_auth.google_button') }}</span>
          </button>

          <!-- Sign in with Apple — Mac only. Runs the real web OAuth flow via the
               system browser + neurocanvas:// deep-link bounce. -->
          <button
            v-if="isMac"
            class="auth-google-btn"
            :disabled="desktopAuth.isLoggingIn.value"
            @click="handleApple"
          >
            <svg width="15" height="15" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
            <span>{{ $t('auth.desktop_auth.apple_button') }}</span>
          </button>

          <!-- Non-Mac fallback if Google ever blocks the embedded webview -->
          <button v-else class="auth-browser-btn" @click="openInBrowser">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            {{ $t('auth.desktop_auth.use_browser_instead') }}
          </button>

          <button class="auth-close-btn" @click="handleClose">
            {{ $t('auth.desktop_auth.cancel') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Modal grammar (REDESIGN.md §5): bg-tinted scrim, NO backdrop blur. */
.auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--nc-bg-rgb), 0.6);
}

/* Flat surface-2 panel + THE hairline, calm shadow only. */
.auth-container {
  width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 32px 28px;
  background: var(--nc-surface-2);
  border-radius: var(--nc-radius-md);
  border: 1px solid var(--nc-border);
  box-shadow: var(--nc-shadow-md);
  transform-origin: center;
}

/* Enter scale(0.97)+opacity 200ms, exit faster (150ms) — single ease. */
.auth-modal-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease);
}

.auth-modal-enter-active .auth-container {
  transition: transform var(--nc-duration-normal) var(--nc-ease);
}

.auth-modal-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease);
}

.auth-modal-leave-active .auth-container {
  transition: transform var(--nc-duration-fast) var(--nc-ease);
}

.auth-modal-enter-from,
.auth-modal-leave-to {
  opacity: 0;
}

.auth-modal-enter-from .auth-container,
.auth-modal-leave-to .auth-container {
  transform: scale(0.97);
}

.auth-logo {
  margin-bottom: 20px;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* Modal header — display 700, tight tracking (REDESIGN.md §4). */
.auth-title {
  font-family: var(--nc-font-display);
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-text);
  margin: 0 0 6px;
  letter-spacing: -0.015em;
  text-align: center;
}

.auth-desc {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  margin: 0 0 24px;
  line-height: 1.5;
  text-align: center;
}

/* Error banner — coral is the destructive/validation accent (REDESIGN.md §1). */
.auth-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.3);
  border-radius: var(--nc-radius-md);
  color: var(--nc-coral);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 1.4;
}

.auth-error svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.auth-field {
  margin-bottom: 14px;
}

/* Input label — mono micro-label (REDESIGN.md §5). */
.auth-label {
  display: block;
  font-family: var(--nc-font-mono);
  font-size: calc(0.68rem * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--nc-text-secondary);
  margin-bottom: 6px;
}

/* Input grammar: chip fill + hairline, focus = border-color only (no ring). */
.auth-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  outline: none;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.auth-input::placeholder {
  color: var(--nc-text-dim);
}

.auth-input:focus {
  border-color: var(--nc-accent);
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
  color: var(--nc-text-muted);
  border-radius: 0.35rem;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .auth-toggle-pw:hover {
    color: var(--nc-text);
  }
}

.auth-totp-toggle {
  width: 100%;
  padding: 0;
  margin-bottom: 14px;
  background: none;
  border: none;
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-accent);
  cursor: pointer;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.8;
  transition: opacity var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .auth-totp-toggle:hover {
    opacity: 1;
  }
}

.auth-input-totp {
  text-align: center;
  font-family: var(--nc-font-mono);
  font-size: calc(18px * var(--nc-text-scale, 1));
  letter-spacing: 0.3em;
  padding: 12px 14px;
}

/* Primary CTA — ink pill grammar (REDESIGN.md §5). */
.auth-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px 16px;
  margin-top: 4px;
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

@media (hover: hover) and (pointer: fine) {
  .auth-submit:hover:not(:disabled) {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

.auth-submit:active:not(:disabled) {
  transform: scale(0.97);
}

.auth-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.auth-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(var(--nc-bg-rgb), 0.3);
  border-top-color: var(--nc-bg);
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
  background: var(--nc-border-subtle);
}

/* Divider word — mono micro-label. */
.auth-divider span {
  font-family: var(--nc-font-mono);
  font-size: calc(0.66rem * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-muted);
}

.auth-browser-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  background: transparent;
  color: var(--nc-text-secondary);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .auth-browser-btn:hover {
    background: var(--nc-surface-3);
    color: var(--nc-text);
    border-color: var(--nc-border-active);
  }
}

.auth-browser-btn:active {
  transform: scale(0.97);
}

/* OAuth provider buttons — flat chip + hairline, monochrome marks
   (icons stay monochrome per REDESIGN.md §9). */
.auth-google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 8px;
  padding: 10px 16px;
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  background: var(--nc-chip-bg);
  color: var(--nc-text);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .auth-google-btn:hover:not(:disabled) {
    background: var(--nc-surface-3);
    border-color: var(--nc-border-active);
  }
}

.auth-google-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.auth-google-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Cancel — ghost text link: mono uppercase (REDESIGN.md §5). */
.auth-close-btn {
  margin-top: 16px;
  padding: 8px 20px;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--nc-text-secondary);
  font-family: var(--nc-font-mono);
  font-size: calc(0.78rem * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .auth-close-btn:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

.auth-close-btn:active {
  transform: scale(0.97);
}

/* Focus-visible — accent outline (inputs use border-color only). */
.auth-submit:focus-visible,
.auth-google-btn:focus-visible,
.auth-browser-btn:focus-visible,
.auth-close-btn:focus-visible,
.auth-toggle-pw:focus-visible,
.auth-totp-toggle:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component overrides are needed. */
</style>
