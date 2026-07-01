<script setup lang="ts">
import type { GenerationTone } from '~/types/ai-generation'

const props = defineProps<{
  visible: boolean
  isLoading?: boolean
  // Set by the parent when server-side generation is unavailable (offline on a
  // non-native shell). On native, AI runs on-device so this stays false.
  offlineDisabled?: boolean
  offlineHint?: string
}>()

const emit = defineEmits<{
  'close': []
  'generate': [topic: string, options: { depth: string; style: string; domain?: string; nodeCount: number; tone: GenerationTone }]
}>()

// Node-count bounds. Slider covers the practical single-pass range; the numeric
// input + presets allow far larger targets (grown in the background).
const COUNT_MIN = 4
const COUNT_SLIDER_MAX = 60
const COUNT_MAX = 10000
const COUNT_PRESETS = [12, 24, 50, 100]

// Form state
const topic = ref('')
const depth = ref<'shallow' | 'medium' | 'deep'>('medium')
const style = ref<'concise' | 'detailed' | 'academic'>('detailed')
const tone = ref<GenerationTone>('neutral')
const nodeCount = ref(24)
const domain = ref('')

const { t } = useI18n()

function clampCount(value: number) {
  if (Number.isNaN(value)) return COUNT_MIN
  return Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(value)))
}

function setCount(value: number) {
  nodeCount.value = clampCount(value)
}

const isLargeTarget = computed(() => nodeCount.value > COUNT_SLIDER_MAX)

const toneOptions = computed(() => [
  { value: 'neutral', label: t('canvas.gen_options.tone_neutral') },
  { value: 'academic', label: t('canvas.gen_options.tone_academic') },
  { value: 'professional', label: t('canvas.gen_options.tone_professional') },
  { value: 'casual', label: t('canvas.gen_options.tone_casual') },
  { value: 'creative', label: t('canvas.gen_options.tone_creative') },
])

// Depth options with more interesting descriptions
const depthOptions = computed(() => [
  { value: 'shallow', label: t('canvas.generate_map.depth_quick'), description: t('canvas.generate_map.depth_quick_desc') },
  { value: 'medium', label: t('canvas.generate_map.depth_balanced'), description: t('canvas.generate_map.depth_balanced_desc') },
  { value: 'deep', label: t('canvas.generate_map.depth_comprehensive'), description: t('canvas.generate_map.depth_comprehensive_desc') }
])

// Style options
const styleOptions = computed(() => [
  { value: 'concise', label: t('canvas.generate_map.style_concise'), description: t('canvas.generate_map.style_concise_desc') },
  { value: 'detailed', label: t('canvas.generate_map.style_detailed'), description: t('canvas.generate_map.style_detailed_desc') },
  { value: 'academic', label: t('canvas.generate_map.style_academic'), description: t('canvas.generate_map.style_academic_desc') }
])

function handleGenerate() {
  if (!topic.value.trim() || props.offlineDisabled) return

  emit('generate', topic.value.trim(), {
    depth: depth.value,
    style: style.value,
    domain: domain.value.trim() || undefined,
    nodeCount: clampCount(nodeCount.value),
    tone: tone.value
  })
}

function handleClose() {
  emit('close')
}

