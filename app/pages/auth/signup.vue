<script setup lang="ts">
definePageMeta({
  layout: false
})

// Get signIn function for OAuth
let signIn: any = null
try {
  const auth = useAuth()
  signIn = auth.signIn
} catch (e) {
  console.error('useAuth failed:', e)
}

// OAuth loading states
const isGoogleLoading = ref(false)
const isGithubLoading = ref(false)

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

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const message = ref('')
const messageType = ref<'error' | 'success'>('error')

// Validation
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const hasLowercase = computed(() => /[a-z]/.test(password.value))
const hasUppercase = computed(() => /[A-Z]/.test(password.value))
const hasNumber = computed(() => /\d/.test(password.value))
const hasMinLength = computed(() => password.value.length >= 8)
const isPasswordValid = computed(() => hasLowercase.value && hasUppercase.value && hasNumber.value && hasMinLength.value)
const isEmailValid = computed(() => emailRegex.test(email.value))
const passwordsMatch = computed(() => password.value === confirmPassword.value)

const canSubmit = computed(() =>
  email.value &&
  password.value &&
  confirmPassword.value &&
  isEmailValid.value &&
  isPasswordValid.value &&
  passwordsMatch.value &&
  !isLoading.value
)

async function handleSignup() {
  message.value = ''

  if (!email.value || !password.value || !confirmPassword.value) {
    message.value = 'Please fill in all required fields'
    messageType.value = 'error'
    return
  }

  if (!isEmailValid.value) {
    message.value = 'Please enter a valid email address'
    messageType.value = 'error'
    return
  }

  if (!isPasswordValid.value) {
    message.value = 'Password does not meet requirements'
    messageType.value = 'error'
    return
  }

  if (!passwordsMatch.value) {
    message.value = 'Passwords do not match'
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

    message.value = 'Account created successfully! Redirecting to sign in...'
    messageType.value = 'success'

    setTimeout(async () => {
      await navigateTo('/auth/signin', { replace: true })
    }, 1500)
  } catch (e: any) {
    message.value = e.data?.statusMessage || e.message || 'Registration failed. Please try again.'
    messageType.value = 'error'
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="bg-grid" />
    <div class="glow-orb glow-orb-1" />
    <div class="glow-orb glow-orb-2" />

    <div class="auth-container">
      <NuxtLink to="/" class="brand">
        <div class="logo-mark">
          <span class="i-lucide-feather logo-icon" />
        </div>
        <span class="brand-name">NeuroCanvas</span>
      </NuxtLink>

      <div class="auth-card">
        <div class="auth-header">
          <h1 class="auth-title">Create your account</h1>
          <p class="auth-subtitle">Start mapping your ideas with AI</p>
        </div>

        <!-- OAuth Buttons -->
        <div class="oauth-buttons">
          <button
            type="button"
            class="oauth-btn"
            :disabled="isGoogleLoading || isGithubLoading"
            @click="handleGoogleSignin"
          >
            <span v-if="isGoogleLoading" class="spinner"></span>
            <svg v-else class="oauth-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            class="oauth-btn"
            :disabled="isGoogleLoading || isGithubLoading"
            @click="handleGithubSignin"
          >
            <span v-if="isGithubLoading" class="spinner"></span>
            <svg v-else class="oauth-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="#FAFAFA" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div class="divider">
          <span>or continue with email</span>
        </div>

        <form class="signup-form" @submit.prevent="handleSignup">
          <!-- Name -->
          <div class="form-field">
            <label class="form-label">Name <span class="optional">(optional)</span></label>
            <input
              v-model="name"
              type="text"
              placeholder="Your name"
              class="form-input"
              :disabled="isLoading"
            >
          </div>

          <!-- Email -->
          <div class="form-field">
            <label class="form-label">Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="form-input"
              :class="{ 'input-error': email && !isEmailValid, 'input-valid': email && isEmailValid }"
              :disabled="isLoading"
            >
            <span v-if="email && !isEmailValid" class="field-error">Please enter a valid email</span>
          </div>

          <!-- Password -->
          <div class="form-field">
            <label class="form-label">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Create a password"
              class="form-input"
              :class="{ 'input-error': password && !isPasswordValid, 'input-valid': password && isPasswordValid }"
              :disabled="isLoading"
            >
            <!-- Password requirements -->
            <div class="password-requirements">
              <span :class="{ valid: hasMinLength }">8+ characters</span>
              <span :class="{ valid: hasUppercase }">Uppercase</span>
              <span :class="{ valid: hasLowercase }">Lowercase</span>
              <span :class="{ valid: hasNumber }">Number</span>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="form-field">
            <label class="form-label">Confirm Password</label>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              class="form-input"
              :class="{ 'input-error': confirmPassword && !passwordsMatch, 'input-valid': confirmPassword && passwordsMatch }"
              :disabled="isLoading"
            >
            <span v-if="confirmPassword && !passwordsMatch" class="field-error">Passwords do not match</span>
          </div>

          <!-- Message -->
          <div v-if="message" :class="['form-message', messageType]">
            {{ message }}
          </div>

          <!-- Submit -->
          <button
            type="submit"
            class="submit-btn"
            :disabled="!canSubmit || isLoading"
          >
            <span v-if="isLoading" class="spinner"></span>
            {{ isLoading ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <p class="auth-footer">
          Already have an account?
          <NuxtLink to="/auth/signin" class="auth-link">Sign in</NuxtLink>
        </p>
      </div>

      <NuxtLink to="/" class="back-link">
        <span class="i-lucide-arrow-left" />
        Back to home
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  --bg: #06060A;
  --border: #252529;
  --text: #FAFAFA;
  --text-muted: #71717A;
  --accent: #00D2BE;
  --accent-glow: rgba(0, 210, 190, 0.12);
  --accent-glow-strong: rgba(0, 210, 190, 0.25);
  --error: #EF4444;
  --success: #10B981;

  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--bg);
  position: relative;
  overflow: hidden;
  font-family: 'Cabinet Grotesk', 'Inter', system-ui, sans-serif;
}

.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 80% 50% at 50% 50%, black 30%, transparent 100%);
  pointer-events: none;
}

