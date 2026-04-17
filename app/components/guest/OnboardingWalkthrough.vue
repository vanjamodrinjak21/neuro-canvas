<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'

const emit = defineEmits<{
  complete: []
}>()

const guest = useGuestMode()
const currentStep = ref(0)
const direction = ref<'forward' | 'backward'>('forward')
const isVisible = ref(false)

const steps = [
  {
    title: 'Add a node',
    description: 'Double-click anywhere on the canvas to create a new idea.',
    icon: 'i-lucide-plus-circle',
  },
  {
    title: 'Connect ideas',
    description: 'Drag from one node to another to draw a connection.',
    icon: 'i-lucide-git-branch',
  },
  {
    title: 'Edit content',
    description: 'Click any node to select it, then type to edit its text.',
    icon: 'i-lucide-pencil',
  },
  {
    title: 'Explore the toolbar',
    description: 'Use the top bar to undo, change colors, and more.',
    icon: 'i-lucide-layout-dashboard',
  },
]

function next() {
  if (currentStep.value < steps.length - 1) {
    direction.value = 'forward'
    currentStep.value++
  }
  else {
    finish()
  }
}

function prev() {
  if (currentStep.value > 0) {
    direction.value = 'backward'
    currentStep.value--
  }
}

function finish() {
  isVisible.value = false
  setTimeout(() => {
    guest.completeOnboarding()
    emit('complete')
  }, 300)
}

const step = computed(() => steps[currentStep.value])
const isLast = computed(() => currentStep.value === steps.length - 1)
const isFirst = computed(() => currentStep.value === 0)
onMounted(() => {
  requestAnimationFrame(() => {
    isVisible.value = true
  })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="wt-overlay">
      <div v-if="isVisible" class="wt-overlay" @click.self="finish">
        <div class="wt-card">
          <!-- Progress bar -->
          <div class="wt-progress">
            <div
              v-for="(_, i) in steps"
              :key="i"
              :class="['wt-segment', {
                'wt-segment--done': i < currentStep,
                'wt-segment--active': i === currentStep,
              }]"
            />
          </div>

          <!-- Step content with transition -->
          <Transition :name="direction === 'forward' ? 'wt-step-fwd' : 'wt-step-bwd'" mode="out-in">
            <div :key="currentStep" class="wt-content">
              <div class="wt-icon-wrap">
                <span :class="['wt-icon', step?.icon]" />
              </div>
              <h3 class="wt-title">{{ step?.title }}</h3>
              <p class="wt-desc">{{ step?.description }}</p>
            </div>
          </Transition>

          <!-- Actions -->
          <div class="wt-actions">
            <button v-if="isFirst" class="wt-skip" @click="finish">
              Skip
            </button>
            <button v-else class="wt-back" @click="prev">
              Back
            </button>
            <button class="wt-next" @click="next">
              {{ isLast ? 'Get started' : 'Next' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Overlay */
.wt-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wt-overlay-enter-active {
  transition: opacity var(--nc-duration-slow, 400ms) ease;
}
.wt-overlay-leave-active {
  transition: opacity var(--nc-duration-normal, 250ms) ease;
}
.wt-overlay-enter-from,
.wt-overlay-leave-to {
  opacity: 0;
}

/* Card */
.wt-card {
  background: var(--nc-surface-2, #121216);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 16px;
  padding: 28px 24px 24px;
  max-width: 380px;
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  animation: wt-card-enter 500ms var(--nc-ease, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes wt-card-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Progress bar */
.wt-progress {
  display: flex;
  gap: 4px;
  width: 100%;
}

.wt-segment {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--nc-border, #252529);
  transition: background var(--nc-duration-slow, 400ms) var(--nc-ease, ease);
}

.wt-segment--active {
  background: var(--nc-accent, #00D2BE);
}

.wt-segment--done {
  background: rgba(0, 210, 190, 0.35);
}

/* Step content */
.wt-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 8px 0;
  min-height: 140px;
}

.wt-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 4px;
}

.wt-icon {
  font-size: 28px;
  color: var(--nc-accent, #00D2BE);
}

.wt-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--nc-ink, #FAFAFA);
  letter-spacing: -0.02em;
  margin: 0;
}

.wt-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.6;
  margin: 0;
  max-width: 280px;
}

/* Step transitions — forward */
.wt-step-fwd-enter-active {
  transition: all var(--nc-duration-normal, 250ms) var(--nc-ease, ease);
}
.wt-step-fwd-leave-active {
  transition: all var(--nc-duration-fast, 150ms) ease;
}
.wt-step-fwd-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.wt-step-fwd-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

/* Step transitions — backward */
.wt-step-bwd-enter-active {
  transition: all var(--nc-duration-normal, 250ms) var(--nc-ease, ease);
}
.wt-step-bwd-leave-active {
  transition: all var(--nc-duration-fast, 150ms) ease;
}
.wt-step-bwd-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}
.wt-step-bwd-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

/* Actions */
.wt-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 4px;
}

.wt-skip,
.wt-back {
  background: none;
  border: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--nc-ink-faint, #52525B);
  cursor: pointer;
  padding: 8px 0;
  transition: color var(--nc-duration-fast, 150ms) ease;
}

.wt-skip:hover,
.wt-back:hover {
  color: var(--nc-ink-muted, #A1A1AA);
}

.wt-next {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 28px;
  background: var(--nc-accent, #00D2BE);
  border: none;
  border-radius: 10px;
  color: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--nc-duration-fast, 150ms) ease;
}

.wt-next:hover {
  opacity: 0.9;
}

.wt-next:active {
  transform: scale(0.97);
}
</style>
