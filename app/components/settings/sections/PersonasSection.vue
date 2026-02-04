<script setup lang="ts">
import type { PersonaConfig } from '~/types/ai-settings'
import { useAISettings } from '~/composables/useAISettings'

const aiSettings = useAISettings()

// View state
const showForm = ref(false)
const editingPersona = ref<PersonaConfig | null>(null)
const isNewPersona = ref(false)

// Open form for new persona
function addNewPersona() {
  editingPersona.value = null
  isNewPersona.value = true
  showForm.value = true
}

// Open form to edit existing persona
function editPersona(persona: PersonaConfig) {
  editingPersona.value = persona
  isNewPersona.value = false
  showForm.value = true
}

// Handle form save
async function handleSave(data: Omit<PersonaConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    if (isNewPersona.value) {
      await aiSettings.addPersona(data)
    } else if (editingPersona.value) {
      await aiSettings.updatePersona(editingPersona.value.id, data)
    }

    showForm.value = false
    editingPersona.value = null
  } catch (e) {
    console.error('Failed to save persona:', e)
  }
}

// Cancel form
function handleCancel() {
  showForm.value = false
  editingPersona.value = null
}

// Delete persona
async function handleDelete(persona: PersonaConfig) {
  if (aiSettings.personas.value.length <= 1) {
    alert('You must have at least one persona.')
    return
  }

  if (!confirm(`Delete "${persona.name}"?`)) {
    return
  }

  await aiSettings.deletePersona(persona.id)
}

// Set default persona
async function handleSetDefault(persona: PersonaConfig) {
  await aiSettings.setDefaultPersona(persona.id)
}
</script>

<template>
  <div class="personas-section">
    <!-- Form View -->
    <template v-if="showForm">
      <SettingsPersonasPersonaForm
        :persona="editingPersona || undefined"
        :is-new="isNewPersona"
        @save="handleSave"
        @cancel="handleCancel"
      />
    </template>

    <!-- List View -->
    <template v-else>
      <!-- Header -->
      <div class="section-header">
        <div class="header-info">
          <h3 class="section-title">AI Personas</h3>
          <p class="section-desc">Create custom AI personalities with specific behaviors and parameters</p>
        </div>
        <NcButton variant="primary" size="sm" @click="addNewPersona">
          <span class="i-lucide-plus" />
          Add Persona
        </NcButton>
      </div>

      <!-- Loading -->
      <div v-if="aiSettings.isLoading.value" class="loading-state">
        <span class="i-lucide-loader-2 loading-icon" />
        Loading personas...
      </div>

      <!-- Personas List -->
      <div v-else class="personas-grid">
        <SettingsPersonasPersonaCard
          v-for="persona in aiSettings.personas.value"
          :key="persona.id"
          :persona="persona"
          @edit="editPersona(persona)"
          @delete="handleDelete(persona)"
          @set-default="handleSetDefault(persona)"
        />
      </div>

      <!-- Info Box -->
      <div class="info-box">
        <span class="i-lucide-lightbulb info-icon" />
        <div class="info-content">
          <p class="info-title">What are Personas?</p>
          <p class="info-text">
            Personas define how the AI assistant behaves. The system prompt sets the AI's personality, role, and instructions. Parameters like temperature control creativity.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.personas-section {
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

.personas-grid {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.info-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 12px;
}

.info-icon {
  font-size: 1.125rem;
  color: #8B5CF6;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.info-content {
  flex: 1;
}

.info-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
  margin: 0 0 0.375rem;
}

.info-text {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
  line-height: 1.5;
}
</style>
