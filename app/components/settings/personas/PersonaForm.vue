<script setup lang="ts">
import type { PersonaConfig } from '~/types/ai-settings'
import { DEFAULT_PERSONA } from '~/types/ai-settings'

const props = defineProps<{
  persona?: PersonaConfig
  isNew?: boolean
}>()

const emit = defineEmits<{
  save: [persona: Omit<PersonaConfig, 'id' | 'createdAt' | 'updatedAt'>]
  cancel: []
}>()

// Form state
const name = ref(props.persona?.name || '')
const systemPrompt = ref(props.persona?.systemPrompt || DEFAULT_PERSONA.systemPrompt)
const temperature = ref(props.persona?.temperature ?? DEFAULT_PERSONA.temperature)
const maxTokens = ref(props.persona?.maxTokens ?? DEFAULT_PERSONA.maxTokens)
const topP = ref(props.persona?.topP ?? 1)
const frequencyPenalty = ref(props.persona?.frequencyPenalty ?? 0)
const presencePenalty = ref(props.persona?.presencePenalty ?? 0)
const isDefault = ref(props.persona?.isDefault ?? false)

// Validation
const isValid = computed(() => {
  return name.value.trim().length > 0 && systemPrompt.value.trim().length > 0
})

// Save
function handleSave() {
  if (!isValid.value) return

  emit('save', {
    name: name.value.trim(),
    systemPrompt: systemPrompt.value.trim(),
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    topP: topP.value,
    frequencyPenalty: frequencyPenalty.value,
    presencePenalty: presencePenalty.value,
    isDefault: isDefault.value
  })
}

// Reset to defaults
function resetToDefaults() {
  systemPrompt.value = DEFAULT_PERSONA.systemPrompt
  temperature.value = DEFAULT_PERSONA.temperature
  maxTokens.value = DEFAULT_PERSONA.maxTokens
  topP.value = 1
  frequencyPenalty.value = 0
  presencePenalty.value = 0
}
</script>

<template>
  <div class="persona-form">
    <div class="form-header">
      <h3 class="form-title">
        {{ isNew ? 'Create Persona' : 'Edit Persona' }}
      </h3>
      <button v-if="!isNew" class="reset-btn" @click="resetToDefaults">
        <span class="i-lucide-rotate-ccw" />
        Reset
      </button>
    </div>

    <!-- Name -->
    <div class="form-group">
      <label class="form-label">Name</label>
      <NcInput
        v-model="name"
        placeholder="e.g., Creative Writer, Technical Analyst"
      />
    </div>

    <!-- System Prompt -->
    <div class="form-group">
      <label class="form-label">System Prompt</label>
      <textarea
        v-model="systemPrompt"
        class="prompt-textarea"
        rows="6"
        placeholder="Describe how the AI should behave, what role it should take, and any specific instructions..."
      />
      <span class="char-count">{{ systemPrompt.length }} characters</span>
    </div>

    <!-- Parameters -->
    <div class="params-section">
      <h4 class="params-title">Model Parameters</h4>

      <div class="params-grid">
        <!-- Temperature -->
        <div class="param-item">
          <div class="param-header">
            <label class="param-label">Temperature</label>
            <span class="param-value">{{ temperature.toFixed(2) }}</span>
          </div>
          <input
            v-model.number="temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            class="param-slider"
          >
          <span class="param-hint">Lower = focused, Higher = creative</span>
        </div>

        <!-- Max Tokens -->
        <div class="param-item">
          <div class="param-header">
            <label class="param-label">Max Tokens</label>
            <span class="param-value">{{ maxTokens }}</span>
          </div>
          <input
            v-model.number="maxTokens"
            type="range"
            min="256"
            max="8192"
            step="256"
            class="param-slider"
          >
          <span class="param-hint">Maximum response length</span>
        </div>

        <!-- Top P -->
        <div class="param-item">
          <div class="param-header">
            <label class="param-label">Top P</label>
            <span class="param-value">{{ topP.toFixed(2) }}</span>
          </div>
          <input
            v-model.number="topP"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="param-slider"
          >
          <span class="param-hint">Nucleus sampling threshold</span>
        </div>

        <!-- Frequency Penalty -->
        <div class="param-item">
          <div class="param-header">
            <label class="param-label">Frequency Penalty</label>
            <span class="param-value">{{ frequencyPenalty.toFixed(2) }}</span>
          </div>
          <input
            v-model.number="frequencyPenalty"
            type="range"
            min="-2"
            max="2"
            step="0.1"
            class="param-slider"
          >
          <span class="param-hint">Reduce repetition of tokens</span>
        </div>
      </div>
    </div>

    <!-- Set as Default Toggle -->
    <div class="form-group toggle-group">
      <div class="toggle-info">
        <label class="form-label">Set as Active Persona</label>
        <span class="toggle-hint">This persona will be used by default</span>
      </div>
      <NcSwitch v-model="isDefault" />
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <NcButton variant="ghost" @click="emit('cancel')">
        Cancel
      </NcButton>
      <NcButton
        variant="primary"
        :disabled="!isValid"
        @click="handleSave"
      >
        <span class="i-lucide-save" />
        {{ isNew ? 'Create Persona' : 'Save Changes' }}
      </NcButton>
    </div>
  </div>
</template>

<style scoped>
.persona-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--nc-ink, #FAFAFA);
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid var(--nc-border, #252529);
  border-radius: 6px;
  color: var(--nc-ink-muted, #A1A1AA);
  font-size: 0.75rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: var(--nc-surface-2, #121216);
  border-color: var(--nc-teal, #00D2BE);
  color: var(--nc-teal, #00D2BE);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--nc-ink-muted, #A1A1AA);
}

.prompt-textarea {
  width: 100%;
  padding: 0.875rem 1rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  color: var(--nc-ink, #FAFAFA);
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: all 0.2s ease;
}

.prompt-textarea::placeholder {
  color: var(--nc-ink-faint, #71717A);
}

.prompt-textarea:focus {
  border-color: var(--nc-teal, #00D2BE);
  box-shadow: 0 0 0 3px rgba(0, 210, 190, 0.1);
}

.char-count {
  font-size: 0.7rem;
  color: var(--nc-ink-faint, #71717A);
  text-align: right;
}

.params-section {
  padding: 1rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 12px;
}

.params-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.params-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.param-label {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
}

.param-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--nc-teal, #00D2BE);
  font-family: 'JetBrains Mono', monospace;
}

.param-slider {
  width: 100%;
  height: 4px;
  background: var(--nc-surface-2, #121216);
  border-radius: 2px;
  appearance: none;
  cursor: pointer;
}

.param-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--nc-teal, #00D2BE);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.param-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.param-hint {
  font-size: 0.65rem;
  color: var(--nc-ink-faint, #71717A);
}

.toggle-group {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.toggle-info .form-label {
  margin: 0;
}

.toggle-hint {
  font-size: 0.7rem;
  color: var(--nc-ink-faint, #71717A);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--nc-border, #252529);
}

@media (max-width: 480px) {
  .params-grid {
    grid-template-columns: 1fr;
  }
}
</style>
