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
    receipt: 'claude-opus-4-8 · 1.4s · 4 nodes generated',
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
          <div class="preview-node selected">{{ $t('auth.upgrade_modal.selected_node') }}</div>
          <div class="preview-node ai-node ai-node-1">{{ $t('auth.upgrade_modal.ai_node_counter') }}</div>
          <div class="preview-node ai-node ai-node-2">{{ $t('auth.upgrade_modal.ai_node_assumption') }}</div>
          <div class="preview-node ai-node ai-node-3">{{ $t('auth.upgrade_modal.ai_node_example') }}</div>
          <div class="preview-node ai-node ai-node-4">{{ $t('auth.upgrade_modal.ai_node_stress') }}</div>
        </div>

        <div class="preview-receipt">
          <div class="receipt-label">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
              <circle cx="6" cy="6" r="2" />
              <circle cx="6" cy="6" r="4.5" stroke-dasharray="2 2" />
            </svg>
            <span>{{ $t('auth.upgrade_modal.expand_branch') }}</span>
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
            <LandingProviderIcon name="google" />
            <span>{{ $t('auth.oauth.google') }}</span>
          </button>
          <button class="oauth-btn oauth-github" @click="handleOAuth('github')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
            <span>{{ $t('auth.oauth.github') }}</span>
          </button>
        </div>

        <div class="auth-divider">
          <div class="divider-line" />
          <span>{{ $t('ui.or').toUpperCase() }}</span>
          <div class="divider-line" />
        </div>

        <button class="auth-email-btn" @click="handleSignUp">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="10" height="8" rx="1.5" />
            <path d="M2 4 L7 8 L12 4" stroke-linecap="round" />
          </svg>
          <span>{{ $t('auth.upgrade_modal.signup_email') }}</span>
          <span class="auth-kbd">↵</span>
        </button>

        <div class="auth-mini">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M6 4 V6 L7.5 7.5" />
          </svg>
          <span>{{ $t('auth.upgrade_modal.free_forever') }}</span>
        </div>

        <div class="auth-footer">
          <span class="auth-signin-prompt">
            {{ $t('auth.upgrade_modal.already_account') }}
            <button class="auth-signin-link" @click="handleSignIn">{{ $t('auth.upgrade_modal.signin_link') }}</button>
          </span>
          <button class="auth-keep-link" @click="handleKeepExploring">{{ $t('auth.upgrade_modal.keep_exploring') }}</button>
        </div>
      </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Scrim — flat, no blur (REDESIGN.md §5) */
.um-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(var(--nc-bg-rgb), 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* Modal — flat surface-2 + hairline, radius capped at 8px, calm shadow */
.upgrade-split {
  display: flex;
  width: 100%;
  max-width: 780px;
  min-height: 480px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  overflow: hidden;
  box-shadow: var(--nc-shadow-md);
}

/* Transitions — enter scale(0.97)+opacity 200ms, exit faster (§5/§6) */
.um-overlay-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease);
}
.um-overlay-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease);
}
.um-overlay-enter-from,
.um-overlay-leave-to {
  opacity: 0;
}

.um-panel-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease),
              transform var(--nc-duration-normal) var(--nc-ease);
}
.um-panel-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-fast) var(--nc-ease);
}
.um-panel-enter-from,
.um-panel-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .um-panel-enter-active,
  .um-panel-leave-active {
    transition: opacity 120ms linear;
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
  background: var(--nc-bg);
  border-right: 1px solid var(--nc-border);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Feature eyebrow — cyan mono chip (REDESIGN.md §5 chips/badges) */
.preview-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-accent);
  align-self: flex-start;
}

