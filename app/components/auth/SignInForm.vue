<script setup lang="ts">
const router = useRouter()
const { signInWithCredentials, isSigningIn, signInError, clearErrors } = useAuthStore()

const email = ref('')
const password = ref('')

const formError = computed(() => signInError.value)

async function handleSubmit() {
  clearErrors()

  if (!email.value || !password.value) {
    return
  }

  const success = await signInWithCredentials(email.value, password.value)

  if (success) {
    router.push('/dashboard')
  }
}

// Clear errors when inputs change
watch([email, password], () => {
  if (signInError.value) {
    clearErrors()
  }
})
</script>

<template>
  <form class="signin-form" @submit.prevent="handleSubmit">
    <!-- Email field -->
    <div class="form-field">
      <label for="email" class="form-label">Email</label>
      <NcInput
        id="email"
        v-model="email"
        type="email"
        placeholder="you@example.com"
        :disabled="isSigningIn"
        autocomplete="email"
      />
    </div>

    <!-- Password field -->
    <div class="form-field">
      <div class="form-label-row">
        <label for="password" class="form-label">Password</label>
        <NuxtLink to="/auth/forgot-password" class="forgot-link">
          Forgot password?
        </NuxtLink>
      </div>
      <PasswordInput
        id="password"
        v-model="password"
        placeholder="Enter your password"
        :disabled="isSigningIn"
        autocomplete="current-password"
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
      :loading="isSigningIn"
      :disabled="!email || !password"
    >
      Sign in
    </NcButton>
  </form>
</template>

<style scoped>
.signin-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.forgot-link {
  font-size: 0.85rem;
  color: var(--nc-teal, #00D2BE);
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.forgot-link:hover {
  opacity: 0.8;
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
</style>
