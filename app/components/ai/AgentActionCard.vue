<script setup lang="ts">
import type { AgentAction } from '~/ai/types/agent'

const props = defineProps<{
  action: AgentAction
}>()

const emit = defineEmits<{
  accept: [action: AgentAction]
  dismiss: [action: AgentAction]
}>()

const actionIcons: Record<string, string> = {
  'add-node': 'i-lucide-plus-circle',
  'add-connection': 'i-lucide-link',
  'suggest-restructure': 'i-lucide-layout-grid',
  'highlight-nodes': 'i-lucide-highlight',
  'ask-question': 'i-lucide-help-circle'
}

const actionColors: Record<string, string> = {
  'add-node': '#4ADE80',
  'add-connection': '#60A5FA',
  'suggest-restructure': '#A78BFA',
  'highlight-nodes': '#FBBF24',
  'ask-question': '#F472B6'
}

const actionLabels: Record<string, string> = {
  'add-node': 'Add Node',
  'add-connection': 'Connect',
  'suggest-restructure': 'Restructure',
  'highlight-nodes': 'Highlight',
  'ask-question': 'Question'
}
</script>

<template>
  <div class="nc-action-card" :style="{ borderLeftColor: actionColors[action.type] || '#888890' }">
    <div class="nc-action-header">
      <span
        :class="[actionIcons[action.type] || 'i-nc-ai-mark', 'text-sm']"
        :style="{ color: actionColors[action.type] || '#888890' }"
      />
      <span class="nc-action-label">{{ actionLabels[action.type] || action.type }}</span>
    </div>
    <p class="nc-action-description">{{ action.description }}</p>
    <div class="nc-action-buttons">
      <button class="nc-action-accept" @click="emit('accept', action)">
        <span class="i-lucide-check text-xs" />
        Apply
      </button>
      <button class="nc-action-dismiss" @click="emit('dismiss', action)">
        <span class="i-lucide-x text-xs" />
        Dismiss
      </button>
    </div>
  </div>
</template>

<style scoped>
.nc-action-card {
  background: #141418;
  border: 1px solid var(--nc-border);
  border-left: 3px solid;
  border-radius: 6px;
  padding: 10px 12px;
}

.nc-action-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.nc-action-label {
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.nc-action-description {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: #888890;
  line-height: 1.5;
  margin-bottom: 8px;
}

.nc-action-buttons {
  display: flex;
  gap: 6px;
}

.nc-action-accept,
.nc-action-dismiss {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.nc-action-accept:active,
.nc-action-dismiss:active {
  transform: scale(0.97);
}

.nc-action-accept {
  background: rgba(94, 242, 232, 0.1);
  border: 1px solid rgba(94, 242, 232, 0.3);
  color: var(--nc-accent);
}

.nc-action-accept:hover {
  background: rgba(94, 242, 232, 0.2);
  border-color: var(--nc-accent);
}

.nc-action-dismiss {
  background: transparent;
  border: 1px solid #2A2A30;
  color: #666670;
}

.nc-action-dismiss:hover {
  border-color: #3A3A42;
  color: var(--nc-text);
}
</style>
