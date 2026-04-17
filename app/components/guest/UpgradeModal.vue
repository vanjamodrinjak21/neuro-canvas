<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'
import type { GuestRestrictedFeature } from '~/composables/useGuestMode'

const guest = useGuestMode()
const router = useRouter()

const featureIcons: Record<GuestRestrictedFeature, string> = {
  'export': 'i-lucide-download',
  'share': 'i-lucide-share-2',
  'ai': 'i-lucide-sparkles',
  'ai-settings': 'i-lucide-sliders-horizontal',
  'new-map': 'i-lucide-file-plus',
  'account-settings': 'i-lucide-settings',
  'sync': 'i-lucide-refresh-cw',
}

const currentIcon = computed(() => {
  const feature = guest.upgradeFeature.value
  return feature ? featureIcons[feature] : 'i-lucide-lock'
})

function handleSignUp() {
  guest.dismissUpgradeModal()
  router.push('/auth/signup')
}

function handleSignIn() {
  guest.dismissUpgradeModal()
  router.push('/auth/signin')
}

function handleOAuth(provider: 'google' | 'github') {
  guest.dismissUpgradeModal()
  router.push(`/auth/signin?provider=${provider}`)
}
</script>

<template>
  <NcDialog
    :open="guest.showUpgradeModal.value"
    :title="''"
    size="sm"
    @update:open="guest.dismissUpgradeModal()"
  >
    <div class="upgrade-body">
      <!-- Feature context -->
      <div class="upgrade-header">
        <span :class="['upgrade-icon', currentIcon]" />
        <h3 class="upgrade-title">
          {{ guest.upgradeInfo.value?.title || 'Unlock Feature' }}
        </h3>
        <p class="upgrade-desc">
          Sign in or create an account to {{ (guest.upgradeInfo.value?.description || '').toLowerCase().replace(/\.$/, '') }}.
        </p>
      </div>

      <!-- OAuth -->
      <div class="upgrade-oauth">
        <button class="oauth-btn oauth-google" @click="handleOAuth('google')">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
          <span>Continue with Google</span>
        </button>
        <button class="oauth-btn oauth-github" @click="handleOAuth('github')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
          <span>Continue with GitHub</span>
        </button>
      </div>

      <!-- Divider -->
      <div class="upgrade-divider">
        <div class="divider-line" />
        <span class="divider-text">OR</span>
        <div class="divider-line" />
      </div>

      <!-- Email CTA -->
      <div class="upgrade-email-actions">
        <NcButton variant="primary" class="upgrade-signup-btn" @click="handleSignUp">
          Sign up with email
        </NcButton>
      </div>

      <!-- Footer -->
      <p class="upgrade-footer">
        Already have an account?
        <button class="upgrade-signin-link" @click="handleSignIn">Sign in</button>
      </p>
    </div>
  </NcDialog>
</template>

<style scoped>
.upgrade-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 4px 0 0;
}

.upgrade-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding-bottom: 20px;
}

.upgrade-icon {
  font-size: 24px;
  color: var(--nc-accent, #00D2BE);
  margin-bottom: 4px;
}

.upgrade-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--nc-ink, #FAFAFA);
  letter-spacing: -0.02em;
  margin: 0;
}

.upgrade-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--nc-ink-faint, #71717A);
  line-height: 1.5;
  margin: 0;
  max-width: 320px;
}

.upgrade-oauth {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 20px;
}

.oauth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 44px;
  border-radius: 10px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--nc-duration-fast, 150ms) ease;
  border: none;
}

.oauth-google {
  background: #FAFAFA;
  color: #111111;
}

.oauth-google:hover {
  background: #F0F0F0;
}

.oauth-github {
  background: transparent;
  border: 1px solid var(--nc-border, #1E1E22);
  color: var(--nc-ink, #FAFAFA);
}

.oauth-github:hover {
  border-color: var(--nc-ink-muted, #A1A1AA);
}

.upgrade-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--nc-border, #1E1E22);
}

.divider-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--nc-ink-faint, #52525B);
  letter-spacing: 0.04em;
}

.upgrade-email-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upgrade-signup-btn {
  width: 100%;
  height: 44px;
}

.upgrade-footer {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--nc-ink-faint, #52525B);
  text-align: center;
  margin: 16px 0 0;
}

.upgrade-signin-link {
  background: none;
  border: none;
  color: var(--nc-accent, #00D2BE);
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  transition: opacity var(--nc-duration-fast, 150ms) ease;
}

.upgrade-signin-link:hover {
  opacity: 0.8;
}
</style>
