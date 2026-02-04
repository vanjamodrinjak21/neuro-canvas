<script setup lang="ts">
import { useAISettings } from '~/composables/useAISettings'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const aiSettings = useAISettings()

// Initialize AI settings when modal opens
watch(() => props.open, async (open) => {
  if (open && !aiSettings.isInitialized.value) {
    await aiSettings.initialize()
  }
})

// Tab configuration
const activeTab = ref('account')
const tabs = [
  { value: 'account', label: 'Account', icon: 'i-lucide-user' },
  { value: 'providers', label: 'AI Providers', icon: 'i-lucide-cpu' },
  { value: 'personas', label: 'Personas', icon: 'i-lucide-bot' },
  { value: 'preferences', label: 'Preferences', icon: 'i-lucide-settings' }
]

function close() {
  emit('update:open', false)
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <div class="settings-header">
              <div class="settings-icon">
                <span class="i-lucide-settings" />
              </div>
              <div class="settings-title-wrap">
                <h2 class="settings-title">Settings</h2>
                <p class="settings-subtitle">Manage your account and AI providers</p>
              </div>
            </div>
            <button class="close-btn" @click="close">
              <span class="i-lucide-x" />
            </button>
          </div>

          <!-- Content -->
          <div class="settings-content">
            <!-- Tabs Navigation -->
            <div class="settings-tabs">
              <button
                v-for="tab in tabs"
                :key="tab.value"
                :class="['tab-item', { active: activeTab === tab.value }]"
                @click="activeTab = tab.value"
              >
                <span :class="[tab.icon, 'tab-icon']" />
                <span class="tab-label">{{ tab.label }}</span>
              </button>
            </div>

            <!-- Tab Content -->
            <div class="settings-panel">
              <KeepAlive>
                <SettingsSectionsAccountSection
                  v-if="activeTab === 'account'"
                  @close="close"
                />
                <SettingsSectionsAIProvidersSection
                  v-else-if="activeTab === 'providers'"
                />
                <SettingsSectionsPersonasSection
                  v-else-if="activeTab === 'personas'"
                />
                <SettingsSectionsPreferencesSection
                  v-else-if="activeTab === 'preferences'"
                />
              </KeepAlive>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
}

.modal-container {
  position: relative;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0, 210, 190, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--nc-border, #252529);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.settings-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--nc-teal, #00D2BE), rgba(0, 210, 190, 0.6));
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--nc-charcoal, #06060A);
  box-shadow: 0 4px 20px rgba(0, 210, 190, 0.3);
}

.settings-title-wrap {
  flex: 1;
}

.settings-title {
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
  color: var(--nc-ink, #FAFAFA);
}

.settings-subtitle {
  font-size: 0.875rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.25rem 0 0;
}

.close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  color: var(--nc-ink-muted, #A1A1AA);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--nc-surface-2, #121216);
  color: var(--nc-ink, #FAFAFA);
  border-color: var(--nc-teal, #00D2BE);
}

.settings-content {
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  min-height: 400px;
  max-height: calc(90vh - 100px);
}

.settings-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 180px;
  flex-shrink: 0;
  padding: 0.5rem;
  background: var(--nc-surface-2, #121216);
  border-radius: 12px;
  border: 1px solid var(--nc-border, #252529);
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--nc-ink-muted, #A1A1AA);
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.tab-item:hover {
  background: var(--nc-surface-3, #18181D);
  color: var(--nc-ink, #FAFAFA);
}

.tab-item.active {
  background: var(--nc-teal, #00D2BE);
  color: var(--nc-charcoal, #06060A);
  box-shadow: 0 2px 12px rgba(0, 210, 190, 0.3);
}

.tab-icon {
  font-size: 1.125rem;
}

.tab-label {
  white-space: nowrap;
}

.settings-panel {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 0.5rem;
}

/* Custom scrollbar for panel */
.settings-panel::-webkit-scrollbar {
  width: 6px;
}

.settings-panel::-webkit-scrollbar-track {
  background: transparent;
}

.settings-panel::-webkit-scrollbar-thumb {
  background: var(--nc-border, #252529);
  border-radius: 3px;
}

.settings-panel::-webkit-scrollbar-thumb:hover {
  background: var(--nc-teal, #00D2BE);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

/* Responsive */
@media (max-width: 640px) {
  .modal-container {
    width: 95%;
    max-height: 95vh;
  }

  .settings-content {
    flex-direction: column;
    padding: 1rem;
  }

  .settings-tabs {
    flex-direction: row;
    width: 100%;
    overflow-x: auto;
    padding: 0.25rem;
  }

  .tab-item {
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    min-width: fit-content;
  }

  .tab-icon {
    font-size: 1rem;
  }
}
</style>
