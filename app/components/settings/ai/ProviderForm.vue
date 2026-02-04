<script setup lang="ts">
import type { AIProviderConfig, AIProviderType, AIModel } from '~/types/ai-settings'
import { PROVIDER_TEMPLATES } from '~/types/ai-settings'
import { useAISettings } from '~/composables/useAISettings'

const props = defineProps<{
  provider?: AIProviderConfig
  isNew?: boolean
}>()

const emit = defineEmits<{
  save: [provider: Partial<AIProviderConfig>, apiKey?: string]
  cancel: []
}>()

const aiSettings = useAISettings()

// Form state
const selectedType = ref<AIProviderType>(props.provider?.type || 'openai')
const name = ref(props.provider?.name || '')
const baseUrl = ref(props.provider?.baseUrl || '')
const apiKey = ref('')
const selectedModelId = ref(props.provider?.selectedModelId || '')
const models = ref<AIModel[]>(props.provider?.models || [])
const isEnabled = ref(props.provider?.isEnabled ?? true)

// Connection test state
const connectionStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const connectionMessage = ref('')

// Track if API key is stored
const hasStoredKey = ref(false)

// Load stored key status
onMounted(async () => {
  if (props.provider?.id) {
    hasStoredKey.value = await aiSettings.hasProviderApiKey(props.provider.id)
  }
})

// Update form when type changes
watch(selectedType, (type) => {
  if (props.isNew) {
    const template = PROVIDER_TEMPLATES[type]
    name.value = template.name || type
    baseUrl.value = template.baseUrl || ''
    models.value = [...(template.models || [])]
    selectedModelId.value = template.models?.[0]?.id || ''
    connectionStatus.value = 'idle'
    connectionMessage.value = ''
  }
})

// Initialize with template if new
if (props.isNew) {
  const template = PROVIDER_TEMPLATES[selectedType.value]
  name.value = template.name || selectedType.value
  baseUrl.value = template.baseUrl || ''
  models.value = [...(template.models || [])]
  selectedModelId.value = template.models?.[0]?.id || ''
}

// Check if Ollama localhost won't work (production site)
const isOllamaLocalhostWarning = computed(() => {
  if (selectedType.value !== 'ollama') return false
  const isLocalhost = baseUrl.value?.includes('localhost') || baseUrl.value?.includes('127.0.0.1')
  const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
  return isLocalhost && isProduction
})

// Validation
const isValid = computed(() => {
  if (!name.value.trim()) return false
  if (selectedType.value === 'custom' && !baseUrl.value.trim()) return false
  return true
})

