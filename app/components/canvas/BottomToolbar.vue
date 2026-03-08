<script setup lang="ts">
import type { CanvasTool } from '~/types/canvas'

const props = defineProps<{
  activeTool: CanvasTool
  zoom: number
  semanticFieldEnabled: boolean
}>()

const emit = defineEmits<{
  'update:activeTool': [tool: CanvasTool]
  'toggle-semantic': []
  'open-shortcuts': []
  'zoom-in': []
  'zoom-out': []
  'zoom-change': [value: number]
  'zoom-set': [value: number]
  'reset-zoom': []
  'fit-to-content': []
}>()

const tools: { id: CanvasTool; icon: string; label: string; shortcut: string }[] = [
  { id: 'select', icon: 'i-lucide-mouse-pointer', label: 'Select', shortcut: 'V' },
  { id: 'pan', icon: 'i-lucide-hand', label: 'Pan', shortcut: 'H' },
  { id: 'node', icon: 'i-lucide-plus', label: 'Add Node', shortcut: 'N' },
  { id: 'connect', icon: 'i-lucide-move-diagonal', label: 'Connect', shortcut: 'C' },
]
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
        @click="emit('update:activeTool', tool.id)"
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
        @click="emit('toggle-semantic')"
      >
        <span class="i-lucide-network text-base" />
        <span v-if="semanticFieldEnabled" class="nc-tool-indicator" />
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
  height: 20px;
  background: var(--nc-border-active);
  margin: 0 4px;
}
</style>
