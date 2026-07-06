<script setup lang="ts">
definePageMeta({
  layout: false
})

const { t } = useI18n()
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

        <h1 class="verify-title">{{ $t('auth.verify.title') }}</h1>

        <p v-if="email" class="verify-message">
          {{ $t('auth.verify.message_with_email') }} <strong>{{ email }}</strong>
        </p>
        <p v-else class="verify-message">
          {{ $t('auth.verify.message_without_email') }}
        </p>

        <p class="verify-hint">
          {{ $t('auth.verify.hint') }}
        </p>

        <div class="verify-tips">
          <h3 class="tips-title">{{ $t('auth.verify.tips_title') }}</h3>
          <ul class="tips-list">
            <li>{{ $t('auth.verify.tip_spam') }}</li>
            <li>{{ $t('auth.verify.tip_email') }}</li>
            <li>{{ $t('auth.verify.tip_wait') }}</li>
          </ul>
        </div>

        <NuxtLink to="/auth/signin" class="back-btn">
          <span class="i-lucide-arrow-left" />
          {{ $t('auth.verify.back_button') }}
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
  background: var(--nc-bg);
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
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-text);
  letter-spacing: -0.03em;
}

/* Card */
.verify-card {
  width: 100%;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
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
  background: rgba(var(--nc-accent-rgb), 0.08);
  border-radius: 8px;
  margin-bottom: 20px;
}

.verify-icon {
  font-size: calc(24px * var(--nc-text-scale, 1));
  color: var(--nc-accent);
}

.verify-title {
  font-size: calc(20px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.verify-message {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  margin: 0 0 4px;
  line-height: 22px;
}

.verify-message strong {
  color: var(--nc-text);
  font-weight: 500;
}

.verify-hint {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  margin: 0 0 24px;
  line-height: 20px;
}

/* Tips */
.verify-tips {
  background: var(--nc-bg);
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: left;
}

.tips-title {
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
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
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
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
  background: var(--nc-accent);
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
  background: var(--nc-accent);
  border: none;
  border-radius: 6px;
  color: var(--nc-bg);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.15s;
}

.back-btn:hover {
  opacity: 0.9;
}

/* Light theme is carried entirely by the :root.light token rebase in
   tokens.css — the former hardcoded overrides became no-ops. */
</style>
