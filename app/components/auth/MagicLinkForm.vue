<script setup lang="ts">
const {
  sendMagicLink,
  isSendingMagicLink,
  magicLinkSent,
  magicLinkError,
  clearErrors,
  resetMagicLinkState
} = useAuthStore()

const email = ref('')

const formError = computed(() => magicLinkError.value)

async function handleSubmit() {
  clearErrors()

  if (!email.value) {
    return
  }

  await sendMagicLink(email.value)
}

// Clear errors when email changes
watch(email, () => {
  if (magicLinkError.value) {
    clearErrors()
  }
})

// Reset state on unmount
onUnmounted(() => {
  resetMagicLinkState()
})

function resetForm() {
  resetMagicLinkState()
  email.value = ''
}
</script>

<template>
  <div class="magic-link-form">
    <!-- Success state -->
    <div v-if="magicLinkSent" class="success-state">
      <div class="success-icon-wrapper">
        <span class="i-lucide-mail-check success-icon" />
      </div>
      <h3 class="success-title">Check your email</h3>
      <p class="success-message">
        We sent a sign-in link to <strong>{{ email }}</strong>
      </p>
      <p class="success-hint">
        Click the link in the email to sign in. The link will expire in 24 hours.
      </p>
      <button type="button" class="resend-btn" @click="resetForm">
        <span class="i-lucide-arrow-left" />
        Use a different email
      </button>
    </div>

    <!-- Form state -->
    <form v-else @submit.prevent="handleSubmit">
      <p class="form-description">
        Enter your email address and we'll send you a sign-in link.
        No password required.
      </p>

      <div class="form-field">
        <label for="magic-email" class="form-label">Email</label>
        <NcInput
          id="magic-email"
          v-model="email"
          type="email"
          placeholder="you@example.com"
          :disabled="isSendingMagicLink"
          autocomplete="email"
        />
      </div>

      <!-- Error message -->
      <div v-if="formError" class="form-error">
        <span class="i-lucide-alert-circle error-icon" />
        <span>{{ formError }}</span>
      </div>

      <NcButton
        type="submit"
        variant="primary"
        class="submit-btn"
        :loading="isSendingMagicLink"
        :disabled="!email"
      >
        <span class="i-lucide-mail" />
        Send magic link
      </NcButton>
    </form>
  </div>
</template>

<style scoped>
.magic-link-form {
  width: 100%;
}

.form-description {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
  margin: 0 0 1.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
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
  margin-bottom: 1.25rem;
}

.error-icon {
  flex-shrink: 0;
}

.submit-btn {
  width: 100%;
}

/* Success state */
.success-state {
  text-align: center;
  padding: 1rem 0;
}

.success-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 16px;
  margin-bottom: 1.5rem;
}

.success-icon {
  font-size: 2rem;
  color: var(--nc-teal, #00D2BE);
}

.success-title {
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  color: var(--nc-ink, #FAFAFA);
}

.success-message {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 0.5rem;
}

.success-message strong {
  color: var(--nc-ink, #FAFAFA);
}

.success-hint {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 1.5rem;
}

.resend-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.resend-btn:hover {
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--nc-ink, #FAFAFA);
}
</style>