.glow-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(80px);
}

.glow-orb-1 {
  width: 600px;
  height: 600px;
  top: -200px;
  right: -100px;
  background: radial-gradient(circle, var(--accent-glow-strong) 0%, transparent 60%);
}

.glow-orb-2 {
  width: 500px;
  height: 500px;
  bottom: -200px;
  left: -100px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 60%);
}

.auth-container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 420px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  margin-bottom: 2rem;
}

.logo-mark {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, var(--accent), #00A89A);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px var(--accent-glow-strong);
}

.logo-icon {
  font-size: 1.375rem;
  color: var(--bg);
}

.brand-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.auth-card {
  width: 100%;
  background: rgba(12, 12, 16, 0.8);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 2rem;
}

.auth-header {
  text-align: center;
  margin-bottom: 1.75rem;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.5rem;
}

.auth-subtitle {
  font-size: 1rem;
  color: var(--text-muted);
  margin: 0;
}

/* OAuth Buttons */
.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.oauth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.875rem 1rem;
  background: rgba(24, 24, 28, 0.6);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.oauth-btn:hover:not(:disabled) {
  background: rgba(32, 32, 38, 0.8);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.oauth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.oauth-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.oauth-btn:hover:not(:disabled) .oauth-icon {
  transform: scale(1.15);
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.divider span {
  font-size: 0.85rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.optional {
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(24, 24, 28, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #FAFAFA;
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
}

.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 210, 190, 0.1);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.form-input.input-error {
  border-color: var(--error);
}

.form-input.input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.form-input.input-valid {
  border-color: var(--success);
}

.form-input.input-valid:focus {
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.field-error {
  font-size: 0.8rem;
  color: var(--error);
}

.password-requirements {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.password-requirements span {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
  transition: all 0.2s;
}

.password-requirements span.valid {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
}

.form-message {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
  text-align: center;
}

.form-message.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--error);
}

.form-message.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: var(--success);
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, var(--accent), #00A89A);
  border: none;
  border-radius: 10px;
  color: #0A0A0C;
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0, 210, 190, 0.3);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: #0A0A0C;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.auth-footer {
  text-align: center;
  font-size: 0.95rem;
  color: var(--text-muted);
  margin: 1.5rem 0 0;
}

.auth-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.auth-link:hover {
  text-decoration: underline;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--text);
}

@media (max-width: 480px) {
  .auth-page {
    padding: 1rem;
  }
  .auth-card {
    padding: 1.5rem;
    border-radius: 20px;
  }
  .auth-title {
    font-size: 1.5rem;
  }
}
</style>