// Reset form when dialog opens
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    topic.value = ''
    depth.value = 'medium'
    style.value = 'detailed'
    tone.value = 'neutral'
    nodeCount.value = 24
    domain.value = ''
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
                  <span class="i-lucide-map text-lg" />
                </div>
                <div>
                  <h2 class="nc-dialog-title">{{ $t('canvas.generate_map.title') }}</h2>
                  <p class="nc-dialog-subtitle">{{ $t('canvas.generate_map.subtitle') }}</p>
                </div>
              </div>
              <button class="nc-close-btn" @click="handleClose">
                <span class="i-lucide-x text-lg" />
              </button>
            </div>

            <!-- Content -->
            <div class="nc-dialog-content">
              <!-- Topic input -->
              <div class="nc-field">
                <label class="nc-label">{{ $t('canvas.generate_map.topic_label') }}</label>
                <input
                  v-model="topic"
                  type="text"
                  class="nc-input"
                  :placeholder="$t('canvas.generate_map.topic_placeholder')"
                  :disabled="isLoading"
                  @keydown.enter="handleGenerate"
                >
                <p class="nc-hint">{{ $t('canvas.generate_map.topic_hint') }}</p>
              </div>

              <!-- Depth selector -->
              <div class="nc-field">
                <label class="nc-label">{{ $t('canvas.generate_map.depth_label') }}</label>
                <div class="nc-option-grid">
                  <button
                    v-for="opt in depthOptions"
                    :key="opt.value"
                    :class="['nc-option-btn', depth === opt.value && 'active']"
                    :disabled="isLoading"
                    @click="depth = opt.value as typeof depth"
                  >
                    <span class="nc-option-label">{{ opt.label }}</span>
                    <span class="nc-option-desc">{{ opt.description }}</span>
                  </button>
                </div>
              </div>

              <!-- Style selector -->
              <div class="nc-field">
                <label class="nc-label">{{ $t('canvas.generate_map.style_label') }}</label>
                <div class="nc-option-grid">
                  <button
                    v-for="opt in styleOptions"
                    :key="opt.value"
                    :class="['nc-option-btn', style === opt.value && 'active']"
                    :disabled="isLoading"
                    @click="style = opt.value as typeof style"
                  >
                    <span class="nc-option-label">{{ opt.label }}</span>
                    <span class="nc-option-desc">{{ opt.description }}</span>
                  </button>
                </div>
              </div>

              <!-- Node count (broj nodova) -->
              <div class="nc-field">
                <label class="nc-label">{{ $t('canvas.generate_map.count_label') }}</label>
                <div class="nc-count-row">
                  <input
                    :value="nodeCount"
                    type="number"
                    class="nc-count-input"
                    :min="COUNT_MIN"
                    :max="COUNT_MAX"
                    :disabled="isLoading"
                    @input="setCount(Number(($event.target as HTMLInputElement).value))"
                  >
                  <span class="nc-count-suffix">{{ $t('canvas.generate_map.count_suffix') }}</span>
                </div>
                <input
                  :value="Math.min(nodeCount, COUNT_SLIDER_MAX)"
                  type="range"
                  class="nc-slider"
                  :min="COUNT_MIN"
                  :max="COUNT_SLIDER_MAX"
                  step="1"
                  :disabled="isLoading"
                  @input="setCount(Number(($event.target as HTMLInputElement).value))"
                >
                <div class="nc-count-presets">
                  <button
                    v-for="preset in COUNT_PRESETS"
                    :key="preset"
                    type="button"
                    :class="['nc-preset-btn', nodeCount === preset && 'active']"
                    :disabled="isLoading"
                    @click="setCount(preset)"
                  >
                    {{ preset }}
                  </button>
                </div>
                <p class="nc-hint">
                  {{ isLargeTarget ? $t('canvas.generate_map.count_hint_large') : $t('canvas.generate_map.count_hint') }}
                </p>
              </div>

              <!-- Tone (ton) -->
              <CanvasGenOptionPills
                :label="$t('canvas.gen_options.tone_label')"
                :options="toneOptions"
                :model-value="tone"
                :disabled="isLoading"
                @update:model-value="tone = $event as GenerationTone"
              />

              <!-- Domain input (optional) -->
              <div class="nc-field">
                <label class="nc-label">
                  {{ $t('canvas.generate_map.domain_label') }}
                  <span class="nc-optional">{{ $t('canvas.generate_map.domain_optional') }}</span>
                </label>
                <input
                  v-model="domain"
                  type="text"
                  class="nc-input"
                  :placeholder="$t('canvas.generate_map.domain_placeholder')"
                  :disabled="isLoading"
                >
                <p class="nc-hint">{{ $t('canvas.generate_map.domain_hint') }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="nc-dialog-footer">
              <button
                class="nc-btn nc-btn-secondary"
                :disabled="isLoading"
                @click="handleClose"
              >
                {{ $t('canvas.generate_map.cancel') }}
              </button>
              <button
                class="nc-btn nc-btn-primary"
                :disabled="!topic.trim() || isLoading || offlineDisabled"
                :title="offlineDisabled ? offlineHint : undefined"
                @click="handleGenerate"
              >
                <span v-if="isLoading" class="i-lucide-loader-2 animate-pulse" />
                <span v-else class="i-lucide-grid-2x2-plus" />
                <span>{{ isLoading ? $t('canvas.generate_map.generating') : $t('canvas.generate_map.generate') }}</span>
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
  max-width: 480px;
  /* Cap to the viewport (minus the wrapper's p-4 = 16px each side) so a tall
     dialog never overflows the screen; the body scrolls instead. dvh tracks
     mobile browser chrome. */
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
  /* Tokenized: was hardcoded #FAFAFA (white) -> invisible on the light modal. */
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
  gap: 8px;
}

.nc-label {
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.nc-optional {
  font-weight: 400;
  text-transform: none;
  color: var(--nc-ink-muted);
}

.nc-input {
  width: 100%;
  padding: 12px 14px;
  background: var(--nc-surface-3, #0D0D10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-ink, #FAFAFA);
  transition: border-color 0.15s ease;
}

.nc-input::placeholder {
  color: var(--nc-ink-muted);
}

.nc-input:focus {
  outline: none;
  border-color: #00D2BE;
}

.nc-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-hint {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted);
  margin: 0;
}

.nc-option-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.nc-option-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  background: var(--nc-surface-3, #0D0D10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-option-btn:hover:not(:disabled) {
  border-color: #2A2A30;
  background: var(--nc-surface, #141418);
}

.nc-option-btn.active {
  border-color: #00D2BE;
  background: rgba(0, 210, 190, 0.05);
}

.nc-option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-option-label {
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.nc-option-desc {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted);
  line-height: 1.3;
}

.nc-count-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.nc-count-input {
  width: 120px;
  padding: 2px 6px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--nc-border, #1E1E22);
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: calc(32px * var(--nc-text-scale, 1));
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

.nc-count-presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.nc-preset-btn {
  padding: 8px 0;
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