.preview-canvas {
  position: relative;
  width: 100%;
  height: 240px;
  background: var(--nc-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  overflow: hidden;
}

.preview-edges {
  position: absolute;
  inset: 0;
}

.preview-edges .edge-solid {
  color: var(--nc-border-active);
}

.preview-edges .edge-ai {
  color: var(--nc-accent);
}

.preview-node {
  position: absolute;
  font-size: calc(10px * var(--nc-text-scale, 1));
  border-radius: var(--nc-radius-sm);
  font-weight: 500;
  padding: 6px 11px;
  white-space: nowrap;
}

.preview-node.selected {
  left: 14px;
  top: 50px;
  background: var(--nc-surface-3);
  border: 1px solid var(--nc-border-active);
  color: var(--nc-text);
  font-size: calc(11px * var(--nc-text-scale, 1));
}

.preview-node.ai-node {
  background: var(--nc-surface-2);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.4);
  color: var(--nc-text);
}

/* AI-node positions (was inline style — REDESIGN.md §9 forbids it) */
.ai-node-1 { left: 178px; top: 18px; }
.ai-node-2 { left: 178px; top: 78px; }
.ai-node-3 { left: 178px; top: 138px; }
.ai-node-4 { left: 178px; top: 198px; }

.preview-receipt {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
}

.receipt-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-accent);
}

.receipt-text {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  line-height: 1.5;
}

/* ───── Auth Pane ───── */
.upgrade-auth {
  flex: 1;
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-family: var(--nc-font-body);
}

.auth-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Modal header — display 700; serif italic span is the single accent (§4) */
.auth-title {
  font-family: var(--nc-font-display);
  font-size: calc(32px * var(--nc-text-scale, 1));
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 0;
}

/* Accent line — inherits display face; serif never in modals (REDESIGN.md §4) */
.auth-serif {
  color: var(--nc-accent);
}

.auth-desc {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  line-height: 1.55;
  max-width: 340px;
  margin: 0;
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
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.oauth-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.oauth-btn:active {
  transform: scale(0.97);
}

.oauth-btn:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Primary CTA — ink pill (REDESIGN.md §5) */
.oauth-google {
  background: var(--nc-text);
  color: var(--nc-bg);
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
}

/* Secondary provider — hairline chip, mono uppercase (landing auth grammar) */
.oauth-github {
  background: transparent;
  border-color: var(--nc-border);
  border-radius: 0.5rem;
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-secondary);
}

@media (hover: hover) and (pointer: fine) {
  .oauth-google:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }

  .oauth-github:hover {
    color: var(--nc-accent);
    border-color: rgba(var(--nc-accent-rgb), 0.5);
  }
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 14px;
}

.auth-divider span {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  letter-spacing: 0.18em;
  color: var(--nc-text-muted);
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--nc-border);
}

/* Email row — input grammar: chip fill + hairline (REDESIGN.md §5) */
.auth-email-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .auth-email-btn:hover {
    border-color: var(--nc-border-active);
    color: var(--nc-text);
  }
}

.auth-email-btn:active {
  transform: scale(0.97);
}

.auth-email-btn:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.auth-email-btn span:first-of-type {
  flex: 1;
}

.auth-kbd {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
}

.auth-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.auth-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--nc-border);
  margin-top: auto;
}

.auth-signin-prompt {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.auth-signin-link {
  background: none;
  border: none;
  padding: 0;
  margin-left: 4px;
  color: var(--nc-text-secondary);
  font-family: inherit;
  font-size: calc(12px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .auth-signin-link:hover {
    color: var(--nc-accent);
  }
}

.auth-signin-link:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Dismiss — mono uppercase ghost grammar (REDESIGN.md §5) */
.auth-keep-link {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .auth-keep-link:hover {
    color: var(--nc-accent);
  }
}

.auth-keep-link:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Mobile */
@media (max-width: 720px) {
  .upgrade-split {
    flex-direction: column;
    min-height: 0;
  }
  .upgrade-preview {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--nc-border);
    padding: 24px 20px;
  }
  .preview-canvas {
    height: 180px;
  }
  .upgrade-auth {
    padding: 24px 20px;
  }
  .auth-title {
    font-size: calc(26px * var(--nc-text-scale, 1));
  }
}
</style>
