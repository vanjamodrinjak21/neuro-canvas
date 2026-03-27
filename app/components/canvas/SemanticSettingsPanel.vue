<script setup lang="ts">
import { useSemanticStore } from '~/stores/semanticStore'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const semanticStore = useSemanticStore()

// Local refs bound to store settings
const settings = computed(() => semanticStore.fieldSettings)

function updateSetting<K extends keyof typeof settings.value>(key: K, value: typeof settings.value[K]) {
  semanticStore.updateFieldSettings({ [key]: value })
}

// AI status info
const backendLabel = computed(() => {
  const bt = semanticStore.aiState.backendType
  if (bt === 'native') return 'Native ONNX'
  if (bt === 'web') return semanticStore.aiState.hasWebGPU ? 'WebGPU' : 'WASM'
  return 'Not loaded'
})

const embeddedCount = computed(() => semanticStore.embeddedNodeCount)
const clusterCount = computed(() => semanticStore.clusterCount)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="translate-x-full opacity-0"
      leave-to-class="translate-x-full opacity-0"
    >
      <div
        v-if="visible"
        class="nc-settings-overlay"
        @click.self="emit('close')"
      >
        <div class="nc-settings-panel">
          <!-- Header -->
          <div class="nc-settings-header">
            <h3 class="nc-settings-title">Semantic Field</h3>
            <button class="nc-settings-close" @click="emit('close')">
              <span class="i-lucide-x text-base" />
            </button>
          </div>

          <!-- Body -->
          <div class="nc-settings-body">
            <!-- Master toggle -->
            <div class="nc-setting-row">
              <label class="nc-setting-label">Enable</label>
              <button
                :class="['nc-toggle', settings.enabled && 'active']"
                @click="semanticStore.toggleField()"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-settings-divider" />

            <!-- Field intensity -->
            <div class="nc-setting-row column">
              <label class="nc-setting-label">Field Intensity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="settings.intensity"
                class="nc-slider"
                @input="updateSetting('intensity', parseFloat(($event.target as HTMLInputElement).value))"
              >
            </div>

            <!-- Similarity threshold -->
            <div class="nc-setting-row column">
              <div class="nc-setting-label-row">
                <label class="nc-setting-label">Similarity Threshold</label>
                <span class="nc-setting-value">{{ Math.round(settings.similarityThreshold * 100) }}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                :value="settings.similarityThreshold"
                class="nc-slider"
                @input="updateSetting('similarityThreshold', parseFloat(($event.target as HTMLInputElement).value))"
              >
            </div>

            <div class="nc-settings-divider" />

            <!-- Toggles -->
            <div class="nc-setting-row">
              <label class="nc-setting-label">Show Particles</label>
              <button
                :class="['nc-toggle', settings.showParticles && 'active']"
                @click="updateSetting('showParticles', !settings.showParticles)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">Show Resonance Pulses</label>
              <button
                :class="['nc-toggle', settings.showPulses && 'active']"
                @click="updateSetting('showPulses', !settings.showPulses)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">Show Cluster Glow</label>
              <button
                :class="['nc-toggle', settings.showClusterGlow && 'active']"
                @click="updateSetting('showClusterGlow', !settings.showClusterGlow)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">Show Cluster Labels</label>
              <button
                :class="['nc-toggle', settings.showClusterLabels && 'active']"
                @click="updateSetting('showClusterLabels', !settings.showClusterLabels)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">Interactive Exploration</label>
              <button
                :class="['nc-toggle', settings.interactiveExploration && 'active']"
                @click="updateSetting('interactiveExploration', !settings.interactiveExploration)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-settings-divider" />

            <!-- Max field lines -->
            <div class="nc-setting-row column">
              <div class="nc-setting-label-row">
                <label class="nc-setting-label">Max Field Lines</label>
                <span class="nc-setting-value">{{ settings.maxFieldLines }}</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                :value="settings.maxFieldLines"
                class="nc-slider"
                @input="updateSetting('maxFieldLines', parseInt(($event.target as HTMLInputElement).value))"
              >
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">Adaptive Line Count</label>
              <button
                :class="['nc-toggle', settings.adaptiveLineCount && 'active']"
                @click="updateSetting('adaptiveLineCount', !settings.adaptiveLineCount)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-settings-divider" />

            <!-- AI Status -->
            <div class="nc-ai-status">
              <h4 class="nc-status-heading">AI Status</h4>
              <div class="nc-status-row">
                <span class="nc-status-label">Model</span>
                <span class="nc-status-value">all-MiniLM-L6-v2</span>
              </div>
              <div class="nc-status-row">
                <span class="nc-status-label">Backend</span>
                <span class="nc-status-value">{{ backendLabel }}</span>
              </div>
              <div class="nc-status-row">
                <span class="nc-status-label">Embedded</span>
                <span class="nc-status-value">{{ embeddedCount }} nodes</span>
              </div>
              <div class="nc-status-row">
                <span class="nc-status-label">Clusters</span>
                <span class="nc-status-value">{{ clusterCount }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nc-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  justify-content: flex-end;
}

.nc-settings-panel {
  width: 300px;
  height: 100%;
  background: var(--nc-glass-bg-elevated, rgba(28, 28, 32, 0.95));
  backdrop-filter: blur(20px);
  border-left: 1px solid var(--nc-border, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.3);
  overflow-y: auto;
}

.nc-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--nc-border, rgba(255, 255, 255, 0.06));
}

.nc-settings-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--nc-ink, rgba(255, 255, 255, 0.95));
  margin: 0;
}

.nc-settings-close {
  background: transparent;
  border: none;
  color: var(--nc-ink-soft, rgba(255, 255, 255, 0.4));
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}

.nc-settings-close:hover {
  color: var(--nc-ink, rgba(255, 255, 255, 0.9));
  background: rgba(255, 255, 255, 0.06);
}

.nc-settings-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nc-settings-divider {
  height: 1px;
  background: var(--nc-border, rgba(255, 255, 255, 0.06));
  margin: 4px 0;
}

.nc-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nc-setting-row.column {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.nc-setting-label {
  font-size: 12px;
  color: var(--nc-ink, rgba(255, 255, 255, 0.8));
}

.nc-setting-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nc-setting-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-accent, #00D2BE);
}

/* Toggle switch */
.nc-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  cursor: pointer;
  padding: 2px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.nc-toggle.active {
  background: var(--nc-accent, #00D2BE);
}

.nc-toggle-knob {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
}

.nc-toggle.active .nc-toggle-knob {
  transform: translateX(16px);
}

/* Slider */
.nc-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
}

.nc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--nc-accent, #00D2BE);
  cursor: pointer;
  border: 2px solid rgba(0, 0, 0, 0.3);
}

.nc-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--nc-accent, #00D2BE);
  cursor: pointer;
  border: 2px solid rgba(0, 0, 0, 0.3);
}

/* AI Status section */
.nc-ai-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nc-status-heading {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nc-ink-soft, rgba(255, 255, 255, 0.4));
  margin: 0;
}

.nc-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nc-status-label {
  font-size: 11px;
  color: var(--nc-ink-soft, rgba(255, 255, 255, 0.5));
}

.nc-status-value {
  font-size: 11px;
  color: var(--nc-ink, rgba(255, 255, 255, 0.8));
  font-weight: 500;
}

@media (prefers-reduced-motion: reduce) {
  .nc-toggle-knob {
    transition: none;
  }
}
</style>
