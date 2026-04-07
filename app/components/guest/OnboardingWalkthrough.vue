<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'

const emit = defineEmits<{
  complete: []
}>()

const guest = useGuestMode()
const currentStep = ref(0)

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
    currentStep.value++
  } else {
    finish()
  }
}

function finish() {
  guest.completeOnboarding()
  emit('complete')
}

const step = computed(() => steps[currentStep.value])
const isLast = computed(() => currentStep.value === steps.length - 1)
</script>

<template>
  <Teleport to="body">
    <div class="walkthrough-overlay">
      <div class="walkthrough-card">
        <div class="walkthrough-progress">
          <div
            v-for="(_, i) in steps"
            :key="i"
            :class="['progress-dot', { active: i === currentStep, done: i < currentStep }]"
          />
        </div>

        <div class="walkthrough-icon">
          <span :class="step?.icon" />
        </div>

        <h3 class="walkthrough-title">{{ step?.title }}</h3>
        <p class="walkthrough-desc">{{ step?.description }}</p>

        <div class="walkthrough-actions">
          <button class="walkthrough-skip" @click="finish">
            Skip
          </button>
          <button class="walkthrough-next" @click="next">
            {{ isLast ? 'Get started' : 'Next' }}
          </button>
        </div>

        <p class="walkthrough-step-count">
          {{ currentStep + 1 }} / {{ steps.length }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.walkthrough-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.walkthrough-card {
  background: var(--nc-surface-2, #121216);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 20px;
  padding: 2.5rem 2rem 2rem;
  max-width: 380px;
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.walkthrough-progress {
  display: flex;
  gap: 6px;
  margin-bottom: 0.5rem;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--nc-border, #252529);
  transition: all 0.3s ease;
}

.progress-dot.active {
  background: var(--nc-teal, #00D2BE);
  transform: scale(1.3);
}

.progress-dot.done {
  background: rgba(0, 210, 190, 0.4);
}

.walkthrough-icon {
  width: 64px;
  height: 64px;
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  color: var(--nc-teal, #00D2BE);
}

.walkthrough-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--nc-ink, #FAFAFA);
  margin: 0;
  letter-spacing: -0.02em;
}

.walkthrough-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.875rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
  line-height: 1.6;
}

.walkthrough-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
}

.walkthrough-skip {
  flex: 1;
  padding: 0.75rem;
  background: transparent;
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  color: var(--nc-ink-muted, #A1A1AA);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.walkthrough-skip:hover {
  border-color: var(--nc-ink-muted, #A1A1AA);
  color: var(--nc-ink, #FAFAFA);
}

.walkthrough-next {
  flex: 1;
  padding: 0.75rem;
  background: var(--nc-teal, #00D2BE);
  border: none;
  border-radius: 10px;
  color: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.walkthrough-next:hover {
  opacity: 0.9;
}

.walkthrough-step-count {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.75rem;
  color: var(--nc-ink-faint, #71717A);
  margin: 0;
}
</style>
