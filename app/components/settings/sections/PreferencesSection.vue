<script setup lang="ts">
import { useAISettings } from '~/composables/useAISettings'

const aiSettings = useAISettings()

// Local state bound to preferences
const autoSuggestConnections = ref(true)
const semanticFieldEnabled = ref(true)
const similarityThreshold = ref(0.3)

// ── Tauri detection ─────────────────────────────────────────────────
const isTauri = ref(false)

// ── Embedding model state (Tauri only) ──────────────────────────────
const embeddingModel = ref<'quantized' | 'full'>('quantized')
const hardwareInfo = ref<{
  isAppleSilicon: boolean
  hasDiscreteGpu: boolean
  capableHardware: boolean
} | null>(null)
const fullModelAvailable = ref(false)
const isDownloading = ref(false)
const downloadProgress = ref(0)
const isDeleting = ref(false)
const isSwitching = ref(false)
const modelError = ref<string | null>(null)

// Initialize from settings when mounted
onMounted(async () => {
  const prefs = aiSettings.settings.value.preferences
  autoSuggestConnections.value = prefs.autoSuggestConnections
  semanticFieldEnabled.value = prefs.semanticFieldEnabled
  similarityThreshold.value = prefs.similarityThreshold
  embeddingModel.value = prefs.embeddingModel || 'quantized'

  // Detect Tauri
  isTauri.value = typeof window !== 'undefined'
    && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

  if (isTauri.value) {
    await loadHardwareInfo()
    await checkFullModel()
  }
})

// Watch for settings changes
watch(
  () => aiSettings.settings.value.preferences,
  (prefs) => {
    autoSuggestConnections.value = prefs.autoSuggestConnections
    semanticFieldEnabled.value = prefs.semanticFieldEnabled
    similarityThreshold.value = prefs.similarityThreshold
    embeddingModel.value = prefs.embeddingModel || 'quantized'
  },
  { deep: true }
)

// Save handlers
async function toggleAutoSuggest() {
  await aiSettings.updatePreferences({
    autoSuggestConnections: autoSuggestConnections.value
  })
}

async function toggleSemanticField() {
  await aiSettings.updatePreferences({
    semanticFieldEnabled: semanticFieldEnabled.value
  })
}

async function updateThreshold() {
  await aiSettings.updatePreferences({
    similarityThreshold: similarityThreshold.value
  })
}

// Format threshold for display
const thresholdLabel = computed(() => {
  if (similarityThreshold.value <= 0.2) return 'Very Low'
  if (similarityThreshold.value <= 0.35) return 'Low'
  if (similarityThreshold.value <= 0.5) return 'Medium'
  if (similarityThreshold.value <= 0.7) return 'High'
  return 'Very High'
})

const thresholdDescription = computed(() => {
  if (similarityThreshold.value <= 0.2) {
    return 'Show more connections, even loosely related ones'
  }
  if (similarityThreshold.value <= 0.35) {
    return 'Balance between quantity and relevance'
  }
  if (similarityThreshold.value <= 0.5) {
    return 'Only show moderately related connections'
  }
  if (similarityThreshold.value <= 0.7) {
    return 'Show only closely related connections'
  }
  return 'Only show very closely related connections'
})

// ── Embedding model helpers (Tauri only) ────────────────────────────

async function loadHardwareInfo() {
  try {
    const { useTauriML } = await import('~/composables/useTauriML')
    const ml = useTauriML()
    hardwareInfo.value = await ml.getHardwareCapabilities()
  } catch (e) {
    console.warn('Failed to detect hardware capabilities:', e)
  }
}

async function checkFullModel() {
  try {
    const { useTauriML } = await import('~/composables/useTauriML')
    const ml = useTauriML()
    fullModelAvailable.value = await ml.isFullModelAvailable()
  } catch (e) {
    console.warn('Failed to check full model availability:', e)
  }
}

