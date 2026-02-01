<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()

// Get signIn function
let signIn: any = null
let authStatus: any = null
try {
  const auth = useAuth()
  signIn = auth.signIn
  authStatus = auth.status
  console.log('useAuth loaded, status:', auth.status.value)
} catch (e) {
  console.error('useAuth failed:', e)
}

// Log on mount
onMounted(() => {
  console.log('Signin page mounted')
  console.log('Auth status:', authStatus?.value)
  console.log('Callback error:', callbackError.value)
  console.log('Route query:', route.query)
})

// Check for error from callback
const callbackError = computed(() => {
  const err = route.query.error as string | undefined
  if (err === 'CredentialsSignin') return 'Invalid email or password.'
  if (err === 'OAuthAccountNotLinked') return 'This email is already registered with a different sign-in method.'
  if (err === 'OAuthSignin' || err === 'OAuthCallback') return 'There was a problem signing in. Please try again.'
  if (err) return 'An error occurred. Please try again.'
  return null
})

// Form state
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const message = ref('')
const messageType = ref<'error' | 'success'>('error')

// Validation
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const isEmailValid = computed(() => emailRegex.test(email.value))

const canSubmit = computed(() =>
  email.value &&
  password.value &&
  isEmailValid.value &&
  !isLoading.value
)

async function handleSignin() {
  message.value = ''

  if (!email.value || !password.value) {
    message.value = 'Please enter email and password'
    messageType.value = 'error'
    return
  }

  if (!isEmailValid.value) {
    message.value = 'Please enter a valid email address'
    messageType.value = 'error'
    return
  }

  if (!signIn) {
    message.value = 'Authentication service unavailable'
    messageType.value = 'error'
    return
  }

  isLoading.value = true
  message.value = 'Signing in...'
  messageType.value = 'success'

  // Test if auth API is reachable
  try {
    const testResponse = await fetch('/api/auth/session')
    console.log('Auth API test:', testResponse.status, await testResponse.text())
  } catch (e) {
    console.error('Auth API unreachable:', e)
    message.value = 'Auth service unreachable'
    messageType.value = 'error'
    isLoading.value = false
    return
  }

  try {
    console.log('Calling signIn...')
    const result = await signIn('credentials', {
      email: email.value,
      password: password.value,
      redirect: false
    })

    console.log('SignIn result:', JSON.stringify(result))

    if (result?.error) {
      message.value = result.error === 'CredentialsSignin'
        ? 'Invalid email or password'
        : result.error
      messageType.value = 'error'
      isLoading.value = false
      return
    }

    if (result?.ok) {
      // Success - force full page reload to /dashboard
      message.value = 'Success! Redirecting...'
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 500)
    } else {
      message.value = 'Unexpected response: ' + JSON.stringify(result)
      messageType.value = 'error'
      isLoading.value = false
    }
  } catch (e: any) {
    console.error('SignIn error:', e)
    message.value = 'Error: ' + (e.message || 'Sign in failed')
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
          <h1 class="auth-title">Welcome back</h1>
          <p class="auth-subtitle">Sign in to continue to NeuroCanvas</p>
        </div>

        <!-- Callback error -->
        <div v-if="callbackError" class="form-message error">
          {{ callbackError }}
        </div>

        <form class="signin-form" @submit.prevent="handleSignin">
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
              placeholder="Enter your password"
              class="form-input"
              :disabled="isLoading"
            >
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
            {{ isLoading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <p class="auth-footer">
          Don't have an account?
          <NuxtLink to="/auth/signup" class="auth-link">Sign up</NuxtLink>
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

.signin-form {
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
