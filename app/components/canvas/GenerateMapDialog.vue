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
  max-width: 480px;
  /* Cap to the viewport (minus the wrapper's p-4 = 16px each side) so a tall
     dialog never overflows the screen; the body scrolls instead. dvh tracks
     mobile browser chrome. */
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
  gap: 8px;
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

.nc-optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
  color: var(--nc-text-muted);
}

.nc-input {
  width: 100%;
  padding: 12px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: 0.5rem;
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  transition: border-color 150ms var(--nc-ease);
}

.nc-input::placeholder {
  color: var(--nc-text-dim);
}

.nc-input:focus {
  outline: none;
  border-color: var(--nc-accent);
}

.nc-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-hint {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
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
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  text-align: left;
  cursor: pointer;
  transition:
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .nc-option-btn:hover:not(:disabled) {
    border-color: var(--nc-border-active);
    background: var(--nc-surface-3);
  }
}

.nc-option-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.nc-option-btn.active {
  border-color: var(--nc-accent);
  background: rgba(var(--nc-accent-rgb), 0.06);
}

.nc-option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-option-label {
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text);
}

.nc-option-desc {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
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
  border-bottom: 1px solid var(--nc-border);
  font-family: var(--nc-font-mono);
  font-size: calc(32px * var(--nc-text-scale, 1));
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

.nc-count-presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.nc-preset-btn {
  padding: 8px 0;
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
