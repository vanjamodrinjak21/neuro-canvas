<script setup lang="ts">
import type { AIProviderConfig, AIProviderType } from '~/types/ai-settings'

const props = defineProps<{
  provider: AIProviderConfig
  hasApiKey: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  setDefault: []
}>()

const providerIcons: Record<AIProviderType, string> = {
  openai: 'i-simple-icons-openai',
  anthropic: 'i-simple-icons-anthropic',
  ollama: 'i-lucide-server',
  openrouter: 'i-lucide-globe',
  custom: 'i-lucide-plug'
}

const providerColors: Record<AIProviderType, string> = {
  openai: '#10A37F',
  anthropic: '#D4A574',
  ollama: '#0EA5E9',
  openrouter: '#8B5CF6',
  custom: '#A1A1AA'
}

const icon = computed(() => providerIcons[props.provider.type] || 'i-lucide-cpu')
const color = computed(() => providerColors[props.provider.type] || '#A1A1AA')

const selectedModel = computed(() => {
  return props.provider.models.find(m => m.id === props.provider.selectedModelId)
})

const statusText = computed(() => {
  if (!props.provider.isEnabled) return 'Disabled'
  if (props.provider.type === 'ollama') return 'Local'
  if (!props.hasApiKey) return 'No API key'
  return 'Ready'
})

const statusColor = computed(() => {
  if (!props.provider.isEnabled) return 'muted'
  if (props.provider.type === 'ollama') return 'info'
  if (!props.hasApiKey) return 'warning'
  return 'success'
})
</script>

<template>
  <div
    class="provider-card"
    :class="{ 'is-default': provider.isDefault, disabled: !provider.isEnabled }"
  >
    <div class="card-header">
      <div class="provider-icon" :style="{ backgroundColor: color + '20', color }">
        <span :class="icon" />
      </div>

      <div class="provider-info">
        <div class="provider-name-row">
          <h4 class="provider-name">{{ provider.name }}</h4>
          <span v-if="provider.isDefault" class="default-badge">Default</span>
        </div>
        <p class="provider-type">{{ provider.type }}</p>
      </div>

      <div class="card-actions">
        <button class="action-btn" title="Edit" @click="emit('edit')">
          <span class="i-lucide-pencil" />
        </button>
        <button class="action-btn danger" title="Delete" @click="emit('delete')">
          <span class="i-lucide-trash-2" />
        </button>
      </div>
    </div>

    <div class="card-body">
      <div class="info-row">
        <span class="info-label">Status</span>
        <span :class="['status-badge', `status-${statusColor}`]">
          <span class="status-dot" />
          {{ statusText }}
        </span>
      </div>

      <div v-if="selectedModel" class="info-row">
        <span class="info-label">Model</span>
        <span class="info-value">{{ selectedModel.name }}</span>
      </div>

      <div v-if="provider.models.length > 0" class="info-row">
        <span class="info-label">Available</span>
        <span class="info-value">{{ provider.models.length }} models</span>
      </div>
    </div>

    <div v-if="!provider.isDefault" class="card-footer">
      <button class="set-default-btn" @click="emit('setDefault')">
        <span class="i-lucide-star" />
        Set as Default
      </button>
    </div>
  </div>
</template>

<style scoped>
.provider-card {
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.provider-card:hover {
  border-color: rgba(0, 210, 190, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.provider-card.is-default {
  border-color: rgba(0, 210, 190, 0.4);
  box-shadow: 0 0 20px rgba(0, 210, 190, 0.1);
}

.provider-card.disabled {
  opacity: 0.6;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem;
  border-bottom: 1px solid var(--nc-border, #252529);
}

.provider-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.375rem;
  flex-shrink: 0;
}

.provider-info {
  flex: 1;
  min-width: 0;
}

.provider-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--nc-ink, #FAFAFA);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.default-badge {
  padding: 0.125rem 0.5rem;
  background: linear-gradient(135deg, var(--nc-teal, #00D2BE), rgba(0, 210, 190, 0.7));
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nc-charcoal, #06060A);
}

.provider-type {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.125rem 0 0;
  text-transform: capitalize;
}

.card-actions {
  display: flex;
  gap: 0.375rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--nc-border, #252529);
  border-radius: 8px;
  color: var(--nc-ink-muted, #A1A1AA);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--nc-surface-2, #121216);
  border-color: var(--nc-teal, #00D2BE);
  color: var(--nc-teal, #00D2BE);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #EF4444;
}

.card-body {
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.info-label {
  font-size: 0.8rem;
  color: var(--nc-ink-muted, #A1A1AA);
}

.info-value {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-success {
  background: rgba(34, 197, 94, 0.1);
  color: #22C55E;
}
.status-success .status-dot {
  background: #22C55E;
}

.status-warning {
  background: rgba(234, 179, 8, 0.1);
  color: #EAB308;
}
.status-warning .status-dot {
  background: #EAB308;
}

.status-info {
  background: rgba(14, 165, 233, 0.1);
  color: #0EA5E9;
}
.status-info .status-dot {
  background: #0EA5E9;
}

.status-muted {
  background: rgba(161, 161, 170, 0.1);
  color: #A1A1AA;
}
.status-muted .status-dot {
  background: #A1A1AA;
}

.card-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--nc-border, #252529);
}

.set-default-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  border: 1px dashed var(--nc-border, #252529);
  border-radius: 8px;
  color: var(--nc-ink-muted, #A1A1AA);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.set-default-btn:hover {
  border-color: var(--nc-teal, #00D2BE);
  border-style: solid;
  color: var(--nc-teal, #00D2BE);
  background: rgba(0, 210, 190, 0.05);
}
</style>
