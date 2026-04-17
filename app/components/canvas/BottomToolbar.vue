<script setup lang="ts">
import type { CanvasTool } from '~/types/canvas'

const { haptics, isMobile } = usePlatform()

const props = defineProps<{
  activeTool: CanvasTool
  zoom: number
  semanticFieldEnabled: boolean
  canUndo?: boolean
  canRedo?: boolean
  processingQueueSize?: number
  processorState?: string
}>()

const emit = defineEmits<{
  'update:activeTool': [tool: CanvasTool]
  'toggle-semantic': []
  'open-semantic-settings': []
  'open-shortcuts': []
  'zoom-in': []
  'zoom-out': []
  'zoom-change': [value: number]
  'zoom-set': [value: number]
  'reset-zoom': []
  'fit-to-content': []
  'undo': []
  'redo': []
}>()

const tools: { id: CanvasTool; icon: string; label: string; shortcut: string }[] = [
  { id: 'select', icon: 'i-lucide-mouse-pointer', label: 'Select', shortcut: 'V' },
  { id: 'pan', icon: 'i-lucide-hand', label: 'Pan', shortcut: 'H' },
  { id: 'node', icon: 'i-lucide-plus', label: 'Add Node', shortcut: 'N' },
  { id: 'connect', icon: 'i-lucide-move-diagonal', label: 'Connect', shortcut: 'C' },
]

const isProcessing = computed(() => (props.processingQueueSize ?? 0) > 0)
const isFieldReady = computed(() => props.semanticFieldEnabled && !isProcessing.value)

function selectTool(tool: CanvasTool) {
  if (isMobile.value) {
    haptics.impact('light')
  }
  emit('update:activeTool', tool)
}
</script>

<template>
  <div class="nc-bottom-toolbar">
    <!-- Left: Tool buttons -->
    <div class="nc-tool-group">
      <button
        v-for="tool in tools"
        :key="tool.id"
        :class="['nc-bottom-tool-btn', activeTool === tool.id && 'active']"
        :title="`${tool.label} (${tool.shortcut})`"
        :aria-label="`${tool.label} tool (${tool.shortcut})`"
        :aria-pressed="activeTool === tool.id"
        role="radio"
        @click="selectTool(tool.id)"
      >
        <span :class="[tool.icon, 'text-base']" />
        <span v-if="activeTool === tool.id" class="nc-tool-indicator" />
      </button>

      <!-- Divider -->
      <div class="toolbar-divider" />

      <!-- Semantic Field Toggle -->
      <button
        :class="['nc-bottom-tool-btn', semanticFieldEnabled && 'active']"
        title="Toggle Semantic Field (S)"
        :aria-label="`Semantic field ${semanticFieldEnabled ? 'on' : 'off'} (S)`"
        :aria-pressed="semanticFieldEnabled"
        @click="emit('toggle-semantic')"
      >
        <span class="i-lucide-network text-base" />
        <span v-if="semanticFieldEnabled" class="nc-tool-indicator" />
        <span v-if="semanticFieldEnabled" class="nc-tool-label">Semantic</span>
      </button>

      <!-- Semantic Settings Gear -->
      <button
        v-if="semanticFieldEnabled"
        class="nc-bottom-tool-btn nc-settings-gear"
        title="Semantic Field Settings"
        aria-label="Open semantic field settings"
        @click="emit('open-semantic-settings')"
      >
        <span class="i-lucide-settings-2 text-xs" />
      </button>

      <!-- Semantic Processing Status -->
      <span
        v-if="semanticFieldEnabled"
        class="nc-semantic-status"
        :title="isProcessing
          ? `Embedding ${processingQueueSize} node${(processingQueueSize ?? 0) > 1 ? 's' : ''}...`
          : 'Semantic field ready'"
      >
        <span v-if="isProcessing" class="nc-semantic-spinner" />
        <span v-if="isProcessing" class="nc-queue-count">{{ processingQueueSize }}</span>
        <span v-else-if="isFieldReady" class="nc-dot-ready" />
      </span>

      <!-- Divider -->
      <div class="toolbar-divider" />

      <!-- Undo / Redo -->
      <button
        class="nc-bottom-tool-btn"
        title="Undo (Ctrl+Z)"
        aria-label="Undo (Ctrl+Z)"
        :disabled="!canUndo"
        @click="emit('undo')"
      >
        <span class="i-lucide-undo-2 text-base" />
      </button>
      <button
        class="nc-bottom-tool-btn"
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo (Ctrl+Shift+Z)"
        :disabled="!canRedo"
        @click="emit('redo')"
      >
        <span class="i-lucide-redo-2 text-base" />
      </button>
    </div>

    <!-- Center: Zoom controls -->
    <CanvasZoomControls
      :zoom="zoom"
      @zoom-in="emit('zoom-in')"
      @zoom-out="emit('zoom-out')"
      @zoom-change="emit('zoom-change', $event)"
      @zoom-set="emit('zoom-set', $event)"
      @reset-zoom="emit('reset-zoom')"
      @fit-to-content="emit('fit-to-content')"
    />

    <!-- Right: Shortcuts hint -->
    <div class="nc-toolbar-right">
      <button
        class="nc-shortcuts-btn"
        aria-label="Show keyboard shortcuts (?)"
        @click="emit('open-shortcuts')"
      >
        <span class="i-lucide-keyboard text-sm" />
        <span class="hidden sm:inline">Shortcuts</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--nc-border);
  margin: 0 2px;
}

.nc-tool-indicator {
  animation: indicator-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes indicator-pop {
  from {
    transform: scaleX(0.3);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nc-tool-indicator {
    animation: none;
  }
  .nc-semantic-spinner {
    animation: none;
    border-color: var(--nc-accent, #00D2BE);
  }
  .nc-dot-ready {
    animation: none;
  }
}

.nc-tool-label {
  position: absolute;
  bottom: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-accent, #00D2BE);
  white-space: nowrap;
  letter-spacing: 0.02em;
  pointer-events: none;
}

.nc-bottom-tool-btn:disabled {
  opacity: 0.4;
  filter: grayscale(0.3);
  cursor: not-allowed;
}

/* ── Semantic settings gear ── */
.nc-settings-gear {
  width: 24px !important;
  height: 24px !important;
  min-width: 24px !important;
  padding: 0 !important;
  opacity: 0.5;
  transition: opacity var(--nc-duration-fast) var(--nc-ease-out);
}

.nc-settings-gear:hover {
  opacity: 1;
}

/* ── Semantic status indicator ── */
.nc-semantic-status {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
}

.nc-semantic-spinner {
  display: inline-block;
  width: 8px;
  height: 8px;
  border: 1.5px solid transparent;
  border-top-color: var(--nc-accent, #00D2BE);
  border-radius: 50%;
  animation: nc-spin 0.8s linear infinite;
}

.nc-queue-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-accent, #00D2BE);
  line-height: 1;
}

.nc-dot-ready {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--nc-accent, #00D2BE);
  animation: nc-pulse-dot 2s ease-in-out infinite;
}

@keyframes nc-spin {
  to { transform: rotate(360deg); }
}

@keyframes nc-pulse-dot {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.3); }
}

@media (max-width: 767px) {
  .nc-bottom-tool-btn {
    min-width: 44px;
    min-height: 44px;
  }
  .nc-settings-gear {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
  }
}
</style>