const hardwareLabel = computed(() => {
  if (!hardwareInfo.value) return 'Detecting...'
  if (hardwareInfo.value.isAppleSilicon) return 'Apple Silicon detected'
  if (hardwareInfo.value.hasDiscreteGpu) return 'Discrete GPU detected'
  return 'CPU only'
})

const currentModelLabel = computed(() => {
  return embeddingModel.value === 'full'
    ? 'Enhanced (Full Precision)'
    : 'Standard (Quantized)'
})

async function handleDownloadFullModel() {
  modelError.value = null
  isDownloading.value = true
  downloadProgress.value = 0

  try {
    const { useTauriML } = await import('~/composables/useTauriML')
    const ml = useTauriML()
    await ml.downloadFullModel((progress) => {
      downloadProgress.value = Math.round(progress * 100)
    })
    fullModelAvailable.value = true
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : 'Download failed'
  } finally {
    isDownloading.value = false
  }
}

async function handleDeleteFullModel() {
  modelError.value = null
  isDeleting.value = true

  try {
    const { useTauriML } = await import('~/composables/useTauriML')
    const ml = useTauriML()
    await ml.deleteFullModel()
    fullModelAvailable.value = false

    // Revert to quantized if currently using full
    if (embeddingModel.value === 'full') {
      embeddingModel.value = 'quantized'
      await aiSettings.updatePreferences({ embeddingModel: 'quantized' })
      await reinitializeEngine('quantized')
    }
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : 'Delete failed'
  } finally {
    isDeleting.value = false
  }
}

async function switchModel(variant: 'quantized' | 'full') {
  if (variant === embeddingModel.value) return
  modelError.value = null
  isSwitching.value = true

  try {
    embeddingModel.value = variant
    await aiSettings.updatePreferences({ embeddingModel: variant })
    await reinitializeEngine(variant)
  } catch (e) {
    modelError.value = e instanceof Error ? e.message : 'Failed to switch model'
    // Revert on failure
    embeddingModel.value = variant === 'full' ? 'quantized' : 'full'
    await aiSettings.updatePreferences({ embeddingModel: embeddingModel.value })
  } finally {
    isSwitching.value = false
  }
}

async function reinitializeEngine(variant: 'quantized' | 'full') {
  const { useTauriML } = await import('~/composables/useTauriML')
  const ml = useTauriML()
  await ml.initialize(undefined, variant)
}
</script>

