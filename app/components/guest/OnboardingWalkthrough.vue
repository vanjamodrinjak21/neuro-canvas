<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'

const emit = defineEmits<{
  complete: []
}>()

const guest = useGuestMode()
const currentStep = ref(0)
const isVisible = ref(false)

const steps = [
  {
    eyebrow: '01 / 03 — NODE',
    title: 'Drop in an idea.',
    description: 'Double-click anywhere on the canvas. Type a sentence. That\'s a node. The canvas grows from there.',
    waiting: 'waiting for your first node…',
  },
  {
    eyebrow: '02 / 03 — EDGE',
    title: 'Connect it.',
    description: 'Drag from one node to another. Connections are typed (causes, contradicts, depends on) — they become the reasoning, not just the visual.',
    waiting: 'draw your first connection…',
  },
  {
    eyebrow: '03 / 03 — AI',
    title: 'Then save, and AI takes over.',
    description: 'Once saved, press ⌘K on any node and the AI extends that branch. Counter-arguments, summaries, gap analysis — anchored to the node you selected.',
    waiting: 'unlocks instantly when you save',
  },
]

function next() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
  else {
    finish()
  }
}

function skip() {
  finish()
}

function finish() {
  isVisible.value = false
  setTimeout(() => {
    guest.completeOnboarding()
    emit('complete')
  }, 250)
}

const step = computed(() => steps[currentStep.value])
const isLast = computed(() => currentStep.value === steps.length - 1)

onMounted(() => {
  requestAnimationFrame(() => {
    isVisible.value = true
  })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="cm">
      <div v-if="isVisible" class="cm-anchor">
        <div class="cm-card">
          <div class="cm-head">
            <div class="cm-progress">
              <div class="cm-progress-segs">
                <div
                  v-for="(_, i) in steps"
                  :key="i"
                  class="cm-seg"
                  :class="{ 'is-active': i === currentStep, 'is-done': i < currentStep }"
                />
              </div>
              <div class="cm-eyebrow">{{ step?.eyebrow }}</div>
            </div>
            <button class="cm-close" aria-label="Skip tour" @click="skip">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 3 L9 9 M9 3 L3 9" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <Transition name="cm-step" mode="out-in">
            <div :key="currentStep" class="cm-body">
              <div class="cm-title">{{ step?.title }}</div>
              <div class="cm-desc">{{ step?.description }}</div>
            </div>
          </Transition>

          <div class="cm-status">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="6" cy="6" r="2" />
              <circle cx="6" cy="6" r="4.5" stroke-dasharray="2 2" />
            </svg>
            <span class="cm-status-text">{{ step?.waiting }}</span>
          </div>

          <div class="cm-actions">
            <button class="cm-skip" @click="skip">skip tour</button>
            <button class="cm-next" @click="next">
              <span>{{ isLast ? 'GOT IT' : 'NEXT' }}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4">
                <path d="M2 5 H8 M5.5 2 L8 5 L5.5 8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cm-anchor {
  position: fixed;
  right: 32px;
  bottom: 32px;
  z-index: 9999;
  pointer-events: none;
}

.cm-anchor > * {
  pointer-events: auto;
}

.cm-card {
  width: 340px;
  padding: 20px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
}

:root.light .cm-card {
  background: #FFFFFF;
  border-color: #DDD9CF;
  box-shadow: 0 18px 60px rgba(26, 26, 26, 0.12);
}

/* Header row: progress + close */
.cm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cm-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.cm-progress-segs {
  display: flex;
  gap: 4px;
}

.cm-seg {
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background: var(--nc-border, #1E1E22);
  transition: background 250ms var(--nc-ease, cubic-bezier(0.16, 1, 0.3, 1));
}

:root.light .cm-seg {
  background: #DDD9CF;
}

.cm-seg.is-active,
.cm-seg.is-done {
  background: var(--nc-accent, #00D2BE);
}

.cm-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--nc-ink-faint, #52525B);
}

:root.light .cm-eyebrow {
  color: #8A8780;
}

.cm-close {
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

.cm-close:hover {
  background: var(--nc-surface-3, #1E1E22);
  color: var(--nc-ink-muted, #A1A1AA);
}

:root.light .cm-close:hover {
  background: #F4F2EC;
  color: #5A5A5A;
}

/* Body */
.cm-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cm-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--nc-ink, #FAFAFA);
}

:root.light .cm-title {
  color: #1A1A1A;
}

.cm-desc {
  font-size: 13px;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.55;
}

:root.light .cm-desc {
  color: #5A5A5A;
}

/* Status */
.cm-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--nc-surface-2, #121216);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 8px;
  color: var(--nc-accent, #00D2BE);
}

:root.light .cm-status {
  background: #F4F2EC;
  border-color: #DDD9CF;
  color: var(--nc-accent-dark, #00B5A4);
}

.cm-status-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--nc-ink-muted, #A1A1AA);
}

:root.light .cm-status-text {
  color: #5A5A5A;
}

/* Actions */
.cm-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}

.cm-skip {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 12px;
  color: var(--nc-ink-faint, #52525B);
  cursor: pointer;
}

.cm-skip:hover {
  color: var(--nc-ink-muted, #A1A1AA);
}

:root.light .cm-skip {
  color: #8A8780;
}

:root.light .cm-skip:hover {
  color: #5A5A5A;
}

.cm-next {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: none;
  border: none;
  border-radius: 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--nc-ink-faint, #52525B);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, transform 80ms ease;
}

.cm-next:hover {
  background: var(--nc-surface-3, #1E1E22);
  color: var(--nc-ink, #FAFAFA);
}

:root.light .cm-next:hover {
  background: #F4F2EC;
  color: #1A1A1A;
}

.cm-next:active {
  transform: scale(0.97);
}

/* Card transition */
.cm-enter-active {
  transition: opacity 250ms var(--nc-ease, cubic-bezier(0.23, 1, 0.32, 1)),
              transform 250ms var(--nc-ease, cubic-bezier(0.23, 1, 0.32, 1));
}
.cm-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.cm-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}
.cm-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

/* Step transition */
.cm-step-enter-active {
  transition: opacity 200ms ease, transform 200ms var(--nc-ease, cubic-bezier(0.23, 1, 0.32, 1));
}
.cm-step-leave-active {
  transition: opacity 140ms ease;
}
.cm-step-enter-from {
  opacity: 0;
  transform: translateX(8px);
}
.cm-step-leave-to {
  opacity: 0;
}

/* Mobile */
@media (max-width: 640px) {
  .cm-anchor {
    right: 16px;
    left: 16px;
    bottom: 16px;
  }
  .cm-card {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cm-enter-active,
  .cm-leave-active,
  .cm-step-enter-active,
  .cm-step-leave-active {
    transition: opacity 150ms ease;
  }
  .cm-enter-from,
  .cm-leave-to,
  .cm-step-enter-from,
  .cm-step-leave-to {
    transform: none;
  }
}
</style>
