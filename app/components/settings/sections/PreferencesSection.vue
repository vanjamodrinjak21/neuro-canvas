<script setup lang="ts">
import { useAISettings } from '~/composables/useAISettings'

const aiSettings = useAISettings()

// Local state bound to preferences
const autoSuggestConnections = ref(true)
const semanticFieldEnabled = ref(true)
const similarityThreshold = ref(0.3)

// Initialize from settings when mounted
onMounted(() => {
  const prefs = aiSettings.settings.value.preferences
  autoSuggestConnections.value = prefs.autoSuggestConnections
  semanticFieldEnabled.value = prefs.semanticFieldEnabled
  similarityThreshold.value = prefs.similarityThreshold
})

// Watch for settings changes
watch(
  () => aiSettings.settings.value.preferences,
  (prefs) => {
    autoSuggestConnections.value = prefs.autoSuggestConnections
    semanticFieldEnabled.value = prefs.semanticFieldEnabled
    similarityThreshold.value = prefs.similarityThreshold
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
</style>
