<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const email = computed(() => route.query.email as string | undefined)
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

      <!-- Verification card -->
      <div class="verify-card">
        <div class="icon-wrapper">
          <span class="i-lucide-mail-check verify-icon" />
        </div>

        <h1 class="verify-title">Check your email</h1>

        <p v-if="email" class="verify-message">
          We sent a sign-in link to <strong>{{ email }}</strong>
        </p>
        <p v-else class="verify-message">
          We sent you a sign-in link.
        </p>

        <p class="verify-hint">
          Click the link in the email to sign in to your account.
          The link will expire in 24 hours.
        </p>

        <div class="verify-tips">
          <h3 class="tips-title">Didn't receive the email?</h3>
          <ul class="tips-list">
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the correct email</li>
            <li>Wait a few minutes and try again</li>
          </ul>
        </div>

        <NuxtLink to="/auth/signin" class="back-btn">
          <span class="i-lucide-arrow-left" />
          Back to sign in
        </NuxtLink>
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
  background: radial-gradient(circle, var(--accent-glow-strong) 0%, transparent 60%);
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

/* Verify card */
.verify-card {
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
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 20px;
  margin-bottom: 1.5rem;
}

.verify-icon {
  font-size: 2.25rem;
  color: var(--accent);
}

.verify-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.75rem;
  letter-spacing: -0.02em;
}

.verify-message {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 0.5rem;
  line-height: 1.5;
}

.verify-message strong {
  color: var(--text);
}

.verify-hint {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin: 0 0 1.5rem;
  line-height: 1.6;
}

.verify-tips {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 14px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  text-align: left;
}

.tips-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 0.75rem;
}

.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tips-list li {
  font-size: 0.9rem;
  color: var(--text-muted);
  padding-left: 1.25rem;
  position: relative;
}

.tips-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.5em;
  width: 4px;
  height: 4px;
  background: var(--accent);
  border-radius: 50%;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 0.9rem;
  text-decoration: none;
  transition: all 0.2s ease;
}

.back-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}

/* Responsive */
@media (max-width: 480px) {
  .auth-page {
    padding: 1rem;
  }

  .verify-card {
    padding: 2rem 1.5rem;
    border-radius: 20px;
  }

  .verify-title {
    font-size: 1.5rem;
  }
}
</style>
