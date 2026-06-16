<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  isLoading?: boolean
  initial?: number
}>()

const emit = defineEmits<{
  'close': []
  'confirm': [count: number]
}>()

const MIN = 3
const MAX = 40
const PRESETS = [6, 12, 18, 24]

const count = ref(props.initial ?? 12)

function clamp(value: number) {
  if (Number.isNaN(value)) return MIN
  return Math.min(MAX, Math.max(MIN, Math.round(value)))
}

function setCount(value: number) {
  count.value = clamp(value)
}

function handleConfirm() {
  if (props.isLoading) return
  emit('confirm', clamp(count.value))
}

function handleClose() {
  emit('close')
}

// Seed from the last-used value each time the dialog opens.
watch(() => props.visible, (isVisible) => {
  if (isVisible) count.value = clamp(props.initial ?? 12)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-modal bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
        @click.self="handleClose"
      >
        <Transition
          enter-active-class="transition-all duration-300 delay-100"
          leave-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          leave-to-class="opacity-0 scale-95 translate-y-4"
        >
          <div
            v-if="visible"
            class="nc-dialog"
            @click.stop
          >
            <!-- Header -->
            <div class="nc-dialog-header">
              <div class="flex items-center gap-3">
                <div class="nc-dialog-icon">
                  <span class="i-lucide-waypoints text-lg" />
                </div>
                <div>
                  <h2 class="nc-dialog-title">{{ $t('canvas.expand_map.title') }}</h2>
                  <p class="nc-dialog-subtitle">{{ $t('canvas.expand_map.subtitle') }}</p>
                </div>
              </div>
              <button class="nc-close-btn" @click="handleClose">
                <span class="i-lucide-x text-lg" />
              </button>
            </div>

            <!-- Content -->
            <div class="nc-dialog-content">
              <div class="nc-field">
                <label class="nc-label">{{ $t('canvas.expand_map.count_label') }}</label>

                <div class="nc-count-readout">
                  <span class="nc-count-value">{{ count }}</span>
                  <span class="nc-count-suffix">{{ $t('canvas.expand_map.nodes_suffix') }}</span>
                </div>

                <input
                  :value="count"
                  type="range"
                  class="nc-slider"
                  :min="MIN"
                  :max="MAX"
                  step="1"
                  :disabled="isLoading"
                  @input="setCount(Number(($event.target as HTMLInputElement).value))"
                >

                <div class="nc-preset-row">
                  <button
                    v-for="preset in PRESETS"
                    :key="preset"
                    :class="['nc-preset-btn', count === preset && 'active']"
                    :disabled="isLoading"
                    @click="setCount(preset)"
                  >
                    {{ preset }}
                  </button>
                </div>

                <p class="nc-hint">{{ $t('canvas.expand_map.hint') }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="nc-dialog-footer">
              <button
                class="nc-btn nc-btn-secondary"
                :disabled="isLoading"
                @click="handleClose"
              >
                {{ $t('canvas.expand_map.cancel') }}
              </button>
              <button
                class="nc-btn nc-btn-primary"
                :disabled="isLoading"
                @click="handleConfirm"
              >
                <span v-if="isLoading" class="i-lucide-loader-2 animate-pulse" />
                <span v-else class="i-lucide-waypoints" />
                <span>{{ isLoading ? $t('canvas.expand_map.expanding') : $t('canvas.expand_map.expand') }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nc-dialog {
  width: 100%;
  max-width: 420px;
  background: var(--nc-surface, #111114);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.nc-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--nc-border, #1E1E22);
}

.nc-dialog-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(0, 210, 190, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00D2BE;
}

.nc-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--nc-ink);
  margin: 0;
}

.nc-dialog-subtitle {
  font-size: 12px;
  color: var(--nc-ink-muted);
  margin: 2px 0 0;
}

.nc-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--nc-ink-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-close-btn:hover {
  color: var(--nc-ink, #FAFAFA);
  background: var(--nc-surface-3, #1A1A1E);
}

.nc-dialog-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.nc-field {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nc-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--nc-ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.nc-count-readout {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.nc-count-value {
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
  color: var(--nc-ink, #FAFAFA);
}

.nc-count-suffix {
  font-size: 13px;
  color: var(--nc-ink-muted);
}

.nc-slider {
  width: 100%;
  accent-color: var(--nc-accent, #00D2BE);
  cursor: pointer;
}

.nc-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-preset-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.nc-preset-btn {
  padding: 10px 0;
  background: var(--nc-surface-3, #0D0D10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: 13px;
  font-weight: 500;
  color: var(--nc-ink-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-preset-btn:hover:not(:disabled) {
  border-color: #2A2A30;
  background: var(--nc-surface, #141418);
}

.nc-preset-btn.active {
  border-color: #00D2BE;
  background: rgba(0, 210, 190, 0.05);
  color: var(--nc-ink, #FAFAFA);
}

.nc-preset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-hint {
  font-size: 11px;
  color: var(--nc-ink-muted);
  margin: 0;
}

.nc-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: var(--nc-surface-3, #0D0D10);
  border-top: 1px solid var(--nc-border, #1E1E22);
}

.nc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-btn-secondary {
  background: transparent;
  border: 1px solid #2A2A30;
  color: var(--nc-ink-soft);
}

.nc-btn-secondary:hover:not(:disabled) {
  border-color: #3A3A40;
  color: #FAFAFA;
}

.nc-btn-primary {
  background: var(--nc-accent, #00D2BE);
  border: none;
  color: #0A0A0C;
}

.nc-btn-primary:hover:not(:disabled) {
  background: #00E5CF;
}

@media (prefers-reduced-motion: reduce) {
  .nc-dialog {
    transition: none;
  }
}
</style>
