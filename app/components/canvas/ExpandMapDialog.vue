<script setup lang="ts">
import type { GenerationStyle, GenerationTone } from '~/types/ai-generation'

const props = defineProps<{
  visible: boolean
  isLoading?: boolean
  // Set by the parent when server-side generation is unavailable (offline on a
  // non-native shell). On native, AI runs on-device so this stays false.
  offlineDisabled?: boolean
  offlineHint?: string
  initial?: number
  initialStyle?: GenerationStyle
  initialTone?: GenerationTone
}>()

const emit = defineEmits<{
  'close': []
  'confirm': [count: number, style: GenerationStyle, tone: GenerationTone]
}>()

const { t } = useI18n()

const MIN = 3
// Slider covers the practical single-pass range; the numeric input + presets
// allow going far higher (large maps are grown in the background).
const SLIDER_MAX = 60
const MAX = 10000
const PRESETS = [6, 12, 24, 50, 100]

const count = ref(props.initial ?? 12)
const style = ref<GenerationStyle>(props.initialStyle ?? 'detailed')
const tone = ref<GenerationTone>(props.initialTone ?? 'neutral')

const styleOptions = computed(() => [
  { value: 'concise', label: t('canvas.generate_map.style_concise') },
  { value: 'detailed', label: t('canvas.generate_map.style_detailed') },
  { value: 'academic', label: t('canvas.generate_map.style_academic') },
])

const toneOptions = computed(() => [
  { value: 'neutral', label: t('canvas.gen_options.tone_neutral') },
  { value: 'academic', label: t('canvas.gen_options.tone_academic') },
  { value: 'professional', label: t('canvas.gen_options.tone_professional') },
  { value: 'casual', label: t('canvas.gen_options.tone_casual') },
  { value: 'creative', label: t('canvas.gen_options.tone_creative') },
])

// Show a heads-up when the target exceeds what one pass produces well.
const isLargeTarget = computed(() => count.value > SLIDER_MAX)

function clamp(value: number) {
  if (Number.isNaN(value)) return MIN
  return Math.min(MAX, Math.max(MIN, Math.round(value)))
}

function setCount(value: number) {
  count.value = clamp(value)
}

function handleConfirm() {
  if (props.isLoading || props.offlineDisabled) return
  emit('confirm', clamp(count.value), style.value, tone.value)
}

function handleClose() {
  emit('close')
}

// Seed from the last-used values each time the dialog opens.
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    count.value = clamp(props.initial ?? 12)
    style.value = props.initialStyle ?? 'detailed'
    tone.value = props.initialTone ?? 'neutral'
  }
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
                  <input
                    :value="count"
                    type="number"
                    class="nc-count-input"
                    :min="MIN"
                    :max="MAX"
                    :disabled="isLoading"
                    @input="setCount(Number(($event.target as HTMLInputElement).value))"
                  >
                  <span class="nc-count-suffix">{{ $t('canvas.expand_map.nodes_suffix') }}</span>
                </div>

                <input
                  :value="Math.min(count, SLIDER_MAX)"
                  type="range"
                  class="nc-slider"
                  :min="MIN"
                  :max="SLIDER_MAX"
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

                <p class="nc-hint">
                  {{ isLargeTarget ? $t('canvas.expand_map.hint_large') : $t('canvas.expand_map.hint') }}
                </p>
              </div>

              <!-- Style (način) -->
              <CanvasGenOptionPills
                :label="$t('canvas.gen_options.style_label')"
                :options="styleOptions"
                :model-value="style"
                :disabled="isLoading"
                @update:model-value="style = $event as GenerationStyle"
              />

              <!-- Tone (ton) -->
              <CanvasGenOptionPills
                :label="$t('canvas.gen_options.tone_label')"
                :options="toneOptions"
                :model-value="tone"
                :disabled="isLoading"
                @update:model-value="tone = $event as GenerationTone"
              />
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
                :disabled="isLoading || offlineDisabled"
                :title="offlineDisabled ? offlineHint : undefined"
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
  /* Cap to the viewport (minus the wrapper's p-4 = 16px each side) so a tall
     dialog never overflows the screen; the body scrolls instead. */
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
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
  flex-shrink: 0;
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
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-ink);
  margin: 0;
}

.nc-dialog-subtitle {
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  /* Take the slack between header and footer and scroll when content is taller
     than the capped dialog. min-height:0 lets a flex child actually shrink. */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.nc-field {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nc-label {
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  font-size: calc(40px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 1;
  color: var(--nc-ink, #FAFAFA);
}

.nc-count-input {
  width: 140px;
  padding: 2px 6px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--nc-border, #1E1E22);
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: calc(40px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 1;
  color: var(--nc-ink, #FAFAFA);
  -moz-appearance: textfield;
}

.nc-count-input:focus {
  outline: none;
  border-bottom-color: #00D2BE;
}

.nc-count-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-count-input::-webkit-outer-spin-button,
.nc-count-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.nc-count-suffix {
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  font-size: calc(11px * var(--nc-text-scale, 1));
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
  flex-shrink: 0;
}

.nc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: calc(13px * var(--nc-text-scale, 1));
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
