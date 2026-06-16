<script setup lang="ts">
import { ref } from 'vue'
import { useSemanticStore } from '~/stores/semanticStore'
import { useAI } from '~/composables/useAI'
import { SEMANTIC_EMBEDDING_MODEL_NAME } from '~/utils/embeddingModel'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const semanticStore = useSemanticStore()
const ai = useAI()

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

// Backend load state. The semantic engine is lazy by default — it loads
// on first semantic operation. Surfacing an explicit "Load now" button
// in the status row turns a passive "Not loaded" label into an action,
// so the user can pre-warm the model before they start exploring.
const isBackendLoaded = computed(() => semanticStore.aiState.modelLoaded === true)
const isBackendLoading = computed(() => {
  const status = semanticStore.aiState.status
  return status === 'loading-model'
})
const loadError = ref<string | null>(null)

async function loadBackend() {
  loadError.value = null
  try {
    await ai.initialize()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not load AI model'
  }
}
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
            <h3 class="nc-settings-title">{{ $t('canvas.semantic.title') }}</h3>
            <button class="nc-settings-close" @click="emit('close')">
              <span class="i-lucide-x text-base" />
            </button>
          </div>

          <!-- Body -->
          <div class="nc-settings-body">
            <!-- Master toggle -->
            <div class="nc-setting-row">
              <label class="nc-setting-label">{{ $t('canvas.semantic.enable') }}</label>
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
              <label class="nc-setting-label">{{ $t('canvas.semantic.field_intensity') }}</label>
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
                <label class="nc-setting-label">{{ $t('canvas.semantic.similarity_threshold') }}</label>
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
              <label class="nc-setting-label">{{ $t('canvas.semantic.show_particles') }}</label>
              <button
                :class="['nc-toggle', settings.showParticles && 'active']"
                @click="updateSetting('showParticles', !settings.showParticles)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">{{ $t('canvas.semantic.show_resonance') }}</label>
              <button
                :class="['nc-toggle', settings.showPulses && 'active']"
                @click="updateSetting('showPulses', !settings.showPulses)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">{{ $t('canvas.semantic.show_cluster_glow') }}</label>
              <button
                :class="['nc-toggle', settings.showClusterGlow && 'active']"
                @click="updateSetting('showClusterGlow', !settings.showClusterGlow)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">{{ $t('canvas.semantic.show_cluster_labels') }}</label>
              <button
                :class="['nc-toggle', settings.showClusterLabels && 'active']"
                @click="updateSetting('showClusterLabels', !settings.showClusterLabels)"
              >
                <span class="nc-toggle-knob" />
              </button>
            </div>

            <div class="nc-setting-row">
              <label class="nc-setting-label">{{ $t('canvas.semantic.interactive_exploration') }}</label>
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
                <label class="nc-setting-label">{{ $t('canvas.semantic.max_field_lines') }}</label>
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
              <label class="nc-setting-label">{{ $t('canvas.semantic.adaptive_line_count') }}</label>
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
              <h4 class="nc-status-heading">{{ $t('canvas.semantic.ai_status') }}</h4>
              <div class="nc-status-row">
                <span class="nc-status-label">{{ $t('canvas.semantic.model') }}</span>
                <span class="nc-status-value">{{ SEMANTIC_EMBEDDING_MODEL_NAME }}</span>
              </div>
              <div class="nc-status-row">
                <span class="nc-status-label">{{ $t('canvas.semantic.backend') }}</span>
                <template v-if="isBackendLoaded">
                  <span class="nc-status-value">{{ backendLabel }}</span>
                </template>
                <template v-else-if="isBackendLoading">
                  <span class="nc-status-value nc-status-value--loading">
                    <span class="nc-status-spinner i-lucide-loader-circle" />
                    {{ $t('canvas.semantic.loading') }}
                  </span>
                </template>
                <template v-else>
                  <button
                    class="nc-status-load-btn"
                    :disabled="isBackendLoading"
                    @click="loadBackend"
                  >
                    <span class="i-lucide-download" />
                    {{ $t('canvas.semantic.load_now') }}
                  </button>
                </template>
              </div>
              <div v-if="loadError" class="nc-status-error">{{ loadError }}</div>
              <div class="nc-status-row">
                <span class="nc-status-label">{{ $t('canvas.semantic.embedded') }}</span>
                <span class="nc-status-value">{{ $t('maps.nodes_count', { n: embeddedCount }) }}</span>
              </div>
              <div class="nc-status-row">
                <span class="nc-status-label">{{ $t('canvas.semantic.clusters') }}</span>
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
  /* Sit in the same band as the node detail panel — below the floating top
     toolbar (which renders above) so the toolbar stays visible and usable. */
  z-index: 140;
  display: flex;
  justify-content: flex-end;
}

.nc-settings-panel {
  width: 360px;
  max-width: 100vw;
  height: 100%;
  /* No top offset: the top toolbar narrows to this panel's left edge when it
     is open (map/[id].vue body:has(.nc-settings-panel) .topbar-root), so the
     panel owns the full-height right column. */
  background: var(--nc-surface);
  border-left: 1px solid var(--nc-border);
  display: flex;
  flex-direction: column;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.18);
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
  background: var(--nc-surface-3);
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
  background: var(--nc-surface-4);
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
  background: var(--nc-surface-4);
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

.nc-status-value--loading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--nc-accent, #00D2BE);
}
.nc-status-spinner {
  display: inline-block;
  font-size: 12px;
  animation: nc-status-spin 0.9s linear infinite;
}
@keyframes nc-status-spin { to { transform: rotate(360deg); } }

/* Compact pill — same family as the sidebar generate button but
   right-sized for an inline status row. Brand teal in both modes. */
.nc-status-load-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 12px;
  background: rgba(0, 210, 190, 0.12);
  border: 1px solid rgba(0, 210, 190, 0.35);
  border-radius: 6px;
  color: var(--nc-accent, #00D2BE);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}
.nc-status-load-btn:hover {
  background: rgba(0, 210, 190, 0.18);
  border-color: rgba(0, 210, 190, 0.5);
}
.nc-status-load-btn:active {
  transform: scale(0.97);
}
.nc-status-load-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}
:root.light .nc-status-load-btn {
  background: rgba(0, 168, 154, 0.10);
  border-color: rgba(0, 168, 154, 0.40);
  color: #00A89A;
}
:root.light .nc-status-load-btn:hover {
  background: rgba(0, 168, 154, 0.16);
  border-color: rgba(0, 168, 154, 0.55);
}

.nc-status-error {
  margin-top: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: #FCA5A5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 6px;
}
:root.light .nc-status-error {
  color: #B91C1C;
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.18);
}

@media (prefers-reduced-motion: reduce) {
  .nc-toggle-knob,
  .nc-status-spinner {
    animation: none;
    transition: none;
  }
}
</style>
