<script setup lang="ts">
definePageMeta({
  layout: false
})

/**
 * Post-login TOTP verification (AER-84).
 *
 * OAuth sign-ins (Google / GitHub / Apple) complete without a second factor,
 * so 2FA-enabled accounts land here (routed by the auth middleware while
 * `session.user.totpPending`) and verify a code once per session.
 */

const { t } = useI18n()
const route = useRoute()
const { data: session, status, getSession, signOut } = useAuth()

const code = ref('')
const remember = ref(false)
const isLoading = ref(false)
const error = ref('')

const canSubmit = computed(() => /^\d{6}$/.test(code.value) && !isLoading.value)

// Only reachable signed-in; anyone else goes to the regular sign-in page.
// A session that is NOT pending has nothing to verify — send it home.
watchEffect(() => {
  if (import.meta.server) return
  if (status.value === 'unauthenticated') {
    void navigateTo('/auth/signin')
  } else if (status.value === 'authenticated'
    && !(session.value?.user as { totpPending?: boolean } | undefined)?.totpPending) {
    void navigateTo(redirectTarget())
  }
})

function redirectTarget(): string {
  const raw = route.query.redirect
  // Relative paths only — never an absolute URL (open-redirect guard).
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'
}

async function submit() {
  if (!canSubmit.value) return
  isLoading.value = true
  error.value = ''
  try {
    await $fetch('/api/user/totp/verify-session', {
      method: 'POST',
      body: { code: code.value, remember: remember.value }
    })
    // Refresh the session so totpPending clears before navigating.
    await getSession({ force: true })
    await navigateTo(redirectTarget())
  } catch (e: unknown) {
    const err = e as { statusCode?: number; data?: { statusMessage?: string } }
    error.value = err.statusCode === 429
      ? (err.data?.statusMessage || t('auth.twofa.error_invalid'))
      : t('auth.twofa.error_invalid')
    isLoading.value = false
  }
}

async function handleSignOut() {
  await signOut({ callbackUrl: '/auth/signin' })
}
</script>

<template>
  <div class="twofa">
    <div class="twofa__card">
      <div class="twofa__icon">
        <span class="i-lucide-shield-check" />
      </div>
      <h1 class="twofa__title">{{ t('auth.twofa.title') }}</h1>
      <p class="twofa__subtitle">{{ t('auth.twofa.subtitle') }}</p>

      <form class="twofa__form" @submit.prevent="submit">
        <label class="twofa__label" for="twofa-code">{{ t('auth.twofa.code_label') }}</label>
        <input
          id="twofa-code"
          v-model="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          class="twofa__input"
          :placeholder="t('auth.twofa.code_placeholder')"
          autofocus
        >
        <label class="twofa__remember">
          <input v-model="remember" type="checkbox" class="twofa__checkbox">
          <span>{{ t('auth.twofa.remember') }}</span>
        </label>
        <p v-if="error" class="twofa__error" role="alert">{{ error }}</p>
        <button type="submit" class="twofa__submit" :disabled="!canSubmit">
          {{ isLoading ? t('auth.twofa.submit_loading') : t('auth.twofa.submit') }}
        </button>
      </form>

      <button class="twofa__signout" type="button" @click="handleSignOut">
        {{ t('auth.twofa.signout') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.twofa {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #09090B;
  padding: 24px;
}

.twofa__card {
  width: 100%;
  max-width: 400px;
  background: #0F0F12;
  border: 1px solid #1F1F23;
  border-radius: 12px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.twofa__icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 210, 190, 0.08);
  color: #00D2BE;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 16px;
}

.twofa__title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  color: #FAFAFA;
  margin: 0 0 8px;
}

.twofa__subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #A1A1AA;
  margin: 0 0 24px;
}

.twofa__form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.twofa__label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #D4D4D8;
}

.twofa__input {
  width: 100%;
  padding: 10px 12px;
  background: #18181B;
  border: 1px solid #27272A;
  border-radius: 8px;
  color: #FAFAFA;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  letter-spacing: 0.3em;
  text-align: center;
  outline: none;
  transition: border-color 0.15s ease;
}

.twofa__input:focus {
  border-color: #00D2BE;
}

.twofa__remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: #A1A1AA;
  cursor: pointer;
  user-select: none;
}

.twofa__checkbox {
  accent-color: #00D2BE;
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.twofa__error {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: #F87171;
  margin: 0;
}

.twofa__submit {
  margin-top: 8px;
  width: 100%;
  padding: 10px 12px;
  background: #00D2BE;
  color: #09090B;
  border: none;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.twofa__submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.twofa__signout {
  margin-top: 20px;
  background: none;
  border: none;
  color: #71717A;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

:root.light .twofa { background: #FAFAFA; }
:root.light .twofa__card { background: #FFFFFF; border-color: #E4E4E7; }
:root.light .twofa__title { color: #18181B; }
:root.light .twofa__subtitle { color: #71717A; }
:root.light .twofa__label { color: #3F3F46; }
:root.light .twofa__input { background: #F4F4F5; border-color: #E4E4E7; color: #18181B; }
</style>
