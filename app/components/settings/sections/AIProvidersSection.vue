<script setup lang="ts">
import type { AIProviderConfig, AIProviderType } from '~/types/ai-settings'
import { useAISettings } from '~/composables/useAISettings'

const aiSettings = useAISettings()

// View state
const showForm = ref(false)
const editingProvider = ref<AIProviderConfig | null>(null)
const isNewProvider = ref(false)

// Track which providers have API keys
const providerKeyStatus = ref<Map<string, boolean>>(new Map())
const unmigratedCount = ref(0)

// Load key status for all providers
async function loadKeyStatus() {
  for (const provider of aiSettings.providers.value) {
    const hasKey = await aiSettings.hasProviderApiKey(provider.id)
    providerKeyStatus.value.set(provider.id, hasKey)
  }
  unmigratedCount.value = await aiSettings.getUnmigratedCount()
}

watch(() => aiSettings.providers.value, loadKeyStatus, { immediate: true })

// Open form for new provider
function addNewProvider() {
  editingProvider.value = null
  isNewProvider.value = true
  saveError.value = null
  showForm.value = true
}

// Open form to edit existing provider
function editProvider(provider: AIProviderConfig) {
  editingProvider.value = provider
  isNewProvider.value = false
  saveError.value = null
  showForm.value = true
}

// Error state
const saveError = ref<string | null>(null)

// Handle form save
async function handleSave(data: Partial<AIProviderConfig>, apiKey?: string) {
  saveError.value = null
  try {
    if (isNewProvider.value) {
      // Add new provider
      await aiSettings.addProvider(
        data.type as AIProviderType,
        data.name,
        apiKey,
        data.baseUrl
      )

      // Update with additional settings
      const newProvider = aiSettings.providers.value[aiSettings.providers.value.length - 1]
      if (newProvider && (data.selectedModelId || data.models || !data.isEnabled)) {
        await aiSettings.updateProvider(newProvider.id, {
          selectedModelId: data.selectedModelId,
          models: data.models,
          isEnabled: data.isEnabled ?? true
        })
      }
    } else if (editingProvider.value) {
      // Update existing provider
      await aiSettings.updateProvider(editingProvider.value.id, data)

      // Update API key if provided
      if (apiKey) {
        await aiSettings.updateProviderApiKey(editingProvider.value.id, apiKey)
      }
    }

    showForm.value = false
    editingProvider.value = null
    await loadKeyStatus()
  } catch (e) {
    console.error('Failed to save provider:', e)
    saveError.value = e instanceof Error ? e.message : 'Failed to save provider'
  }
}

// Cancel form
function handleCancel() {
  showForm.value = false
  editingProvider.value = null
}

// Delete provider
async function handleDelete(provider: AIProviderConfig) {
  if (!confirm(`Delete "${provider.name}"? This will also remove any stored API key.`)) {
    return
  }

  await aiSettings.deleteProvider(provider.id)
  providerKeyStatus.value.delete(provider.id)
}

// Set default provider
async function handleSetDefault(provider: AIProviderConfig) {
  await aiSettings.setDefaultProvider(provider.id)
}
</script>

<template>
  <div class="providers-section">
    <!-- Form View -->
    <template v-if="showForm">
      <!-- Error Alert -->
      <div v-if="saveError" class="error-alert">
        <span class="i-lucide-alert-circle error-icon" />
        <span class="error-text">{{ saveError }}</span>
        <button class="error-dismiss" @click="saveError = null">
          <span class="i-lucide-x" />
        </button>
      </div>

      <SettingsAiProviderForm
        :provider="editingProvider || undefined"
        :is-new="isNewProvider"
        @save="handleSave"
        @cancel="handleCancel"
      />
    </template>

    <!-- List View -->
    <template v-else>
      <!-- Header -->
      <div class="section-header">
        <div class="header-info">
          <h3 class="section-title">AI Providers</h3>
          <p class="section-desc">Configure your BYOK (Bring Your Own Key) AI providers</p>
        </div>
        <NcButton variant="primary" size="sm" @click="addNewProvider">
          <span class="i-lucide-plus" />
          Add Provider
        </NcButton>
      </div>

      <!-- Loading -->
      <div v-if="aiSettings.isLoading.value" class="loading-state">
        <span class="i-lucide-loader-2 loading-icon" />
        Loading providers...
      </div>

      <!-- Empty State -->
      <div v-else-if="aiSettings.providers.value.length === 0" class="empty-state">
        <div class="empty-icon">
          <span class="i-lucide-cpu" />
        </div>
        <h4 class="empty-title">No AI Providers</h4>
        <p class="empty-desc">
          Add your first AI provider to enable AI-powered features like smart expand and connection suggestions.
        </p>
        <NcButton variant="primary" @click="addNewProvider">
          <span class="i-lucide-plus" />
          Add Your First Provider
        </NcButton>
      </div>

      <!-- Provider List -->
      <div v-else class="providers-grid">
        <SettingsAiProviderCard
          v-for="provider in aiSettings.providers.value"
          :key="provider.id"
          :provider="provider"
          :has-api-key="providerKeyStatus.get(provider.id) || false"
          @edit="editProvider(provider)"
          @delete="handleDelete(provider)"
          @set-default="handleSetDefault(provider)"
        />
      </div>

      <!-- Migration Warning -->
      <div v-if="unmigratedCount > 0" class="migration-warning">
        <span class="i-lucide-shield-alert migration-icon" />
        <p class="migration-text">
          {{ unmigratedCount }} API key{{ unmigratedCount > 1 ? 's use' : ' uses' }} older encryption. Open each provider and save to update.
        </p>
      </div>

      <!-- Info Box -->
      <div v-if="aiSettings.providers.value.length > 0" class="info-box">
        <span class="i-lucide-info info-icon" />
        <p class="info-text">
          Your API keys are encrypted and stored locally in your browser. They are never sent to our servers.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.providers-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.header-info {
  flex: 1;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--nc-ink, #FAFAFA);
}

.section-desc {
  font-size: 0.8rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.25rem 0 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 3rem;
  color: var(--nc-ink-muted, #A1A1AA);
  font-size: 0.875rem;
}

.loading-icon {
  font-size: 1.25rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.5rem 1.5rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px dashed var(--nc-border, #252529);
  border-radius: 16px;
}

.empty-icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, rgba(0, 210, 190, 0.1), rgba(0, 210, 190, 0.05));
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--nc-teal, #00D2BE);
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--nc-ink, #FAFAFA);
}

.empty-desc {
  font-size: 0.8rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0 0 1.25rem;
  max-width: 300px;
  line-height: 1.5;
}

.providers-grid {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.info-box {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: rgba(0, 210, 190, 0.05);
  border: 1px solid rgba(0, 210, 190, 0.15);
  border-radius: 10px;
}

.info-icon {
  font-size: 1rem;
  color: var(--nc-teal, #00D2BE);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.info-text {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
  line-height: 1.5;
}

.migration-warning {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 10px;
}

.migration-icon {
  font-size: 1rem;
  color: #F59E0B;
  flex-shrink: 0;
}

.migration-text {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
  line-height: 1.5;
}

.error-alert {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  margin-bottom: 0.5rem;
}

.error-icon {
  font-size: 1rem;
  color: #EF4444;
  flex-shrink: 0;
}

.error-text {
  flex: 1;
  font-size: 0.8rem;
  color: #EF4444;
}

.error-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #EF4444;
  cursor: pointer;
  transition: background 0.2s ease;
}

.error-dismiss:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
