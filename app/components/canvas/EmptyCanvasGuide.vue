<script setup lang="ts">
const emit = defineEmits<{
  'add-node': []
  'generate-map': []
  'import': []
}>()

const isVisible = ref(true)
const hasInteracted = ref(false)

// Auto-dismiss after first interaction
function dismiss() {
  isVisible.value = false
  hasInteracted.value = true
}

// Dismiss on any canvas interaction after a delay
onMounted(() => {
  const timer = setTimeout(() => {
    if (!hasInteracted.value) {
      // Keep showing until user acts
    }
  }, 500)

  return () => clearTimeout(timer)
})
</script>

<template>
  <Transition name="nc-scale-fade">
    <div
      v-if="isVisible"
      class="nc-empty-guide"
    >
      <div class="nc-empty-guide-inner">
        <!-- Hero icon -->
        <div class="nc-empty-icon">
          <span class="i-lucide-brain text-2xl" />
        </div>

        <h3 class="nc-empty-title">Start mapping your ideas</h3>
        <p class="nc-empty-subtitle">
          Double-click anywhere to create a node, or choose an option below
        </p>

        <!-- Quick actions -->
        <div class="nc-empty-actions">
          <button class="nc-empty-action" @click="emit('add-node'); dismiss()">
            <span class="i-lucide-plus text-sm" />
            <span>Add first node</span>
            <kbd class="nc-empty-kbd">N</kbd>
          </button>

          <button class="nc-empty-action ai" @click="emit('generate-map'); dismiss()">
            <span class="i-lucide-sparkles text-sm" />
            <span>Generate with AI</span>
          </button>
        </div>

        <!-- Keyboard hints -->
        <div class="nc-empty-hints">
          <span class="nc-empty-hint">
            <kbd>V</kbd> Select
          </span>
          <span class="nc-empty-hint">
            <kbd>H</kbd> Pan
          </span>
          <span class="nc-empty-hint">
            <kbd>C</kbd> Connect
          </span>
          <span class="nc-empty-hint">
            <kbd>?</kbd> All shortcuts
          </span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nc-empty-guide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 50;
}

.nc-empty-guide-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  max-width: 320px;
  text-align: center;
}

.nc-empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-accent, #00D2BE);
  margin-bottom: 4px;
}

.nc-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
  margin: 0;
}

.nc-empty-subtitle {
  font-size: 13px;
  color: var(--nc-ink-soft, #AAAAB0);
  margin: 0;
  line-height: 1.5;
}

.nc-empty-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.nc-empty-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--nc-ink, #FAFAFA);
  cursor: pointer;
  transition: background var(--nc-duration-fast, 150ms) var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              border-color var(--nc-duration-fast, 150ms) var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              transform var(--nc-duration-press, 120ms) var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}

@media (hover: hover) and (pointer: fine) {
  .nc-empty-action:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }
}

.nc-empty-action:active {
  transform: scale(0.97);
}

.nc-empty-action:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 2px;
}

.nc-empty-action.ai {
  background: rgba(0, 210, 190, 0.08);
  border-color: rgba(0, 210, 190, 0.2);
  color: var(--nc-accent, #00D2BE);
}

@media (hover: hover) and (pointer: fine) {
  .nc-empty-action.ai:hover {
    background: rgba(0, 210, 190, 0.15);
    border-color: rgba(0, 210, 190, 0.3);
  }
}

.nc-empty-kbd {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--nc-ink-muted, #888890);
  font-family: "SF Mono", "Fira Code", monospace;
  margin-left: 4px;
}

.nc-empty-hints {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.nc-empty-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--nc-ink-muted, #888890);
}

.nc-empty-hint kbd {
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  font-family: "SF Mono", "Fira Code", monospace;
}
</style>
