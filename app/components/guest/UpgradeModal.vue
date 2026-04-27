<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'
import type { GuestRestrictedFeature } from '~/composables/useGuestMode'

const guest = useGuestMode()
const router = useRouter()

const featurePreview: Record<GuestRestrictedFeature, {
  eyebrow: string
  headline: string
  serif: string
  desc: string
  receipt: string
}> = {
  'ai': {
    eyebrow: 'AI · IN ACTION',
    headline: 'Let the AI take it',
    serif: 'from here.',
    desc: 'Save your map and the AI starts expanding any branch you select. Counter-arguments, summaries, gap analysis — anchored to the node.',
    receipt: 'claude-3.5-sonnet · 1.4s · 4 nodes generated',
  },
  'ai-settings': {
    eyebrow: 'AI · BRING YOUR OWN KEY',
    headline: 'Pick your own',
    serif: 'model.',
    desc: 'Anthropic, OpenAI, OpenRouter, or local Ollama. Keys stay encrypted in your vault — we never train on your maps.',
    receipt: '4 providers supported · keys encrypted in vault',
  },
  'export': {
    eyebrow: 'EXPORT · ANY FORMAT',
    headline: 'Take it',
    serif: 'with you.',
    desc: 'Export to PNG, JSON, or Markdown anytime. The schema is documented. Your data is portable by default.',
    receipt: 'PNG · JSON · Markdown · open schema',
  },
  'share': {
    eyebrow: 'SHARE · LIVE LINK',
    headline: 'Send a',
    serif: 'thinking link.',
    desc: 'Generate a shareable URL of your map. Recipients can read, comment, or fork — your call.',
    receipt: 'read · comment · fork · revoke any time',
  },
  'new-map': {
    eyebrow: 'MAPS · UNLIMITED',
    headline: 'More than',
    serif: 'one thought.',
    desc: 'Guest mode caps you to one map. Save, and your map count is unlimited.',
    receipt: 'unlimited maps · 24 templates · sync across devices',
  },
  'account-settings': {
    eyebrow: 'YOUR PROFILE',
    headline: 'Make it',
    serif: 'recognizable.',
    desc: 'Display name, avatar, language, theme — yours to set once you have an account.',
    receipt: 'profile · preferences · 16 locales',
  },
  'sync': {
    eyebrow: 'SYNC · EVERYWHERE',
    headline: 'Phone, laptop,',
    serif: 'all the same map.',
    desc: 'Yjs CRDT sync without conflicts. Offline-first. Picks up where you left off — even mid-thought.',
    receipt: 'iOS · Android · web · desktop',
  },
}