// Test connection
async function testConnection() {
  connectionStatus.value = 'testing'
  connectionMessage.value = ''

  // Create a temporary provider config for testing
  const tempProvider: AIProviderConfig = {
    id: props.provider?.id || 'temp',
    type: selectedType.value,
    name: name.value,
    baseUrl: baseUrl.value,
    models: models.value,
    selectedModelId: selectedModelId.value,
    isEnabled: true,
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  // Determine what to test with
  let result
  if (props.provider?.id) {
    // Existing provider - use ID, optionally with new API key
    result = await aiSettings.testConnection(props.provider.id, apiKey.value || undefined)
  } else {
    // New provider - pass config directly with the entered API key
    result = await aiSettings.testConnection(tempProvider, apiKey.value || undefined)
  }

  if (result.success) {
    connectionStatus.value = 'success'
    connectionMessage.value = result.message

    // Update models if provider returns them (Ollama, OpenRouter)
    if (result.models && result.models.length > 0) {
      models.value = result.models
      if (!selectedModelId.value || !result.models.find(m => m.id === selectedModelId.value)) {
        selectedModelId.value = result.models[0]?.id || ''
      }
    }
  } else {
    connectionStatus.value = 'error'
    connectionMessage.value = result.message
  }
}

// Save provider
function handleSave() {
  const providerData: Partial<AIProviderConfig> = {
    type: selectedType.value,
    name: name.value.trim(),
    baseUrl: baseUrl.value.trim() || undefined,
    models: models.value,
    selectedModelId: selectedModelId.value || undefined,
    isEnabled: isEnabled.value
  }

  if (props.provider?.id) {
    providerData.id = props.provider.id
  }

  emit('save', providerData, apiKey.value || undefined)
}

// Provider type options
const typeOptions = [
  { value: 'openai', label: 'OpenAI', icon: 'i-simple-icons-openai' },
  { value: 'anthropic', label: 'Anthropic', icon: 'i-simple-icons-anthropic' },
  { value: 'ollama', label: 'Ollama (Local)', icon: 'i-lucide-server' },
  { value: 'openrouter', label: 'OpenRouter', icon: 'i-lucide-globe' },
  { value: 'custom', label: 'Custom', icon: 'i-lucide-plug' }
]
</script>

<template>
  <div class="provider-form">
    <h3 class="form-title">
      {{ isNew ? 'Add Provider' : 'Edit Provider' }}
    </h3>

    <!-- Provider Type (only for new) -->
    <div v-if="isNew" class="form-group">
      <label class="form-label">Provider Type</label>
      <div class="type-grid">
        <button
          v-for="opt in typeOptions"
          :key="opt.value"
          :class="['type-option', { active: selectedType === opt.value }]"
          @click="selectedType = opt.value as AIProviderType"
        >
          <span :class="[opt.icon, 'type-icon']" />
          <span class="type-label">{{ opt.label }}</span>
        </button>
      </div>
    </div>

    <!-- Name -->
    <div class="form-group">
      <label class="form-label">Display Name</label>
      <div class="name-input-wrapper">
        <span class="i-lucide-tag input-icon" />
        <input
          v-model="name"
          type="text"
          class="name-input"
          placeholder="e.g., My OpenAI Account"
        >
      </div>
    </div>

    <!-- Base URL -->
    <div v-if="selectedType === 'ollama' || selectedType === 'custom'" class="form-group">
      <label class="form-label">
        {{ selectedType === 'ollama' ? 'Ollama Server URL' : 'API Base URL' }}
      </label>
      <NcInput
        v-model="baseUrl"
        placeholder="http://localhost:11434"
      />
    </div>

    <!-- Ollama localhost warning -->
    <div v-if="isOllamaLocalhostWarning" class="warning-box">
      <span class="i-lucide-alert-triangle warning-icon" />
      <div class="warning-content">
        <p class="warning-title">Local Ollama not available</p>
        <p class="warning-text">
          You're accessing this site remotely. Local Ollama (localhost) only works when running the app locally.
          Use <strong>OpenAI</strong> or <strong>Anthropic</strong> for cloud access.
        </p>
      </div>
    </div>

    <!-- API Key (not for Ollama) -->
    <div v-if="selectedType !== 'ollama'" class="form-group">
      <label class="form-label">API Key</label>
      <SettingsAiAPIKeyInput
        v-model="apiKey"
        :has-stored-key="hasStoredKey"
        :placeholder="`Enter ${selectedType === 'anthropic' ? 'Anthropic' : selectedType === 'openrouter' ? 'OpenRouter' : 'OpenAI'} API key`"
      />
    </div>

    <!-- Connection Test -->
    <div class="form-group">
      <SettingsAiConnectionTester
        :status="connectionStatus"
        :message="connectionMessage"
        @test="testConnection"
      />
    </div>

    <!-- Model Selection -->
    <div v-if="models.length > 0" class="form-group">
      <label class="form-label">Default Model</label>
      <select
        v-model="selectedModelId"
        class="model-select"
      >
        <option value="">Select a model</option>
        <option v-for="model in models" :key="model.id" :value="model.id">
          {{ model.name }}
        </option>
      </select>
    </div>

    <!-- Enable Toggle -->
    <div class="form-group toggle-group">
      <div class="toggle-info">
        <label class="form-label">Enabled</label>
        <span class="toggle-hint">Provider will be available for use</span>
      </div>
      <NcSwitch v-model="isEnabled" />
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
        {{ isNew ? 'Add Provider' : 'Save Changes' }}
      </NcButton>
    </div>
  </div>
</template>

<style scoped>
.provider-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--nc-ink, #FAFAFA);
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

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.type-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 0.5rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  color: var(--nc-ink-muted, #A1A1AA);
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-option:hover {
  background: var(--nc-surface-2, #121216);
  border-color: rgba(0, 210, 190, 0.3);
}

.type-option.active {
  background: rgba(0, 210, 190, 0.1);
  border-color: var(--nc-teal, #00D2BE);
  color: var(--nc-teal, #00D2BE);
}

.type-icon {
  font-size: 1.25rem;
}

.type-label {
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
}

.name-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1rem;
  min-height: 48px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.name-input-wrapper:focus-within {
  border-color: var(--nc-teal, #00D2BE);
  box-shadow: 0 0 0 3px rgba(0, 210, 190, 0.1);
}

.name-input-wrapper .input-icon {
  font-size: 1rem;
  color: var(--nc-ink-muted, #A1A1AA);
  flex-shrink: 0;
}

.name-input {
  flex: 1;
  min-width: 0;
  padding: 0.75rem 0;
  background: transparent;
  border: none;
  color: var(--nc-ink, #FAFAFA);
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  width: 100%;
}

.name-input::placeholder {
  color: var(--nc-ink-faint, #71717A);
}

.model-select {
  width: 100%;
  min-height: 48px;
  padding: 0.75rem 1rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  color: var(--nc-ink, #FAFAFA);
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23A1A1AA' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

.model-select:focus {
  border-color: var(--nc-teal, #00D2BE);
  box-shadow: 0 0 0 3px rgba(0, 210, 190, 0.1);
}

.model-select option {
  background: var(--nc-surface, #0C0C10);
  color: var(--nc-ink, #FAFAFA);
}

.toggle-group {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1rem;
  min-height: 56px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.toggle-info .form-label {
  margin: 0;
  line-height: 1.4;
}

.toggle-hint {
  font-size: 0.75rem;
  color: var(--nc-ink-faint, #71717A);
  line-height: 1.4;
  word-wrap: break-word;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--nc-border, #252529);
}

@media (max-width: 480px) {
  .type-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.warning-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(234, 179, 8, 0.08);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: 10px;
}

.warning-icon {
  font-size: 1.25rem;
  color: #EAB308;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.warning-content {
  flex: 1;
}

.warning-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #EAB308;
  margin: 0 0 0.375rem;
}

.warning-text {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
  line-height: 1.5;
}

.warning-text strong {
  color: var(--nc-teal, #00D2BE);
}
</style>
