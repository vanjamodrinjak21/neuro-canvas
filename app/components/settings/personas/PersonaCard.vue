<script setup lang="ts">
import type { PersonaConfig } from '~/types/ai-settings'

const props = defineProps<{
  persona: PersonaConfig
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  setDefault: []
}>()

// Truncate system prompt for preview
const promptPreview = computed(() => {
  const prompt = props.persona.systemPrompt
  if (prompt.length <= 100) return prompt
  return prompt.slice(0, 100) + '...'
})
</script>

<template>
  <div class="persona-card" :class="{ 'is-default': persona.isDefault }">
    <div class="card-header">
      <div class="persona-icon">
        <span class="i-lucide-bot" />
      </div>

      <div class="persona-info">
        <div class="persona-name-row">
          <h4 class="persona-name">{{ persona.name }}</h4>
          <span v-if="persona.isDefault" class="default-badge">Active</span>
        </div>
        <p class="persona-preview">{{ promptPreview }}</p>
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
      <div class="param-row">
        <span class="param-label">Temperature</span>
        <span class="param-value">{{ persona.temperature }}</span>
      </div>
      <div class="param-row">
        <span class="param-label">Max Tokens</span>
        <span class="param-value">{{ persona.maxTokens }}</span>
      </div>
    </div>

    <div v-if="!persona.isDefault" class="card-footer">
      <button class="set-default-btn" @click="emit('setDefault')">
        <span class="i-lucide-check-circle" />
        Set as Active
      </button>
    </div>
  </div>
</template>

<style scoped>
.persona-card {
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.persona-card:hover {
  border-color: rgba(0, 210, 190, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.persona-card.is-default {
  border-color: rgba(0, 210, 190, 0.4);
  box-shadow: 0 0 20px rgba(0, 210, 190, 0.1);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1rem;
  border-bottom: 1px solid var(--nc-border, #252529);
}

.persona-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1));
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  color: #8B5CF6;
  flex-shrink: 0;
}

.persona-info {
  flex: 1;
  min-width: 0;
}

.persona-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.persona-name {
  font-size: 0.95rem;
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
  flex-shrink: 0;
}

.persona-preview {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.25rem 0 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.action-btn {
  width: 30px;
  height: 30px;
  background: transparent;
  border: 1px solid var(--nc-border, #252529);
  border-radius: 6px;
  color: var(--nc-ink-muted, #A1A1AA);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
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
  padding: 0.75rem 1rem;
  display: flex;
  gap: 1.5rem;
}

.param-row {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.param-label {
  font-size: 0.7rem;
  color: var(--nc-ink-faint, #71717A);
}

.param-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
}

.card-footer {
  padding: 0.625rem 1rem;
  border-top: 1px solid var(--nc-border, #252529);
}

.set-default-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem;
  background: transparent;
  border: 1px dashed var(--nc-border, #252529);
  border-radius: 6px;
  color: var(--nc-ink-muted, #A1A1AA);
  font-size: 0.75rem;
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