const preview = computed(() => {
  const feature = guest.upgradeFeature.value as GuestRestrictedFeature | null
  return feature ? featurePreview[feature] : featurePreview.ai
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

function handleKeepExploring() {
  guest.dismissUpgradeModal()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="um-overlay">
      <div
        v-if="guest.showUpgradeModal.value"
        class="um-overlay"
        @click.self="guest.dismissUpgradeModal()"
      >
        <Transition name="um-panel" appear>
          <div class="upgrade-split" @click.stop>
      <!-- Preview Pane -->
      <div class="upgrade-preview">
        <div class="preview-eyebrow">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M6 1 L7.5 4.5 L11 6 L7.5 7.5 L6 11 L4.5 7.5 L1 6 L4.5 4.5 Z" />
          </svg>
          <span>{{ preview.eyebrow }}</span>
        </div>

        <div class="preview-canvas">
          <svg class="preview-edges" viewBox="0 0 324 240" preserveAspectRatio="none">
            <path d="M70 60 L162 60" stroke="currentColor" stroke-width="1.4" fill="none" class="edge-solid" />
            <path d="M162 60 L240 30" stroke="currentColor" stroke-width="1.4" stroke-dasharray="4 4" fill="none" class="edge-ai" />
            <path d="M162 60 L240 90" stroke="currentColor" stroke-width="1.4" stroke-dasharray="4 4" fill="none" class="edge-ai" />
            <path d="M162 60 L240 150" stroke="currentColor" stroke-width="1.4" stroke-dasharray="4 4" fill="none" class="edge-ai" />
            <path d="M162 60 L240 210" stroke="currentColor" stroke-width="1.4" stroke-dasharray="4 4" fill="none" class="edge-ai" />
          </svg>
          <div class="preview-node selected">selected node</div>
          <div class="preview-node ai-node" style="left: 178px; top: 18px;">Counter-argument</div>
          <div class="preview-node ai-node" style="left: 178px; top: 78px;">Hidden assumption</div>
          <div class="preview-node ai-node" style="left: 178px; top: 138px;">Adjacent example</div>
          <div class="preview-node ai-node" style="left: 178px; top: 198px;">Stress test</div>
        </div>

        <div class="preview-receipt">
          <div class="receipt-label">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
              <circle cx="6" cy="6" r="2" />
              <circle cx="6" cy="6" r="4.5" stroke-dasharray="2 2" />
            </svg>
            <span>EXPAND BRANCH</span>
          </div>
          <div class="receipt-text">{{ preview.receipt }}</div>
        </div>
      </div>

      <!-- Auth Pane -->
      <div class="upgrade-auth">
        <div class="auth-header">
          <h2 class="auth-title">
            {{ preview.headline }}<br>
            <span class="auth-serif">{{ preview.serif }}</span>
          </h2>
          <p class="auth-desc">{{ preview.desc }}</p>
        </div>

        <div class="auth-oauth">
          <button class="oauth-btn oauth-google" @click="handleOAuth('google')">
            <svg width="14" height="14" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
            </svg>
            <span>Continue with Google</span>
          </button>
          <button class="oauth-btn oauth-github" @click="handleOAuth('github')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div class="auth-divider">
          <div class="divider-line" />
          <span>OR</span>
          <div class="divider-line" />
        </div>

        <button class="auth-email-btn" @click="handleSignUp">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="10" height="8" rx="1.5" />
            <path d="M2 4 L7 8 L12 4" stroke-linecap="round" />
          </svg>
          <span>Sign up with email</span>
          <span class="auth-kbd">↵</span>
        </button>

        <div class="auth-mini">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M6 4 V6 L7.5 7.5" />
          </svg>
          <span>Free forever — no card. Account in 8 seconds.</span>
        </div>

        <div class="auth-footer">
          <span class="auth-signin-prompt">
            Already have an account?
            <button class="auth-signin-link" @click="handleSignIn">Sign in</button>
          </span>
          <button class="auth-keep-link" @click="handleKeepExploring">keep exploring →</button>
        </div>
      </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.um-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

:root.light .um-overlay {
  background: rgba(26, 26, 26, 0.45);
}

.upgrade-split {
  display: flex;
  width: 100%;
  max-width: 780px;
  min-height: 480px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 60px 120px rgba(0, 0, 0, 0.6);
}

:root.light .upgrade-split {
  background: #FFFFFF;
  border-color: #DDD9CF;
  box-shadow: 0 60px 120px rgba(26, 26, 26, 0.18);
}

/* Transitions */
.um-overlay-enter-active {
  transition: opacity 200ms ease;
}
.um-overlay-leave-active {
  transition: opacity 150ms ease;
}
.um-overlay-enter-from,
.um-overlay-leave-to {
  opacity: 0;
}

.um-panel-enter-active {
  transition: opacity 250ms cubic-bezier(0.23, 1, 0.32, 1),
              transform 250ms cubic-bezier(0.23, 1, 0.32, 1);
}
.um-panel-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.um-panel-enter-from,
.um-panel-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .um-panel-enter-active,
  .um-panel-leave-active {
    transition: opacity 150ms ease;
  }
  .um-panel-enter-from,
  .um-panel-leave-to {
    transform: none;
  }
}

/* ───── Preview Pane ───── */
.upgrade-preview {
  width: 380px;
  flex-shrink: 0;
  padding: 32px 28px;
  background: var(--nc-bg, #09090B);
  border-right: 1px solid var(--nc-border, #1E1E22);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

:root.light .upgrade-preview {
  background: #FAF8F4;
  border-right-color: #DDD9CF;
}

.preview-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.22);
  border-radius: 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--nc-accent, #00D2BE);
  align-self: flex-start;
}

.preview-canvas {
  position: relative;
  width: 100%;
  height: 240px;
  background: var(--nc-bg, #09090B);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
  overflow: hidden;
}

:root.light .preview-canvas {
  background: #F4F2EC;
  border-color: #DDD9CF;
}

.preview-edges {
  position: absolute;
  inset: 0;
}

.preview-edges .edge-solid {
  color: var(--nc-border-hover, #3F3F46);
}

:root.light .preview-edges .edge-solid {
  color: #C8C4B8;
}

.preview-edges .edge-ai {
  color: var(--nc-accent, #00D2BE);
}

.preview-node {
  position: absolute;
  font-size: 10px;
  border-radius: 8px;
  font-weight: 500;
  padding: 6px 11px;
  white-space: nowrap;
}

.preview-node.selected {
  left: 14px;
  top: 50px;
  background: var(--nc-surface-3, #1E1E22);
  border: 1px solid var(--nc-border-hover, #3F3F46);
  color: var(--nc-ink, #FAFAFA);
  font-size: 11px;
}

:root.light .preview-node.selected {
  background: #EDE9E0;
  border-color: #C8C4B8;
  color: #1A1A1A;
}

.preview-node.ai-node {
  background: var(--nc-surface, #0C0C10);
  border: 1px solid rgba(0, 210, 190, 0.4);
  color: var(--nc-ink, #FAFAFA);
}

:root.light .preview-node.ai-node {
  background: #FFFFFF;
  border-color: rgba(0, 181, 164, 0.5);
  color: #1A1A1A;
}

.preview-receipt {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
}

:root.light .preview-receipt {
  background: #F4F2EC;
  border-color: #DDD9CF;
}

.receipt-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--nc-accent, #00D2BE);
}

.receipt-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.5;
}

:root.light .receipt-text {
  color: #5A5A5A;
}

/* ───── Auth Pane ───── */
.upgrade-auth {
  flex: 1;
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.auth-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.auth-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 32px;
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.01em;
  color: var(--nc-ink, #FAFAFA);
  margin: 0;
}

.auth-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  color: var(--nc-accent, #00D2BE);
}

:root.light .auth-serif {
  color: var(--nc-accent-dark, #00B5A4);
}

.auth-desc {
  font-size: 13px;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.55;
  max-width: 340px;
  margin: 0;
}

:root.light .auth-desc {
  color: #5A5A5A;
}

.auth-oauth {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  border: 1px solid transparent;
  transition: background 150ms ease, border-color 150ms ease, transform 80ms ease;
}

.oauth-btn:active {
  transform: scale(0.98);
}

.oauth-google {
  background: #FAFAFA;
  color: #09090B;
  font-weight: 600;
}

.oauth-google:hover {
  background: #F0F0F0;
}

:root.light .oauth-google {
  border-color: #DDD9CF;
}

.oauth-github {
  background: var(--nc-surface-3, #1E1E22);
  border-color: var(--nc-border-hover, #3F3F46);
  color: var(--nc-ink, #FAFAFA);
}

.oauth-github:hover {
  border-color: var(--nc-ink-muted, #A1A1AA);
}

:root.light .oauth-github {
  background: #1A1A1A;
  border-color: #1A1A1A;
  color: #FAF8F4;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 14px;
}

.auth-divider span {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--nc-ink-faint, #52525B);
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--nc-border, #1E1E22);
}

:root.light .divider-line {
  background: #DDD9CF;
}

.auth-email-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--nc-bg, #09090B);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--nc-ink-muted, #A1A1AA);
  cursor: pointer;
  text-align: left;
  transition: border-color 150ms ease, color 150ms ease;
}

.auth-email-btn:hover {
  border-color: var(--nc-ink-muted, #A1A1AA);
  color: var(--nc-ink, #FAFAFA);
}

:root.light .auth-email-btn {
  background: #F4F2EC;
  border-color: #DDD9CF;
  color: #5A5A5A;
}

.auth-email-btn span:first-of-type {
  flex: 1;
}

.auth-kbd {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--nc-ink-faint, #52525B);
}

.auth-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--nc-ink-faint, #52525B);
}

:root.light .auth-mini {
  color: #8A8780;
}

.auth-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--nc-border, #1E1E22);
  margin-top: auto;
}

:root.light .auth-footer {
  border-top-color: #DDD9CF;
}

.auth-signin-prompt {
  font-size: 12px;
  color: var(--nc-ink-faint, #52525B);
}

.auth-signin-link {
  background: none;
  border: none;
  padding: 0;
  margin-left: 4px;
  color: var(--nc-ink-muted, #A1A1AA);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.auth-signin-link:hover {
  color: var(--nc-ink, #FAFAFA);
}

.auth-keep-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 12px;
  color: var(--nc-ink-faint, #52525B);
  cursor: pointer;
}

.auth-keep-link:hover {
  color: var(--nc-ink-muted, #A1A1AA);
}

/* Mobile */
@media (max-width: 720px) {
  :deep(.nc-dialog__panel) {
    max-width: 92vw !important;
  }
  .upgrade-split {
    flex-direction: column;
    min-height: 0;
  }
  .upgrade-preview {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--nc-border, #1E1E22);
    padding: 24px 20px;
  }
  :root.light .upgrade-preview {
    border-bottom-color: #DDD9CF;
  }
  .preview-canvas {
    height: 180px;
  }
  .upgrade-auth {
    padding: 24px 20px;
  }
  .auth-title {
    font-size: 26px;
  }
}
</style>