<template>
  <div class="preferences-section">
    <!-- AI Behavior -->
    <div class="pref-group">
      <div class="group-header">
        <span class="i-lucide-brain group-icon" />
        <div class="group-info">
          <h3 class="group-title">AI Behavior</h3>
          <p class="group-desc">Control how AI assists with mind mapping</p>
        </div>
      </div>

      <!-- Auto-Suggest Connections -->
      <label class="toggle-item">
        <div class="toggle-content">
          <div class="toggle-label">Auto-Suggest Connections</div>
          <p class="toggle-desc">
            Automatically suggest new connections between nodes based on semantic similarity
          </p>
        </div>
        <div class="toggle-control">
          <input
            v-model="autoSuggestConnections"
            type="checkbox"
            class="toggle-checkbox"
            @change="toggleAutoSuggest"
          >
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
        </div>
      </label>

      <!-- Semantic Field -->
      <label class="toggle-item">
        <div class="toggle-content">
          <div class="toggle-label">Semantic Field Visualization</div>
          <p class="toggle-desc">
            Display a visual field showing semantic relationships between nearby nodes
          </p>
        </div>
        <div class="toggle-control">
          <input
            v-model="semanticFieldEnabled"
            type="checkbox"
            class="toggle-checkbox"
            @change="toggleSemanticField"
          >
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
        </div>
      </label>
    </div>

    <!-- Similarity Settings -->
    <div class="pref-group">
      <div class="group-header">
        <span class="i-lucide-sliders-horizontal group-icon" />
        <div class="group-info">
          <h3 class="group-title">Similarity Settings</h3>
          <p class="group-desc">Fine-tune connection suggestions</p>
        </div>
      </div>

      <div class="slider-item">
        <div class="slider-header">
          <span class="slider-label">Connection Threshold</span>
          <span class="slider-value">{{ thresholdLabel }}</span>
        </div>

        <input
          v-model.number="similarityThreshold"
          type="range"
          min="0.1"
          max="0.9"
          step="0.05"
          class="slider-input"
          @change="updateThreshold"
        >

        <div class="slider-hints">
          <span class="hint-low">More</span>
          <span class="hint-high">Fewer</span>
        </div>

        <p class="slider-desc">{{ thresholdDescription }}</p>
      </div>
    </div>

    <!-- Embedding Model (Tauri only) -->
    <div v-if="isTauri" class="pref-group">
      <div class="group-header">
        <span class="i-lucide-cpu group-icon" />
        <div class="group-info">
          <h3 class="group-title">Embedding Model</h3>
          <p class="group-desc">Choose the model used for semantic embeddings</p>
        </div>
      </div>

      <!-- Current status -->
      <div class="model-status-card">
        <div class="model-status-row">
          <span class="model-status-label">Current model</span>
          <span class="model-status-value">{{ currentModelLabel }}</span>
        </div>
        <div class="model-status-row">
          <span class="model-status-label">Hardware</span>
          <span class="model-status-value hardware-badge" :class="{ capable: hardwareInfo?.capableHardware }">
            {{ hardwareLabel }}
          </span>
        </div>
      </div>

      <!-- Capable hardware: show download / switch / delete -->
      <template v-if="hardwareInfo?.capableHardware">
        <!-- Full model NOT downloaded: show download button -->
        <div v-if="!fullModelAvailable" class="model-action-card">
          <div class="model-action-info">
            <div class="model-action-title">Enhanced Model</div>
            <p class="model-action-desc">
              Full-precision all-MiniLM-L6-v2 model provides higher quality embeddings
              for more accurate semantic connections.
            </p>
          </div>

          <button
            class="download-btn"
            :disabled="isDownloading"
            @click="handleDownloadFullModel"
          >
            <span v-if="!isDownloading" class="i-lucide-download download-icon" />
            <span v-if="isDownloading" class="i-lucide-loader-2 download-icon spinning" />
            {{ isDownloading ? `Downloading... ${downloadProgress}%` : 'Download Enhanced Model (~90MB)' }}
          </button>

          <!-- Progress bar -->
          <div v-if="isDownloading" class="progress-bar-container">
            <div class="progress-bar-track">
              <div
                class="progress-bar-fill"
                :style="{ width: `${downloadProgress}%` }"
              />
            </div>
          </div>
        </div>

        <!-- Full model downloaded: show model switcher -->
        <div v-else class="model-action-card">
          <div class="model-radio-group">
            <label
              class="model-radio-item"
              :class="{ active: embeddingModel === 'quantized', disabled: isSwitching }"
            >
              <input
                type="radio"
                name="embeddingModel"
                value="quantized"
                :checked="embeddingModel === 'quantized'"
                :disabled="isSwitching"
                class="model-radio-input"
                @change="switchModel('quantized')"
              >
              <div class="model-radio-content">
                <div class="model-radio-label">Standard (Quantized)</div>
                <p class="model-radio-desc">Bundled ~22MB model, fast startup</p>
              </div>
              <span v-if="embeddingModel === 'quantized'" class="i-lucide-check model-radio-check" />
            </label>

            <label
              class="model-radio-item"
              :class="{ active: embeddingModel === 'full', disabled: isSwitching }"
            >
              <input
                type="radio"
                name="embeddingModel"
                value="full"
                :checked="embeddingModel === 'full'"
                :disabled="isSwitching"
                class="model-radio-input"
                @change="switchModel('full')"
              >
              <div class="model-radio-content">
                <div class="model-radio-label">Enhanced (Full Precision)</div>
                <p class="model-radio-desc">Downloaded ~90MB model, higher quality embeddings</p>
              </div>
              <span v-if="embeddingModel === 'full'" class="i-lucide-check model-radio-check" />
            </label>
          </div>

          <p v-if="isSwitching" class="model-switching-note">
            <span class="i-lucide-loader-2 spinning" />
            Re-initializing embedding engine...
          </p>
          <p class="model-note">
            Switching models will re-initialize the embedding engine. Existing embeddings remain valid (both use 384 dimensions).
          </p>

          <button
            class="delete-model-btn"
            :disabled="isDeleting"
            @click="handleDeleteFullModel"
          >
            <span class="i-lucide-trash-2 delete-icon" />
            {{ isDeleting ? 'Deleting...' : 'Delete Enhanced Model' }}
          </button>
        </div>
      </template>

      <!-- No capable hardware -->
      <div v-else-if="hardwareInfo && !hardwareInfo.capableHardware" class="model-info-card">
        <span class="i-lucide-info model-info-icon" />
        <p class="model-info-text">
          The enhanced embedding model requires Apple Silicon or a dedicated GPU for optimal
          performance. Your current hardware will use the bundled quantized model.
        </p>
      </div>

      <!-- Error display -->
      <div v-if="modelError" class="model-error">
        <span class="i-lucide-alert-circle model-error-icon" />
        <span>{{ modelError }}</span>
      </div>
    </div>

    <!-- Info Box -->
    <div class="info-box">
      <span class="i-lucide-info info-icon" />
      <div class="info-content">
        <p class="info-title">About AI Features</p>
        <p class="info-text">
          These settings affect how AI processes and visualizes your mind maps. You need at least one AI provider configured for these features to work.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preferences-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pref-group {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.group-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.group-icon {
  font-size: 1.25rem;
  color: var(--nc-teal, #00D2BE);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.group-info {
  flex: 1;
}

.group-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--nc-ink, #FAFAFA);
}

.group-desc {
  font-size: 0.8rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.25rem 0 0;
}

/* Toggle Items */
.toggle-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  min-height: 44px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-item:hover {
  border-color: var(--nc-teal, #00D2BE);
  background: var(--nc-surface-2, #121216);
}

.toggle-content {
  flex: 1;
  min-width: 0;
}

.toggle-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.toggle-desc {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.375rem 0 0;
  line-height: 1.4;
}

.toggle-control {
  position: relative;
  flex-shrink: 0;
}

.toggle-checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  display: block;
  width: 44px;
  height: 24px;
  background: var(--nc-surface-3, #18181D);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.toggle-thumb {
  display: block;
  width: 18px;
  height: 18px;
  background: var(--nc-ink-muted, #A1A1AA);
  border-radius: 50%;
  transform: translateX(2px) translateY(2px);
  transition: all 0.2s ease;
}

.toggle-checkbox:checked + .toggle-track {
  background: rgba(0, 210, 190, 0.2);
  border-color: var(--nc-teal, #00D2BE);
}

.toggle-checkbox:checked + .toggle-track .toggle-thumb {
  background: var(--nc-teal, #00D2BE);
  transform: translateX(22px) translateY(2px);
  box-shadow: 0 2px 8px rgba(0, 210, 190, 0.4);
}

.toggle-checkbox:focus-visible + .toggle-track {
  outline: 2px solid var(--nc-teal, #00D2BE);
  outline-offset: 2px;
}

/* Slider Items */
.slider-item {
  padding: 1rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 12px;
}

.slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.875rem;
}

.slider-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.slider-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--nc-teal, #00D2BE);
  padding: 0.25rem 0.625rem;
  background: rgba(0, 210, 190, 0.1);
  border-radius: 6px;
}

.slider-input {
  width: 100%;
  height: 6px;
  background: var(--nc-surface-3, #18181D);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  background: var(--nc-teal, #00D2BE);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 210, 190, 0.4);
  transition: transform 0.2s ease;
}

.slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.slider-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: var(--nc-teal, #00D2BE);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 210, 190, 0.4);
}

@media (hover: none) {
  .slider-input::-webkit-slider-thumb {
    width: 28px;
    height: 28px;
  }

  .slider-input::-moz-range-thumb {
    width: 28px;
    height: 28px;
  }

  .slider-input {
    height: 8px;
  }
}

.slider-hints {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: var(--nc-ink-faint, #71717A);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.slider-desc {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.75rem 0 0;
  line-height: 1.4;
}

/* Info Box */
.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 12px;
}

.info-icon {
  font-size: 1.125rem;
  color: #3B82F6;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.info-content {
  flex: 1;
}

.info-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
  margin: 0 0 0.375rem;
}

.info-text {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
  line-height: 1.5;
}

/* ── Embedding Model Styles ──────────────────────────────────────── */

.model-status-card {
  padding: 1rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.model-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.model-status-label {
  font-size: 0.8rem;
  color: var(--nc-ink-muted, #A1A1AA);
}

.model-status-value {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.hardware-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  background: rgba(113, 113, 122, 0.15);
  font-size: 0.75rem;
}

.hardware-badge.capable {
  background: rgba(0, 210, 190, 0.1);
  color: var(--nc-teal, #00D2BE);
}

.model-action-card {
  padding: 1rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.model-action-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.model-action-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.model-action-desc {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
  line-height: 1.4;
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: rgba(0, 210, 190, 0.15);
  border: 1px solid rgba(0, 210, 190, 0.3);
  border-radius: 8px;
  color: var(--nc-teal, #00D2BE);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.download-btn:hover:not(:disabled) {
  background: rgba(0, 210, 190, 0.25);
  border-color: var(--nc-teal, #00D2BE);
}

.download-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.download-icon {
  font-size: 1rem;
}

.progress-bar-container {
  width: 100%;
}

.progress-bar-track {
  width: 100%;
  height: 4px;
  background: var(--nc-surface-3, #18181D);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--nc-teal, #00D2BE);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Model radio group */
.model-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.model-radio-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--nc-surface-2, #121216);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.model-radio-item:hover:not(.disabled) {
  border-color: rgba(0, 210, 190, 0.4);
}

.model-radio-item.active {
  border-color: var(--nc-teal, #00D2BE);
  background: rgba(0, 210, 190, 0.05);
}

.model-radio-item.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.model-radio-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.model-radio-content {
  flex: 1;
}

.model-radio-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.model-radio-desc {
  font-size: 0.7rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.125rem 0 0;
}

.model-radio-check {
  font-size: 1rem;
  color: var(--nc-teal, #00D2BE);
  flex-shrink: 0;
}

.model-note {
  font-size: 0.7rem;
  color: var(--nc-ink-faint, #71717A);
  margin: 0;
  line-height: 1.4;
}

.model-switching-note {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--nc-teal, #00D2BE);
  margin: 0;
}

.delete-model-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: none;
  border: none;
  color: var(--nc-ink-faint, #71717A);
  font-size: 0.75rem;
  cursor: pointer;
  align-self: flex-start;
  transition: color 0.2s ease;
}

.delete-model-btn:hover:not(:disabled) {
  color: #EF4444;
}

.delete-model-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-icon {
  font-size: 0.875rem;
}

/* Model info card (no capable hardware) */
.model-info-card {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(113, 113, 122, 0.05);
  border: 1px solid rgba(113, 113, 122, 0.15);
  border-radius: 12px;
}

.model-info-icon {
  font-size: 1rem;
  color: var(--nc-ink-muted, #A1A1AA);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.model-info-text {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
  line-height: 1.5;
}

/* Model error */
.model-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-size: 0.75rem;
  color: #EF4444;
}

.model-error-icon {
  font-size: 0.875rem;
  flex-shrink: 0;
}

/* Spinning animation */
.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation-duration: 2s;
  }
}
</style>
