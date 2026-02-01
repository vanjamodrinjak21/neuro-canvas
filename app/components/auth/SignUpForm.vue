<script setup lang="ts">
const router = useRouter()
const {
  register,
  signInWithCredentials,
  isRegistering,
  registrationError,
  clearErrors
} = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const localError = ref<string | null>(null)

const formError = computed(() => localError.value || registrationError.value)

const passwordsMatch = computed(() =>
  password.value === confirmPassword.value || confirmPassword.value === ''
)

const isValidPassword = computed(() => {
  const p = password.value
  return (
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[0-9]/.test(p)
  )
})

const canSubmit = computed(() =>
  email.value &&
  password.value &&
  confirmPassword.value &&
  passwordsMatch.value &&
  isValidPassword.value &&
  !isRegistering.value
)

async function handleSubmit() {
  clearErrors()
  localError.value = null

  if (!email.value || !password.value || !confirmPassword.value) {
    localError.value = 'Please fill in all required fields'
    return
  }

  if (!passwordsMatch.value) {
    localError.value = 'Passwords do not match'
    return
  }

  if (!isValidPassword.value) {
    localError.value = 'Password does not meet requirements'
    return
  }

  // Register the user
  const registered = await register(email.value, password.value, name.value || undefined)

  if (registered) {
    // Auto sign in after registration
    const signedIn = await signInWithCredentials(email.value, password.value)
    if (signedIn) {
      router.push('/dashboard')
    }
  }
}

// Clear errors when inputs change
watch([name, email, password, confirmPassword], () => {
  if (registrationError.value || localError.value) {
    clearErrors()
    localError.value = null
  }
})
</script>

<template>
  <form class="signup-form" @submit.prevent="handleSubmit">
    <!-- Name field (optional) -->
    <div class="form-field">
      <label for="name" class="form-label">
        Name <span class="optional">(optional)</span>
      </label>
      <NcInput
        id="name"
        v-model="name"
        type="text"
        placeholder="Your name"
        :disabled="isRegistering"
        autocomplete="name"
      />
    </div>

    <!-- Email field -->
    <div class="form-field">
      <label for="email" class="form-label">Email</label>
      <NcInput
        id="email"
        v-model="email"
        type="email"
        placeholder="you@example.com"
        :disabled="isRegistering"
        autocomplete="email"
      />
    </div>

    <!-- Password field -->
    <div class="form-field">
      <label for="password" class="form-label">Password</label>
      <PasswordInput
        id="password"
        v-model="password"
        placeholder="Create a password"
        :disabled="isRegistering"
        autocomplete="new-password"
      />
      <PasswordStrength :password="password" />
    </div>

    <!-- Confirm Password field -->
    <div class="form-field">
      <label for="confirm-password" class="form-label">Confirm Password</label>
      <PasswordInput
        id="confirm-password"
        v-model="confirmPassword"
        placeholder="Confirm your password"
        :disabled="isRegistering"
        :error="!passwordsMatch && confirmPassword ? 'Passwords do not match' : ''"
        autocomplete="new-password"
      />
    </div>

    <!-- Error message -->
    <div v-if="formError" class="form-error">
      <span class="i-lucide-alert-circle error-icon" />
      <span>{{ formError }}</span>
    </div>

    <!-- Submit button -->
    <NcButton
      type="submit"
      variant="primary"
      class="submit-btn"
      :loading="isRegistering"
      :disabled="!canSubmit"
    >
      Create account
    </NcButton>

    <!-- Terms notice -->
    <p class="terms-notice">
      By creating an account, you agree to our
      <a href="/terms" class="terms-link">Terms of Service</a>
      and
      <a href="/privacy" class="terms-link">Privacy Policy</a>
    </p>
  </form>
</template>

<style scoped>
.signup-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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

.form-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  color: #EF4444;
  font-size: 0.9rem;
}

.error-icon {
  flex-shrink: 0;
}

.submit-btn {
  width: 100%;
  margin-top: 0.5rem;
}

.terms-notice {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

.terms-link {
  color: var(--nc-teal, #00D2BE);
  text-decoration: none;
}

.terms-link:hover {
  text-decoration: underline;
}
</style>
