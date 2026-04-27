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
              <svg width="14" height="14" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
              </svg>
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

.sw-card {
  width: 380px;
  padding: 24px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
  font-family: 'Inter', system-ui, sans-serif;
}

:root.light .sw-card {
  background: #FFFFFF;
  border-color: #DDD9CF;
  box-shadow: 0 28px 80px rgba(26, 26, 26, 0.15);
}

.sw-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.sw-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: rgba(0, 210, 190, 0.06);
  border: 1px solid rgba(0, 210, 190, 0.22);
  border-radius: 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--nc-accent, #00D2BE);
}

.sw-dot {
  width: 5px;
  height: 5px;
  background: var(--nc-accent, #00D2BE);
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
  color: var(--nc-ink-faint, #52525B);
  cursor: pointer;
  border-radius: 6px;
  transition: background 150ms ease, color 150ms ease;
}

.sw-close:hover {
  background: var(--nc-surface-3, #1E1E22);
  color: var(--nc-ink-muted, #A1A1AA);
}

:root.light .sw-close:hover {
  background: #F4F2EC;
  color: #5A5A5A;
}

.sw-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sw-title {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 32px;
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.01em;
  color: var(--nc-ink, #FAFAFA);
  margin: 0;
}

:root.light .sw-title {
  color: #1A1A1A;
}

.sw-italic {
  font-style: italic;
  color: var(--nc-accent, #00D2BE);
}

:root.light .sw-italic {
  color: var(--nc-accent-dark, #00B5A4);
}

.sw-desc {
  font-size: 13px;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.55;
  margin: 0;
}

:root.light .sw-desc {
  color: #5A5A5A;
}

.sw-desc strong {
  color: var(--nc-ink, #FAFAFA);
  font-weight: 500;
}

:root.light .sw-desc strong {
  color: #1A1A1A;
}

.sw-promise {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--nc-bg, #09090B);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
}

:root.light .sw-promise {
  background: #F4F2EC;
  border-color: #DDD9CF;
}

.sw-promise-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--nc-accent, #00D2BE);
  font-size: 12px;
  font-weight: 500;
}

:root.light .sw-promise-head {
  color: var(--nc-accent-dark, #00B5A4);
}

.sw-promise-head span {
  color: var(--nc-ink, #FAFAFA);
}

:root.light .sw-promise-head span {
  color: #1A1A1A;
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
  font-size: 12px;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.5;
}

:root.light .sw-promise-list li {
  color: #5A5A5A;
}

.sw-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sw-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 16px;
  background: #FAFAFA;
  border: 1px solid #DDD9CF;
  border-radius: 10px;
  color: #09090B;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, transform 80ms ease;
}

.sw-google:hover {
  background: #F0F0F0;
}

.sw-google:active {
  transform: scale(0.98);
}

.sw-or {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  font-size: 12px;
  color: var(--nc-ink-faint, #52525B);
}

:root.light .sw-or {
  color: #8A8780;
}

.sw-email-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 12px;
  color: var(--nc-ink-muted, #A1A1AA);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

:root.light .sw-email-link {
  color: #5A5A5A;
}

.sw-card-note {
  font-size: 11px;
}

.sw-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--nc-border, #1E1E22);
}

:root.light .sw-foot {
  border-top-color: #DDD9CF;
}

.sw-foot-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 11px;
  color: var(--nc-ink-faint, #52525B);
  cursor: pointer;
}

.sw-foot-link:hover {
  color: var(--nc-ink-muted, #A1A1AA);
}

:root.light .sw-foot-link {
  color: #8A8780;
}

:root.light .sw-foot-link:hover {
  color: #5A5A5A;
}

/* Transition */
.sw-enter-active {
  transition: opacity 250ms var(--nc-ease, cubic-bezier(0.23, 1, 0.32, 1)),
              transform 250ms var(--nc-ease, cubic-bezier(0.23, 1, 0.32, 1));
}
.sw-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.sw-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
.sw-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
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
    font-size: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sw-enter-active,
  .sw-leave-active {
    transition: opacity 150ms ease;
  }
  .sw-enter-from,
  .sw-leave-to {
    transform: none;
  }
}
</style>
