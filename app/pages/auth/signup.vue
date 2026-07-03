<script setup lang="ts">
definePageMeta({
  layout: false
})

const { t } = useI18n()

useHead(() => ({ title: `${t('topo.auth.signupTitle').replace(/\*/g, '')} — NeuroCanvas` }))

let signIn: any = null
try {
  const auth = useAuth()
  signIn = auth.signIn
} catch (e) {
  console.error('useAuth failed:', e)
}

// OAuth — GitHub is web-only (hidden in the Mac/iOS apps); Apple shows once configured.
const { isNative, isWindows } = usePlatform()
// Apple shows once configured, but never on Windows where Sign in with Apple
// isn't offered.
const appleAuthEnabled = computed(() => !!useRuntimeConfig().public.appleAuthEnabled && !isWindows.value)
const isGoogleLoading = ref(false)
const isGithubLoading = ref(false)
const isAppleLoading = ref(false)

async function handleGoogleSignin() {
  if (!signIn) return
  isGoogleLoading.value = true
  try {
    await signIn('google', { callbackUrl: '/dashboard' })
  } catch (e) {
    console.error('Google signin error:', e)
    isGoogleLoading.value = false
  }
}

async function handleGithubSignin() {
  if (!signIn) return
  isGithubLoading.value = true
  try {
    await signIn('github', { callbackUrl: '/dashboard' })
  } catch (e) {
    console.error('GitHub signin error:', e)
    isGithubLoading.value = false
  }
}

async function handleAppleSignin() {
  if (!signIn) return
  isAppleLoading.value = true
  try {
    await signIn('apple', { callbackUrl: '/dashboard' })
  } catch (e) {
    console.error('Apple signin error:', e)
    isAppleLoading.value = false
  }
}

// Form
const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const touched = ref(false)
const isLoading = ref(false)
const message = ref('')
const messageType = ref<'error' | 'success'>('error')

const emailRegex = /^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const hasLowercase = computed(() => /[a-z]/.test(password.value))
const hasUppercase = computed(() => /[A-Z]/.test(password.value))
const hasNumber = computed(() => /\d/.test(password.value))
const hasMinLength = computed(() => password.value.length >= 8)
const isPasswordValid = computed(() => hasLowercase.value && hasUppercase.value && hasNumber.value && hasMinLength.value)
const isEmailValid = computed(() => emailRegex.test(email.value))
const confirmValid = computed(() => password.value.length > 0 && passwordConfirm.value === password.value)

const canSubmit = computed(() =>
  email.value &&
  password.value &&
  isEmailValid.value &&
  isPasswordValid.value &&
  confirmValid.value &&
  !isLoading.value
)

async function handleSignup() {
  message.value = ''
  touched.value = true
  if (!email.value || !password.value) {
    message.value = t('auth.signup.validation.empty')
    messageType.value = 'error'
    return
  }
  if (!isEmailValid.value) {
    message.value = t('auth.signup.validation.invalid_email')
    messageType.value = 'error'
    return
  }
  if (!isPasswordValid.value) {
    message.value = t('auth.signup.validation.invalid_password')
    messageType.value = 'error'
    return
  }
  if (!confirmValid.value) {
    message.value = t('topo.auth.passwordMismatch')
    messageType.value = 'error'
    return
  }

  isLoading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        name: name.value || undefined
      }
    })
    message.value = t('auth.signup.success')
    messageType.value = 'success'
    setTimeout(async () => {
      await navigateTo('/auth/signin', { replace: true })
    }, 1500)
  } catch (e: any) {
    message.value = e.data?.statusMessage || e.message || t('auth.signup.error.default')
    messageType.value = 'error'
    isLoading.value = false
  }
}
</script>
<template>
  <LandingShell>
    <main id="content" class="subpage auth">
    <div class="auth__card survey-frame">
      <p class="subpage__eyebrow">
        <span class="num">ACCESS</span> · {{ t('topo.auth.eyebrowUp') }}
      </p>
      <LandingRevealText
        :text="t('topo.auth.signupTitle')"
        as="h1"
        class="auth__title"
        immediate
        :delay="0.15"
      />
      <p class="auth__sub">{{ t('topo.auth.signupSub') }}</p>

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

      <form class="auth__form" @submit.prevent="handleSignup">
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
              autocomplete="new-password"
              placeholder="••••••••"
              :aria-invalid="touched && !isPasswordValid ? 'true' : undefined"
              aria-describedby="auth-pass-hint"
            >
            <p
              id="auth-pass-hint"
              class="auth__hint"
              :class="{ 'is-ok': isPasswordValid, 'is-bad': touched && !isPasswordValid }"
            >
              {{ t('topo.auth.passwordHint') }}
            </p>
          </div>
        </Transition>

        <Transition name="field">
          <div v-if="isEmailValid" class="auth__reveal">
            <label class="auth__label" for="auth-confirm">{{ t('topo.auth.confirmLabel') }}</label>
            <input
              id="auth-confirm"
              v-model="passwordConfirm"
              class="auth__input"
              type="password"
              name="password-confirm"
              autocomplete="new-password"
              placeholder="••••••••"
              :aria-invalid="touched && !confirmValid ? 'true' : undefined"
            >
            <p v-if="touched && !confirmValid" class="auth__hint is-bad">
              {{ t('topo.auth.passwordMismatch') }}
            </p>
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
        v-if="message"
        class="auth__hint"
        :class="messageType === 'success' ? 'is-ok' : 'is-bad'"
        role="status"
      >
        {{ message }}
      </p>

      <p class="auth__switch">
        {{ t('topo.auth.haveAccount') }}
        <NuxtLink to="/auth/signin" data-cursor="link">{{ t('topo.auth.switchIn') }}</NuxtLink>
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
