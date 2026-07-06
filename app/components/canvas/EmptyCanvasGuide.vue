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
        <!-- Survey-frame corner marks (REDESIGN.md §5 — empty states only) -->
        <span class="nc-empty-corner nc-empty-corner--tl" aria-hidden="true">+</span>
        <span class="nc-empty-corner nc-empty-corner--tr" aria-hidden="true">+</span>
        <span class="nc-empty-corner nc-empty-corner--bl" aria-hidden="true">+</span>
        <span class="nc-empty-corner nc-empty-corner--br" aria-hidden="true">+</span>

        <!-- Hero icon -->
        <div class="nc-empty-icon">
          <span class="i-nc-ai-mark text-2xl" />
        </div>

        <h3 class="nc-empty-title">{{ $t('canvas.empty_guide.title') }}</h3>
        <p class="nc-empty-subtitle">
          {{ $t('canvas.empty_guide.subtitle') }}
        </p>

        <!-- Quick actions -->
        <div class="nc-empty-actions">
          <button class="nc-empty-action" @click="emit('add-node'); dismiss()">
            <span class="i-lucide-plus text-sm" />
            <span>{{ $t('canvas.empty_guide.add_first_node') }}</span>
            <kbd class="nc-empty-kbd">N</kbd>
          </button>

          <button class="nc-empty-action ai" @click="emit('generate-map'); dismiss()">
            <span class="i-nc-ai-mark text-sm" />
            <span>{{ $t('canvas.empty_guide.generate_with_ai') }}</span>
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

/* Survey frame (REDESIGN.md §5): dashed hairline + coral corner '+' marks,
   translucent bg tint — reserved for empty states and onboarding callouts. */
.nc-empty-guide-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  max-width: 340px;
  padding: 32px 28px;
  text-align: center;
  border: 1px dashed var(--nc-border);
  background: rgba(var(--nc-bg-rgb), 0.66);
}

.nc-empty-corner {
  position: absolute;
  font-family: var(--nc-font-mono);
  font-size: 14px;
  line-height: 1;
  color: var(--nc-coral);
  pointer-events: none;
  user-select: none;
}

.nc-empty-corner--tl { top: -7px; left: -5px; }
.nc-empty-corner--tr { top: -7px; right: -5px; }
.nc-empty-corner--bl { bottom: -7px; left: -5px; }
.nc-empty-corner--br { bottom: -7px; right: -5px; }

.nc-empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 0.5rem;
  background: rgba(var(--nc-accent-rgb), 0.08);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-accent-text);
  margin-bottom: 4px;
}

.nc-empty-title {
  font-family: var(--nc-font-display);
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-ink);
  margin: 0;
}

.nc-empty-subtitle {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-ink-soft);
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
  border-radius: 0.5rem;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  border: 1px solid var(--nc-border);
  background: var(--nc-chip-bg);
  color: var(--nc-ink);
  cursor: pointer;
  transition: background var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .nc-empty-action:hover {
    background: var(--nc-surface-3);
    border-color: var(--nc-border-active);
  }
}

.nc-empty-action:active {
  transform: scale(0.97);
}

.nc-empty-action:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.nc-empty-action.ai {
  background: rgba(var(--nc-accent-rgb), 0.08);
  border-color: rgba(var(--nc-accent-rgb), 0.2);
  color: var(--nc-accent-text);
}

@media (hover: hover) and (pointer: fine) {
  .nc-empty-action.ai:hover {
    background: rgba(var(--nc-accent-rgb), 0.15);
    border-color: rgba(var(--nc-accent-rgb), 0.3);
  }
}

.nc-empty-kbd {
  font-size: calc(10px * var(--nc-text-scale, 1));
  padding: 1px 5px;
  border-radius: 0.35rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  color: var(--nc-ink-muted);
  font-family: var(--nc-font-mono);
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
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted);
}

.nc-empty-hint kbd {
  font-size: calc(11px * var(--nc-text-scale, 1));
  padding: 1px 4px;
  border-radius: 0.35rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  font-family: var(--nc-font-mono);
}
</style>
