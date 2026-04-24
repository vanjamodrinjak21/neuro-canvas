<script setup lang="ts">
definePageMeta({
  layout: false
})

const { t } = useI18n()
const route = useRoute()

const errorKeyMap: Record<string, string> = {
  Configuration: 'configuration',
  AccessDenied: 'access_denied',
  Verification: 'verification',
  OAuthSignin: 'oauth_signin',
  OAuthCallback: 'oauth_callback',
  OAuthCreateAccount: 'oauth_create_account',
  EmailCreateAccount: 'oauth_create_account',
  Callback: 'oauth_callback',
  OAuthAccountNotLinked: 'oauth_account_not_linked',
  EmailSignin: 'oauth_signin',
  CredentialsSignin: 'credentials_signin',
  SessionRequired: 'session_required',
  Default: 'default'
}

const errorCode = computed(() => (route.query.error as string) || 'Default')
const errorInfo = computed(() => {
  const key = errorKeyMap[errorCode.value] || 'default'
  return {
    title: t(`auth.error.${key}.title`),
    message: t(`auth.error.${key}.message`)
  }
})
</script>

<template>
  <div class="error-page">
    <div class="error-container">
      <!-- Logo & brand -->
      <NuxtLink to="/" class="brand">
        <NcLogo :size="18" :container-size="36" :radius="8" />
        <span class="brand-name">NeuroCanvas</span>
      </NuxtLink>

      <!-- Shield illustration -->
      <div class="illustration" aria-hidden="true">
        <svg width="300" height="240" viewBox="0 0 300 240" fill="none">
          <!-- Shield body -->
          <path
            d="M150 20 L230 60 L230 130 Q230 190 150 220 Q70 190 70 130 L70 60 Z"
            class="shield-body"
          />
          <!-- Broken cable -->
          <path
            d="M150 60 L155 90 L145 110 L155 140 L148 170"
            stroke="#EF4444"
            stroke-width="2"
            stroke-linecap="round"
            opacity="0.6"
          />
          <!-- X mark -->
          <line x1="130" y1="100" x2="170" y2="140" stroke="#EF4444" stroke-width="3" stroke-linecap="round" opacity="0.7" />
          <line x1="170" y1="100" x2="130" y2="140" stroke="#EF4444" stroke-width="3" stroke-linecap="round" opacity="0.7" />
          <!-- Lock -->
          <rect x="138" y="155" width="24" height="18" rx="3" fill="#27272A" stroke="#3F3F46" stroke-width="1.5" />
          <path d="M143 155 L143 148 Q143 140 150 140 Q157 140 157 148 L157 155" stroke="#3F3F46" stroke-width="1.5" fill="none" stroke-linecap="round" />
          <circle cx="150" cy="164" r="2" fill="#EF4444" opacity="0.7" />
        </svg>
      </div>

      <!-- Copy -->
      <h1 class="heading">{{ $t('auth.error.page_heading') }}</h1>
      <p class="desc">
        {{ $t('auth.error.page_desc') }}
      </p>

      <!-- Actions -->
      <div class="actions">
        <NuxtLink to="/auth/signin" class="btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
          {{ $t('auth.error.button_signin') }}
        </NuxtLink>
        <NuxtLink to="/" class="btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          {{ $t('auth.error.button_home') }}
        </NuxtLink>
      </div>

      <!-- Error code footer -->
      <div class="error-footer">
        <span class="error-badge">{{ $t('auth.error.badge') }}</span>
        <span class="error-details">{{ errorCode !== 'Default' ? errorCode : 'session_expired' }} · token_invalid · try_again_or_cry</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
}

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

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 500px;
}

/* Illustration */
.illustration {
  margin-bottom: 12px;
}

.shield-body {
  stroke: #27272A;
  stroke-width: 2;
  fill: #111113;
}

/* Copy */
.heading {
  font-family: 'Instrument Serif', serif;
  font-size: 28px;
  font-weight: 400;
  font-style: italic;
  line-height: 36px;
  color: #FAFAFA;
  margin: 0 0 8px;
}

.desc {
  font-size: 14px;
  line-height: 22px;
  color: #71717A;
  margin: 0 0 28px;
}

/* Actions */
.actions {
  display: flex;
  gap: 10px;
  margin-bottom: 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px;
  min-height: 44px;
  background: #00D2BE;
  color: #09090B;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s;
  font-family: inherit;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px;
  min-height: 44px;
  background: transparent;
  border: 1px solid #27272A;
  color: #A1A1AA;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s;
  font-family: inherit;
}

.btn-ghost:hover {
  border-color: #3F3F46;
  color: #FAFAFA;
}

/* Error footer */
.error-footer {
  position: fixed;
  bottom: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  line-height: 14px;
  color: #EF4444;
  opacity: 0.85;
  padding: 3px 8px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
}

.error-details {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  line-height: 14px;
  color: #71717A;
}

/* Light theme */
:root.light .brand-name {
  color: #111111;
}

:root.light .error-page {
  background: #FAFAF9;
}

:root.light .shield-body {
  stroke: #D4D4D8;
  fill: #F5F5F3;
}

:root.light .heading {
  color: #111111;
}

:root.light .desc {
  color: #71717A;
}

:root.light .btn-primary {
  color: #FFFFFF;
}

:root.light .btn-ghost {
  border-color: #E8E8E6;
  color: #52525B;
}

:root.light .btn-ghost:hover {
  border-color: #D4D4D8;
  color: #111111;
}

:root.light .error-badge {
  border-color: rgba(239, 68, 68, 0.15);
}

:root.light .error-details {
  color: #D4D4D8;
}

/* Responsive */
@media (max-width: 480px) {
  .actions {
    flex-direction: column;
    width: 100%;
  }

  .btn-primary,
  .btn-ghost {
    justify-content: center;
    width: 100%;
  }
}
</style>
