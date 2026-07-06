<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'

const emit = defineEmits<{
  complete: []
}>()

const { t } = useI18n()
const guest = useGuestMode()
const currentStep = ref(0)
const isVisible = ref(false)

const steps = computed(() => [
  {
    eyebrow: t('common.guest.walkthrough.step1_eyebrow'),
    title: t('common.guest.walkthrough.step1_title'),
    description: t('common.guest.walkthrough.step1_desc'),
    waiting: t('common.guest.walkthrough.step1_waiting'),
  },
  {
    eyebrow: t('common.guest.walkthrough.step2_eyebrow'),
    title: t('common.guest.walkthrough.step2_title'),
    description: t('common.guest.walkthrough.step2_desc'),
    waiting: t('common.guest.walkthrough.step2_waiting'),
  },
  {
    eyebrow: t('common.guest.walkthrough.step3_eyebrow'),
    title: t('common.guest.walkthrough.step3_title'),
    description: t('common.guest.walkthrough.step3_desc'),
    waiting: t('common.guest.walkthrough.step3_waiting'),
  },
])

function next() {
  if (currentStep.value < steps.value.length - 1) {
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

const step = computed(() => steps.value[currentStep.value])
const isLast = computed(() => currentStep.value === steps.value.length - 1)

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
            <button class="cm-close" :aria-label="$t('common.guest.walkthrough.skip_aria')" @click="skip">
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
            <button class="cm-skip" @click="skip">{{ $t('common.guest.walkthrough.skip') }}</button>
            <button class="cm-next" @click="next">
              <span>{{ isLast ? $t('common.guest.walkthrough.done') : $t('common.guest.walkthrough.next') }}</span>
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

/* Onboarding coach-mark card — flat surface-2 + hairline (REDESIGN.md §5),
   radius capped at 8px, calm shadow only. Theme-aware via tokens. */
.cm-card {
  width: 340px;
  padding: 20px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--nc-shadow-md);
  font-family: var(--nc-font-body);
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
  background: var(--nc-border);
  transition: background-color var(--nc-duration-normal) var(--nc-ease);
}

.cm-seg.is-active,
.cm-seg.is-done {
  background: var(--nc-accent);
}

/* Mono micro-label eyebrow / step counter (REDESIGN.md §4) */
.cm-eyebrow {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

.cm-close {
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
  .cm-close:hover {
    background: var(--nc-surface-3);
    color: var(--nc-text);
  }
}

.cm-close:active {
  transform: scale(0.97);
}

.cm-close:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Body */
.cm-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Modal header voice — display 700, tight tracking */
.cm-title {
  font-family: var(--nc-font-display);
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
}

.cm-desc {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  line-height: 1.55;
}

/* Status — flat chip fill + hairline, accent icon */
.cm-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-accent);
}

.cm-status-text {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}

/* Actions */
.cm-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}

/* Dismiss — mono uppercase text link (REDESIGN.md §5 ghost grammar) */
.cm-skip {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .cm-skip:hover {
    color: var(--nc-accent);
  }
}

.cm-skip:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Primary action — ink pill (REDESIGN.md §5) */
.cm-next {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--nc-text);
  border: none;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-bg);
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .cm-next:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

.cm-next:active {
  transform: scale(0.97);
}

.cm-next:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Card transition — enter scale(0.97)+opacity 200ms, exit faster (§5/§6) */
.cm-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease),
              transform var(--nc-duration-normal) var(--nc-ease);
}
.cm-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-fast) var(--nc-ease);
}
.cm-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}
.cm-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}

/* Step transition */
.cm-step-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease),
              transform var(--nc-duration-normal) var(--nc-ease);
}
.cm-step-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease);
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
    transition: opacity 120ms linear;
  }
  .cm-enter-from,
  .cm-leave-to,
  .cm-step-enter-from,
  .cm-step-leave-to {
    transform: none;
  }
}
</style>
