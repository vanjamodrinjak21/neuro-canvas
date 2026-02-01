<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()

// Error codes and their messages
const errorMessages: Record<string, { title: string; message: string }> = {
  Configuration: {
    title: 'Server Error',
    message: 'There is a problem with the server configuration. Please try again later.'
  },
  AccessDenied: {
    title: 'Access Denied',
    message: 'You do not have permission to sign in. This might be because your email is not allowed.'
  },
  Verification: {
    title: 'Verification Failed',
    message: 'The sign in link has expired or has already been used. Please request a new one.'
  },
  OAuthSignin: {
    title: 'Sign In Error',
    message: 'An error occurred while trying to sign in with that provider. Please try again.'
  },
  OAuthCallback: {
    title: 'Callback Error',
    message: 'An error occurred during the sign in callback. Please try again.'
  },
  OAuthCreateAccount: {
    title: 'Account Creation Failed',
    message: 'Could not create an account with that provider. The email might already be in use.'
  },
  EmailCreateAccount: {
    title: 'Account Creation Failed',
    message: 'Could not create an account with that email. Please try a different email.'
  },
  Callback: {
    title: 'Callback Error',
    message: 'An error occurred during the authentication callback. Please try again.'
  },
  OAuthAccountNotLinked: {
    title: 'Account Not Linked',
    message: 'This email is already associated with a different sign-in method. Please use your original sign-in method.'
  },
  EmailSignin: {
    title: 'Email Error',
    message: 'Could not send the sign in email. Please check your email address and try again.'
  },
  CredentialsSignin: {
    title: 'Sign In Failed',
    message: 'The email or password you entered is incorrect. Please try again.'
  },
  SessionRequired: {
    title: 'Session Required',
    message: 'You need to be signed in to access this page.'
  },
  Default: {
    title: 'Authentication Error',
    message: 'An unexpected error occurred. Please try again.'
  }
}

const errorCode = computed(() => (route.query.error as string) || 'Default')

const errorInfo = computed(() => {
  return errorMessages[errorCode.value] || errorMessages.Default
})
</script>

<template>
  <div class="auth-page">
    <!-- Background effects -->
    <div class="bg-grid" />
    <div class="glow-orb glow-orb-1" />
    <div class="glow-orb glow-orb-2" />

    <div class="auth-container">
      <!-- Logo & brand -->
      <NuxtLink to="/" class="brand">
        <div class="logo-mark">
          <span class="i-lucide-feather logo-icon" />
        </div>
        <span class="brand-name">NeuroCanvas</span>
      </NuxtLink>

      <!-- Error card -->
      <div class="error-card">
        <div class="icon-wrapper">
          <span class="i-lucide-alert-triangle error-icon" />
        </div>

        <h1 class="error-title">{{ errorInfo.title }}</h1>
        <p class="error-message">{{ errorInfo.message }}</p>

        <div class="error-actions">
          <NuxtLink to="/auth/signin" class="primary-btn">
            Try again
          </NuxtLink>
          <NuxtLink to="/" class="secondary-btn">
            Back to home
          </NuxtLink>
        </div>

        <p v-if="errorCode !== 'Default'" class="error-code">
          Error code: {{ errorCode }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  --bg: #06060A;
  --surface: #0C0C10;
  --border: #252529;
  --text: #FAFAFA;
  --text-muted: #71717A;
  --accent: #00D2BE;
  --accent-glow: rgba(0, 210, 190, 0.12);
  --accent-glow-strong: rgba(0, 210, 190, 0.25);
  --error: #EF4444;
  --error-glow: rgba(239, 68, 68, 0.15);

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

/* Background effects */
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
  background: radial-gradient(circle, var(--error-glow) 0%, transparent 60%);
}

.glow-orb-2 {
  width: 500px;
  height: 500px;
  bottom: -200px;
  left: -100px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 60%);
}

/* Container */
.auth-container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 420px;
}

/* Brand */
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

/* Error card */
.error-card {
  width: 100%;
  background: rgba(12, 12, 16, 0.8);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 2.5rem 2rem;
  text-align: center;
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background: var(--error-glow);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 20px;
  margin-bottom: 1.5rem;
}

.error-icon {
  font-size: 2.25rem;
  color: var(--error);
}

.error-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.75rem;
  letter-spacing: -0.02em;
}

.error-message {
  font-size: 1rem;
  color: var(--text-muted);
  margin: 0 0 2rem;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, var(--accent), #00A89A);
  color: var(--bg);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  border-radius: 12px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 20px var(--accent-glow);
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px var(--accent-glow-strong);
}

.secondary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 1.5rem;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.secondary-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}

.error-code {
  margin: 1.5rem 0 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
  font-family: 'JetBrains Mono', monospace;
}

/* Responsive */
@media (max-width: 480px) {
  .auth-page {
    padding: 1rem;
  }

  .error-card {
    padding: 2rem 1.5rem;
    border-radius: 20px;
  }

  .error-title {
    font-size: 1.5rem;
  }
}
</style>
