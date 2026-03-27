<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const email = computed(() => route.query.email as string | undefined)
</script>

<template>
  <div class="verify-page">
    <div class="verify-container">
      <!-- Logo & brand -->
      <NuxtLink to="/" class="brand">
        <NcLogo :size="18" :container-size="36" :radius="8" />
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
.verify-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
}

.verify-container {
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
  gap: 10px;
  text-decoration: none;
  margin-bottom: 32px;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  color: #FAFAFA;
  letter-spacing: -0.03em;
}

/* Card */
.verify-card {
  width: 100%;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 8px;
  padding: 40px 32px;
  text-align: center;
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: rgba(0, 210, 190, 0.08);
  border-radius: 8px;
  margin-bottom: 20px;
}

.verify-icon {
  font-size: 24px;
  color: #00D2BE;
}

.verify-title {
  font-size: 20px;
  font-weight: 600;
  color: #FAFAFA;
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.verify-message {
  font-size: 14px;
  color: #A1A1AA;
  margin: 0 0 4px;
  line-height: 22px;
}

.verify-message strong {
  color: #FAFAFA;
  font-weight: 500;
}

.verify-hint {
  font-size: 13px;
  color: #52525B;
  margin: 0 0 24px;
  line-height: 20px;
}

/* Tips */
.verify-tips {
  background: #0D0D0F;
  border: 1px solid #1A1A1E;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: left;
}

.tips-title {
  font-size: 13px;
  font-weight: 500;
  color: #A1A1AA;
  margin: 0 0 10px;
}

.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tips-list li {
  font-size: 13px;
  color: #A1A1AA;
  padding-left: 16px;
  position: relative;
  line-height: 20px;
}

.tips-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  width: 4px;
  height: 4px;
  background: #00D2BE;
  border-radius: 50%;
}

/* Back button */
.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 20px;
  min-height: 44px;
  background: #00D2BE;
  border: none;
  border-radius: 6px;
  color: #09090B;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.15s;
}

.back-btn:hover {
  opacity: 0.9;
}

/* Light theme */
:root.light .verify-page {
  background: #FAFAF9;
}

:root.light .brand-name {
  color: #111111;
}

:root.light .verify-card {
  background: #F5F5F3;
  border-color: #E8E8E6;
}

:root.light .icon-wrapper {
  background: rgba(0, 210, 190, 0.08);
}

:root.light .verify-icon {
  color: #00D2BE;
}

:root.light .verify-title {
  color: #111111;
}

:root.light .verify-message {
  color: #52525B;
}

:root.light .verify-message strong {
  color: #111111;
}

:root.light .verify-hint {
  color: #777777;
}

:root.light .verify-tips {
  background: #F4F4F5;
  border-color: #E8E8E6;
}

:root.light .tips-title {
  color: #52525B;
}

:root.light .tips-list li {
  color: #52525B;
}

:root.light .tips-list li::before {
  background: #00D2BE;
}

:root.light .back-btn {
  background: #00D2BE;
  color: #FFFFFF;
}

:root.light .back-btn:hover {
  opacity: 0.9;
}
</style>
