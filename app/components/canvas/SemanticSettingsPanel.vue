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
      enter-active-class="nc-settings-enter"
      leave-active-class="nc-settings-leave"
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
/* Panel slide: 200ms enter, 150ms exit — transform/opacity, single ease */
.nc-settings-enter {
  transition: transform 200ms var(--nc-ease), opacity 200ms var(--nc-ease);
}

.nc-settings-leave {
  transition: transform 150ms var(--nc-ease), opacity 150ms var(--nc-ease);
}

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
  box-shadow: var(--nc-shadow-md);
  overflow-y: auto;
}

.nc-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--nc-border);
}

/* Panel title — display face (REDESIGN.md §4) */
.nc-settings-title {
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 0;
}

.nc-settings-close {
  background: transparent;
  border: none;
  color: var(--nc-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition:
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

.nc-settings-close:hover {
  color: var(--nc-text);
  background: var(--nc-surface-3);
}

.nc-settings-close:active {
  transform: scale(0.97);
}

.nc-settings-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nc-settings-divider {
  height: 1px;
  background: var(--nc-border);
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

/* Field label — mono uppercase micro-label (REDESIGN.md §5) */
.nc-setting-label {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

.nc-setting-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nc-setting-value {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-accent-text);
}

/* Toggle switch — active = accent fill + knob travel (never color alone) */
.nc-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 2rem;
  background: var(--nc-surface-4);
  border: none;
  cursor: pointer;
  padding: 2px;
  transition:
    background 200ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
  flex-shrink: 0;
}

.nc-toggle:active {
  transform: scale(0.97);
}

.nc-toggle.active {
  background: var(--nc-accent);
}

.nc-toggle-knob {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--nc-text);
  transition:
    transform 200ms var(--nc-ease),
    background 200ms var(--nc-ease);
}

.nc-toggle.active .nc-toggle-knob {
  transform: translateX(16px);
  /* Content on accent pairs with bg (REDESIGN.md §1 selection rule) */
  background: var(--nc-bg);
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
  background: var(--nc-accent);
  cursor: pointer;
  border: 2px solid rgba(0, 0, 0, 0.3);
}

.nc-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--nc-accent);
  cursor: pointer;
  border: 2px solid rgba(0, 0, 0, 0.3);
}

/* AI Status section */
.nc-ai-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Section eyebrow — mono uppercase micro-label (REDESIGN.md §4) */
.nc-status-heading {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
  margin: 0;
}

.nc-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nc-status-label {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.nc-status-value {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  font-weight: 500;
}

.nc-status-value--loading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--nc-accent-text);
}

.nc-status-spinner {
  display: inline-block;
  font-size: calc(12px * var(--nc-text-scale, 1));
  animation: nc-status-spin 0.9s linear infinite;
}

@keyframes nc-status-spin { to { transform: rotate(360deg); } }

/* Compact pill — same family as the sidebar generate button but
   right-sized for an inline status row. Accent tokens flip per theme. */
.nc-status-load-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 12px;
  background: rgba(var(--nc-accent-rgb), 0.12);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.35);
  border-radius: 6px;
  color: var(--nc-accent-text);
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
  transition:
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

.nc-status-load-btn:hover {
  background: rgba(var(--nc-accent-rgb), 0.18);
  border-color: rgba(var(--nc-accent-rgb), 0.5);
}

.nc-status-load-btn:active {
  transform: scale(0.97);
}

.nc-status-load-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

/* Load failure — coral (validation error, REDESIGN.md §1) */
.nc-status-error {
  margin-top: 6px;
  padding: 6px 8px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-coral);
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.25);
  border-radius: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .nc-toggle-knob,
  .nc-status-spinner {
    animation: none;
    transition: none;
  }

  .nc-settings-enter,
  .nc-settings-leave {
    transition: opacity 150ms var(--nc-ease);
  }
}
</style>
