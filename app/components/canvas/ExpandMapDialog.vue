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
      enter-active-class="nc-fade-enter-active"
      leave-active-class="nc-fade-leave-active"
      enter-from-class="nc-fade-hidden"
      leave-to-class="nc-fade-hidden"
    >
      <div
        v-if="visible"
        class="nc-dialog-backdrop fixed inset-0 z-modal flex items-center justify-center p-4"
        @click.self="handleClose"
      >
        <Transition
          enter-active-class="nc-zoom-enter-active"
          leave-active-class="nc-zoom-leave-active"
          enter-from-class="nc-zoom-hidden"
          leave-to-class="nc-zoom-hidden"
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
                  <span class="i-nc-ai-mark text-lg" />
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
                <span v-else class="i-nc-ai-mark" />
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
/* Scrim — flat, no backdrop blur (REDESIGN.md §5) */
.nc-dialog-backdrop {
  background: rgba(0, 0, 0, 0.6);
}

/* Modal motion (REDESIGN.md §5/§6): enter scale(0.97)+opacity 200ms,
   exit 150ms, single ease, transform-origin center. */
.nc-fade-enter-active {
  transition: opacity 200ms var(--nc-ease);
}

.nc-fade-leave-active {
  transition: opacity 150ms var(--nc-ease);
}

.nc-fade-hidden {
  opacity: 0;
}

.nc-zoom-enter-active {
  transition:
    opacity 200ms var(--nc-ease),
    transform 200ms var(--nc-ease);
}

.nc-zoom-leave-active {
  transition:
    opacity 150ms var(--nc-ease),
    transform 150ms var(--nc-ease);
}

.nc-zoom-hidden {
  opacity: 0;
  transform: scale(0.97);
}

.nc-dialog {
  width: 100%;
  max-width: 420px;
  /* Cap to the viewport (minus the wrapper's p-4 = 16px each side) so a tall
     dialog never overflows the screen; the body scrolls instead. */
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: var(--nc-shadow-md);
  transform-origin: center;
}

.nc-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--nc-border);
  flex-shrink: 0;
}

.nc-dialog-icon {
  width: 40px;
  height: 40px;
  border-radius: 0.5rem;
  background: rgba(var(--nc-accent-rgb), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-accent-text);
}

/* Modal title — display face (REDESIGN.md §4) */
.nc-dialog-title {
  font-family: var(--nc-font-display);
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 0;
}

.nc-dialog-subtitle {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  margin: 2px 0 0;
}

.nc-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--nc-text-muted);
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .nc-close-btn:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

.nc-close-btn:active {
  transform: scale(0.97);
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

/* Field label — mono uppercase micro-label (REDESIGN.md §4/§5) */
.nc-label {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.nc-count-readout {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.nc-count-input {
  width: 140px;
  padding: 2px 6px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--nc-border);
  font-family: var(--nc-font-mono);
  font-size: calc(40px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 1;
  color: var(--nc-text);
  -moz-appearance: textfield;
  transition: border-color 150ms var(--nc-ease);
}

.nc-count-input:focus {
  outline: none;
  border-bottom-color: var(--nc-accent);
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
  color: var(--nc-text-muted);
}

.nc-slider {
  width: 100%;
  accent-color: var(--nc-accent);
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
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  font-family: var(--nc-font-mono);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .nc-preset-btn:hover:not(:disabled) {
    border-color: var(--nc-border-active);
    background: var(--nc-surface-3);
  }
}

.nc-preset-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.nc-preset-btn.active {
  border-color: var(--nc-accent);
  background: rgba(var(--nc-accent-rgb), 0.06);
  color: var(--nc-text);
}

.nc-preset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-hint {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  margin: 0;
}

.nc-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: var(--nc-surface);
  border-top: 1px solid var(--nc-border);
  flex-shrink: 0;
}

.nc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 0.5rem;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

.nc-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.nc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-btn-secondary {
  background: transparent;
  border: 1px solid var(--nc-border);
  color: var(--nc-text-secondary);
}

@media (hover: hover) and (pointer: fine) {
  .nc-btn-secondary:hover:not(:disabled) {
    border-color: var(--nc-border-active);
    color: var(--nc-text);
  }
}

.nc-btn-primary {
  background: var(--nc-accent);
  border: none;
  color: var(--nc-bg);
}

@media (hover: hover) and (pointer: fine) {
  .nc-btn-primary:hover:not(:disabled) {
    background: var(--nc-accent-light);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nc-fade-enter-active,
  .nc-fade-leave-active,
  .nc-zoom-enter-active,
  .nc-zoom-leave-active,
  .nc-dialog {
    transition: none;
  }
}
</style>
