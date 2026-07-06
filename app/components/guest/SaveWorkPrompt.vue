<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'
import { useMapStore } from '~/stores/mapStore'

const props = defineProps<{
  visible: boolean
  editCount: number
  sessionMinutes: number
}>()

const emit = defineEmits<{
  dismiss: []
  remind: []
}>()

const guest = useGuestMode()
const mapStore = useMapStore()
const router = useRouter()

const nodeCount = computed(() => mapStore.nodes?.size ?? 0)
const edgeCount = computed(() => mapStore.edges?.size ?? 0)

function handleSignUp() {
  emit('dismiss')
  router.push('/auth/signup?provider=google')
}

function handleEmail() {
  emit('dismiss')
  router.push('/auth/signup')
}

function handleDiscard() {
  emit('dismiss')
  guest.exitGuestMode()
  router.push('/')
}

function handleRemind() {
  emit('remind')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sw">
      <div v-if="visible" class="sw-anchor">
        <div class="sw-card">
          <div class="sw-head">
            <div class="sw-eyebrow">
              <span class="sw-dot" />
              <span>{{ editCount }} EDITS · {{ sessionMinutes }} MIN</span>
            </div>
            <button class="sw-close" aria-label="Remind me later" @click="handleRemind">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 3 L9 9 M9 3 L3 9" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div class="sw-body">
            <h2 class="sw-title">
              This map looks <span class="sw-italic">real now.</span>
            </h2>
            <p class="sw-desc">
              You've added <strong>{{ nodeCount }} nodes</strong> and <strong>{{ edgeCount }} edges</strong>.
              Closing this tab loses all of it.
            </p>
          </div>

          <div class="sw-promise">
            <div class="sw-promise-head">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 7 L7 11 L13 4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>Saved means</span>
            </div>
            <ul class="sw-promise-list">
              <li>— this map persists across tabs &amp; devices</li>
              <li>— AI unlocks on every node</li>
              <li>— export to PNG / JSON / Markdown</li>
            </ul>
          </div>

          <div class="sw-actions">
            <button class="sw-google" @click="handleSignUp">
              <LandingProviderIcon name="google" />
              <span>Save with Google — 8 sec</span>
            </button>
            <div class="sw-or">
              <span>or <button class="sw-email-link" @click="handleEmail">use email</button></span>
              <span class="sw-card-note">no card · no verification email</span>
            </div>
          </div>

          <div class="sw-foot">
            <button class="sw-foot-link" @click="handleRemind">remind me later</button>
            <button class="sw-foot-link sw-discard" @click="handleDiscard">discard map →</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sw-anchor {
  position: fixed;
  right: 32px;
  top: 32px;
  z-index: 9998;
  pointer-events: none;
}

.sw-anchor > * {
  pointer-events: auto;
}

/* Save-work prompt — flat surface-2 + hairline (REDESIGN.md §5),
   radius capped at 8px, calm shadow only. Theme-aware via tokens. */
.sw-card {
  width: 380px;
  padding: 24px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: var(--nc-shadow-md);
  font-family: var(--nc-font-body);
}

.sw-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

/* Session counter chip — mono micro-label, coral live/unsaved dot (§1) */
.sw-eyebrow {
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
  color: var(--nc-text-secondary);
}

.sw-dot {
  width: 5px;
  height: 5px;
  background: var(--nc-coral);
  border-radius: 50%;
}

.sw-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--nc-text-muted);
  cursor: pointer;
  border-radius: var(--nc-radius-sm);
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .sw-close:hover {
    background: var(--nc-surface-3);
    color: var(--nc-text);
  }
}

.sw-close:active {
  transform: scale(0.97);
}

.sw-close:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.sw-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Modal header — display 700; the serif italic span is the single
   accent allowed per headline (REDESIGN.md §4). */
.sw-title {
  font-family: var(--nc-font-display);
  font-size: calc(28px * var(--nc-text-scale, 1));
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 0;
}

.sw-italic {
  font-family: var(--nc-font-serif);
  font-style: italic;
  font-weight: 400;
  color: var(--nc-accent);
}

.sw-desc {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  line-height: 1.55;
  margin: 0;
}

.sw-desc strong {
  color: var(--nc-text);
  font-weight: 500;
}

/* "Saved means" — flat chip-fill callout, accent check, ink text (§5) */
.sw-promise {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
}

.sw-promise-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--nc-accent);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
}

.sw-promise-head span {
  color: var(--nc-text);
}

.sw-promise-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0 22px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sw-promise-list li {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  line-height: 1.5;
}

.sw-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Primary CTA — ink pill (REDESIGN.md §5) */
.sw-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--nc-text);
  border: none;
  border-radius: 2.4rem;
  color: var(--nc-bg);
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.sw-google svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

@media (hover: hover) and (pointer: fine) {
  .sw-google:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

.sw-google:active {
  transform: scale(0.97);
}

.sw-google:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.sw-or {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.sw-email-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .sw-email-link:hover {
    color: var(--nc-accent);
  }
}

.sw-email-link:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.sw-card-note {
  font-size: calc(11px * var(--nc-text-scale, 1));
}

.sw-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--nc-border);
}

/* Footer dismiss links — mono uppercase ghost grammar; the destructive
   "discard" hovers coral (accent discipline, §1). */
.sw-foot-link {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-muted);
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .sw-foot-link:hover {
    color: var(--nc-accent);
  }

  .sw-foot-link.sw-discard:hover {
    color: var(--nc-coral);
  }
}

.sw-foot-link:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Transition — enter scale(0.97)+opacity 200ms, exit faster (§5/§6) */
.sw-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease),
              transform var(--nc-duration-normal) var(--nc-ease);
}
.sw-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-fast) var(--nc-ease);
}
.sw-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
.sw-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

/* Mobile */
@media (max-width: 640px) {
  .sw-anchor {
    right: 16px;
    left: 16px;
    top: 16px;
  }
  .sw-card {
    width: 100%;
    padding: 20px;
  }
  .sw-title {
    font-size: calc(26px * var(--nc-text-scale, 1));
  }
}

@media (prefers-reduced-motion: reduce) {
  .sw-enter-active,
  .sw-leave-active {
    transition: opacity 120ms linear;
  }
  .sw-enter-from,
  .sw-leave-to {
    transform: none;
  }
}
</style>
