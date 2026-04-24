<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  isLoading?: boolean
}>()

const emit = defineEmits<{
  'close': []
  'generate': [topic: string, options: { depth: string; style: string; domain?: string }]
}>()

// Form state
const topic = ref('')
const depth = ref<'shallow' | 'medium' | 'deep'>('medium')
const style = ref<'concise' | 'detailed' | 'academic'>('detailed')
const domain = ref('')

const { t } = useI18n()

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
  if (!topic.value.trim()) return

  emit('generate', topic.value.trim(), {
    depth: depth.value,
    style: style.value,
    domain: domain.value.trim() || undefined
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
                :disabled="!topic.trim() || isLoading"
                @click="handleGenerate"
              >
                <span v-if="isLoading" class="i-lucide-loader-2 animate-spin" />
                <span v-else class="i-lucide-sparkles" />
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
  color: #FAFAFA;
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
  gap: 8px;
}

.nc-label {
  font-size: 12px;
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
  font-size: 14px;
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
  font-size: 11px;
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
  font-size: 13px;
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.nc-option-desc {
  font-size: 11px;
  color: var(--nc-ink-muted);
  line-height: 1.3;
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
