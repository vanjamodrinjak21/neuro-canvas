<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { useAISettings } from '~/composables/useAISettings'

definePageMeta({
  layout: false,
  middleware: 'auth'
})

useHead({
  title: 'Settings - NeuroCanvas'
})

const router = useRouter()
const userStore = useUserStore()
const settingsOverlayRef = ref<HTMLDivElement | null>(null)
const settingsThemeAnimating = ref(false)

function settingsThemeReveal(btn: HTMLElement, callback: () => void) {
  if (settingsThemeAnimating.value) return
  settingsThemeAnimating.value = true

  if (!btn || typeof window === 'undefined') {
    callback()
    settingsThemeAnimating.value = false
    return
  }

  const rect = btn.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const maxX = Math.max(cx, window.innerWidth - cx)
  const maxY = Math.max(cy, window.innerHeight - cy)
  const maxRadius = Math.ceil(Math.sqrt(maxX * maxX + maxY * maxY))

  const overlay = settingsOverlayRef.value
  if (!overlay) {
    callback()
    settingsThemeAnimating.value = false
    return
  }

  overlay.style.clipPath = `circle(0px at ${cx}px ${cy}px)`
  overlay.style.display = 'block'
  overlay.style.opacity = '1'

  overlay.offsetHeight

  overlay.style.transition = 'clip-path 500ms cubic-bezier(0.16, 1, 0.3, 1)'
  overlay.style.clipPath = `circle(${maxRadius}px at ${cx}px ${cy}px)`

  setTimeout(() => {
    callback()
    setTimeout(() => {
      overlay.style.transition = 'opacity 300ms ease'
      overlay.style.opacity = '0'
      setTimeout(() => {
        overlay.style.display = 'none'
        overlay.style.transition = ''
        overlay.style.clipPath = ''
        settingsThemeAnimating.value = false
      }, 300)
    }, 60)
  }, 480)
}
const aiSettings = useAISettings()

// Auth
const { data: _sessionData } = useAuth()
const session = _sessionData ?? ref(null)
const { handleSignOut: authSignOut, isLoading: signOutLoading } = useAuthStore()

const user = computed(() => session.value?.user)
const userInitial = computed(() => {
  const name = user.value?.name
  return name ? name.charAt(0).toUpperCase() : 'U'
})

// ─── Save Indicator ───────────────────────────────────────────────
const saveStatus = ref<'idle' | 'saved'>('idle')
let saveTimer: ReturnType<typeof setTimeout> | null = null

function flashSaved() {
  saveStatus.value = 'saved'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { saveStatus.value = 'idle' }, 2000)
}

// Provide flash function so child components can trigger it
provide('flashSaved', flashSaved)

// Watch preference changes to flash "Saved"
watch(() => userStore.preferences.value, () => {
  flashSaved()
}, { deep: true })

onMounted(async () => {
  await aiSettings.initialize()
  await loadProviderKeyStatus()
})

// ─── Desktop: Tabs ────────────────────────────────────────────────
const activeTab = ref('general')
const tabs = [
  { id: 'general', label: 'General' },
  { id: 'ai-providers', label: 'AI Providers' },
  { id: 'personal', label: 'Personal' },
  { id: 'account', label: 'Account' }
]

// ─── General Tab ──────────────────────────────────────────────────
const themeOptions = [
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' }
]

const fontSizeOptions = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
]

// ─── AI Providers Tab ─────────────────────────────────────────────
const aiEngines = ['OpenAI', 'Claude', 'Ollama'] as const
type AIEngine = typeof aiEngines[number]

const selectedEngine = ref<AIEngine>('OpenAI')
const ollamaEnabled = ref(false)
const ollamaEndpoint = ref('http://localhost:11434')

// API key inputs
const openaiKey = ref('')
const anthropicKey = ref('')
const showOpenaiKey = ref(false)
const showAnthropicKey = ref(false)

// Provider key status for display
const providerKeyStatus = ref<Map<string, boolean>>(new Map())

async function loadProviderKeyStatus() {
  for (const provider of aiSettings.providers.value) {
    const hasKey = await aiSettings.hasProviderApiKey(provider.id)
    providerKeyStatus.value.set(provider.id, hasKey)
  }

  // Detect which engine is the default
  const defaultProvider = aiSettings.providers.value.find(p => p.isDefault)
  if (defaultProvider) {
    if (defaultProvider.type === 'openai') selectedEngine.value = 'OpenAI'
    else if (defaultProvider.type === 'anthropic') selectedEngine.value = 'Claude'
    else if (defaultProvider.type === 'ollama') selectedEngine.value = 'Ollama'
  }

  // Detect Ollama state
  const ollamaProvider = aiSettings.providers.value.find(p => p.type === 'ollama')
  if (ollamaProvider) {
    ollamaEnabled.value = ollamaProvider.isEnabled
    ollamaEndpoint.value = ollamaProvider.baseUrl || 'http://localhost:11434'
  }

  // Load masked key status
  for (const provider of aiSettings.providers.value) {
    if (provider.type === 'openai' && providerKeyStatus.value.get(provider.id)) {
      openaiKey.value = KEY_MASK
    }
    if (provider.type === 'anthropic' && providerKeyStatus.value.get(provider.id)) {
      anthropicKey.value = KEY_MASK
    }
  }
}

watch(() => aiSettings.providers.value, loadProviderKeyStatus)

// Find or create provider by type
function findProviderByType(type: string) {
  return aiSettings.providers.value.find(p => p.type === type)
}

// Select engine
async function selectEngine(engine: AIEngine) {
  selectedEngine.value = engine
  const typeMap: Record<AIEngine, string> = {
    'OpenAI': 'openai',
    'Claude': 'anthropic',
    'Ollama': 'ollama'
  }
  const providerType = typeMap[engine]
  const provider = findProviderByType(providerType)

  if (provider) {
    await aiSettings.setDefaultProvider(provider.id)
  } else {
    // Auto-create provider
    await aiSettings.addProvider(providerType as any, engine)
    const newProvider = aiSettings.providers.value.find(p => p.type === providerType)
    if (newProvider) {
      await aiSettings.setDefaultProvider(newProvider.id)
    }
  }
  flashSaved()
}

// Get model options for selected engine
const availableModels = computed(() => {
  const typeMap: Record<AIEngine, string> = {
    'OpenAI': 'openai',
    'Claude': 'anthropic',
    'Ollama': 'ollama'
  }
  const provider = findProviderByType(typeMap[selectedEngine.value])
  return provider?.models || []
})

const selectedModelId = computed(() => {
  const typeMap: Record<AIEngine, string> = {
    'OpenAI': 'openai',
    'Claude': 'anthropic',
    'Ollama': 'ollama'
  }
  const provider = findProviderByType(typeMap[selectedEngine.value])
  return provider?.selectedModelId || ''
})

async function selectModel(modelId: string) {
  const typeMap: Record<AIEngine, string> = {
    'OpenAI': 'openai',
    'Claude': 'anthropic',
    'Ollama': 'ollama'
  }
  const provider = findProviderByType(typeMap[selectedEngine.value])
  if (provider) {
    await aiSettings.updateProvider(provider.id, { selectedModelId: modelId })
  }
}

const KEY_MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'

function clearKeyOnFocus(type: 'openai' | 'anthropic') {
  if (type === 'openai' && openaiKey.value === KEY_MASK) openaiKey.value = ''
  if (type === 'anthropic' && anthropicKey.value === KEY_MASK) anthropicKey.value = ''
}

// Save API key
const keySaving = ref<string | null>(null)
const keySaveSuccess = ref<string | null>(null)

async function saveApiKey(type: 'openai' | 'anthropic') {
  const key = type === 'openai' ? openaiKey.value : anthropicKey.value
  if (!key || key === '••••••••••••••••') return

  keySaving.value = type
  try {
    let provider = findProviderByType(type)
    if (!provider) {
      const name = type === 'openai' ? 'OpenAI' : 'Claude'
      await aiSettings.addProvider(type, name)
      provider = aiSettings.providers.value.find(p => p.type === type)
    }
    if (provider) {
      await aiSettings.updateProviderApiKey(provider.id, key)
      providerKeyStatus.value.set(provider.id, true)
      // Mask the key after saving
      if (type === 'openai') openaiKey.value = KEY_MASK
      else anthropicKey.value = KEY_MASK
      keySaveSuccess.value = type
      flashSaved()
      setTimeout(() => { keySaveSuccess.value = null }, 2000)
    }
  } catch {
    // Key save failed — don't log error details (may contain key material)
  } finally {
    keySaving.value = null
  }
}

// Toggle Ollama
async function toggleOllama() {
  ollamaEnabled.value = !ollamaEnabled.value
  let provider = findProviderByType('ollama')
  if (!provider && ollamaEnabled.value) {
    await aiSettings.addProvider('ollama', 'Ollama', undefined, ollamaEndpoint.value)
    provider = aiSettings.providers.value.find(p => p.type === 'ollama')
  }
  if (provider) {
    await aiSettings.updateProvider(provider.id, { isEnabled: ollamaEnabled.value })
  }
}

async function updateOllamaEndpoint() {
  // Validate URL scheme — only http/https allowed (blocks javascript:, data:, file:)
  try {
    const parsed = new URL(ollamaEndpoint.value)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      ollamaEndpoint.value = 'http://localhost:11434'
      return
    }
  } catch {
    ollamaEndpoint.value = 'http://localhost:11434'
    return
  }

  const provider = findProviderByType('ollama')
  if (provider) {
    await aiSettings.updateProvider(provider.id, { baseUrl: ollamaEndpoint.value })
  }
}

// ─── Mobile ───────────────────────────────────────────────────────
const themeLabel = computed(() => {
  const map: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }
  return map[userStore.preferences.value.theme] || 'Dark'
})

const fontSizeLabel = computed(() => {
  const map: Record<string, string> = { small: 'Small', medium: 'Medium', large: 'Large' }
  return map[userStore.preferences.value.fontSize] || 'Medium'
})

function cycleTheme(e: MouseEvent) {
  const order = ['light', 'dark', 'system'] as const
  const current = userStore.preferences.value.theme
  const idx = order.indexOf(current as typeof order[number])
  const next = order[(idx + 1) % order.length]
  settingsThemeReveal(e.currentTarget as HTMLElement, () => {
    userStore.setPreference('theme', next as any)
  })
}

function cycleFontSize() {
  const order = ['small', 'medium', 'large'] as const
  const current = userStore.preferences.value.fontSize
  const idx = order.indexOf(current as typeof order[number])
  const next = order[(idx + 1) % order.length]
  userStore.setPreference('fontSize', next as any)
}

async function handleMobileSignOut() {
  await aiSettings.clearAllSecrets()
  await authSignOut()
}

function handleOpenTemplates() {
  router.push('/dashboard')
}

function handleAccountClose() {
  router.push('/')
}
</script>

<template>
  <div class="settings-page">
    <!-- ═══ MOBILE SETTINGS (≤768px) ═══ -->
    <div class="m-settings">
      <div class="m-scroll">
        <div class="m-header">
          <h1 class="m-title">Settings</h1>
        </div>

        <div class="m-account">
          <div class="m-avatar">
            <img
              v-if="user?.image"
              :src="user.image"
              :alt="user?.name || 'Profile'"
              class="m-avatar-img"
            >
            <span v-else class="m-avatar-letter">{{ userInitial }}</span>
          </div>
          <div class="m-account-info">
            <span class="m-account-name">{{ user?.name || 'User' }}</span>
            <span class="m-account-email">{{ user?.email || '' }}</span>
          </div>
          <span class="m-chevron i-lucide-chevron-right" />
        </div>

        <div class="m-label">Preferences</div>
        <div class="m-group">
          <button class="m-row" @click="cycleTheme($event)">
            <div class="m-row-left">
              <span class="m-row-icon i-lucide-moon" />
              <span class="m-row-text">Theme</span>
            </div>
            <div class="m-row-right">
              <span class="m-row-value">{{ themeLabel }}</span>
              <span class="m-row-chevron i-lucide-chevron-right" />
            </div>
          </button>

          <button class="m-row" @click="cycleFontSize">
            <div class="m-row-left">
              <span class="m-row-icon i-lucide-type" />
              <span class="m-row-text">Font Size</span>
            </div>
            <div class="m-row-right">
              <span class="m-row-value">{{ fontSizeLabel }}</span>
              <span class="m-row-chevron i-lucide-chevron-right" />
            </div>
          </button>

          <div class="m-row m-row--last">
            <div class="m-row-left">
              <span class="m-row-icon i-lucide-save" />
              <span class="m-row-text">Auto-save</span>
            </div>
            <button
              class="m-toggle"
              :class="{ on: userStore.preferences.value.autoSave }"
              @click="userStore.setPreference('autoSave', !userStore.preferences.value.autoSave)"
            >
              <span class="m-toggle-knob" />
            </button>
          </div>
        </div>

        <div class="m-label">AI Providers</div>
        <div class="m-group">
          <template v-if="aiSettings.providers.value.length > 0">
            <div
              v-for="(provider, idx) in aiSettings.providers.value"
              :key="provider.id"
              :class="['m-row', { 'm-row--last': idx === aiSettings.providers.value.length - 1 }]"
            >
              <div class="m-row-left">
                <span class="m-row-icon i-lucide-lock" />
                <span class="m-row-text">{{ provider.name }}</span>
              </div>
              <div v-if="providerKeyStatus.get(provider.id)" class="m-row-right m-connected">
                <span class="m-dot" />
                <span class="m-connected-text">Connected</span>
              </div>
              <div v-else class="m-row-right">
                <span class="m-row-value">Add key</span>
                <span class="m-row-chevron i-lucide-chevron-right" />
              </div>
            </div>
          </template>
          <div v-else class="m-row m-row--last m-empty-providers">
            <span class="m-empty-text">No providers configured</span>
          </div>
        </div>

        <button
          class="m-signout"
          :disabled="signOutLoading"
          @click="handleMobileSignOut"
        >
          {{ signOutLoading ? 'Signing out...' : 'Sign Out' }}
        </button>
      </div>
    </div>

    <!-- ═══ DESKTOP SETTINGS (>768px) ═══ -->
    <div class="settings-layout">
      <AppSidebar
        active-nav="settings"
        @open-templates="handleOpenTemplates"
      />

      <main class="settings-main">
        <div class="settings-header">
          <div class="settings-title-row">
            <h1 class="settings-title">Settings</h1>
            <Transition name="nc-fade">
              <span v-if="saveStatus === 'saved'" class="save-badge">
                <span class="save-badge-icon i-lucide-check" />
                Saved
              </span>
            </Transition>
          </div>
          <p class="settings-subtitle">Manage your preferences and account</p>
        </div>

        <div class="settings-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-item', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <Transition name="nc-crossfade" mode="out-in">
          <!-- ═══ GENERAL TAB ═══ -->
          <div v-if="activeTab === 'general'" key="general" class="tab-content">
            <div class="settings-section">
              <span class="section-label">Appearance</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Theme</span>
                  <span class="setting-desc">Choose your preferred appearance</span>
                </div>
                <div class="segmented-control">
                  <button
                    v-for="option in themeOptions"
                    :key="option.value"
                    :class="['segment', { active: userStore.preferences.value.theme === option.value }]"
                    @click="settingsThemeReveal($event.currentTarget as HTMLElement, () => userStore.setPreference('theme', option.value as any))"
                  >
                    <span :class="['segment-icon', option.icon]" />
                    <span class="segment-label">{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Font Size</span>
                  <span class="setting-desc">Adjust text size across the app</span>
                </div>
                <div class="segmented-control">
                  <button
                    v-for="option in fontSizeOptions"
                    :key="option.value"
                    :class="['segment', { active: userStore.preferences.value.fontSize === option.value }]"
                    @click="userStore.setPreference('fontSize', option.value as any)"
                  >
                    <span class="segment-label">{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Reduced Motion</span>
                  <span class="setting-desc">Minimize animations for accessibility</span>
                </div>
                <button
                  :class="['toggle-switch', { on: userStore.preferences.value.reducedMotion }]"
                  @click="userStore.setPreference('reducedMotion', !userStore.preferences.value.reducedMotion)"
                >
                  <span class="toggle-knob" />
                </button>
              </div>
            </div>

            <div class="settings-section">
              <span class="section-label">Canvas</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Show Grid</span>
                  <span class="setting-desc">Display background grid on canvas</span>
                </div>
                <button
                  :class="['toggle-switch', { on: userStore.preferences.value.showGrid }]"
                  @click="userStore.setPreference('showGrid', !userStore.preferences.value.showGrid)"
                >
                  <span class="toggle-knob" />
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Show Minimap</span>
                  <span class="setting-desc">Display navigation minimap</span>
                </div>
                <button
                  :class="['toggle-switch', { on: userStore.preferences.value.showMinimap }]"
                  @click="userStore.setPreference('showMinimap', !userStore.preferences.value.showMinimap)"
                >
                  <span class="toggle-knob" />
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Auto-save</span>
                  <span class="setting-desc">Automatically save your work every {{ userStore.preferences.value.autoSaveInterval / 1000 }}s</span>
                </div>
                <button
                  :class="['toggle-switch', { on: userStore.preferences.value.autoSave }]"
                  @click="userStore.setPreference('autoSave', !userStore.preferences.value.autoSave)"
                >
                  <span class="toggle-knob" />
                </button>
              </div>
            </div>
          </div>

          <!-- ═══ AI PROVIDERS TAB ═══ -->
          <div v-else-if="activeTab === 'ai-providers'" key="ai-providers" class="tab-content">
            <div class="settings-section">
              <span class="section-label">Default Provider</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">AI Engine</span>
                  <span class="setting-desc">Select which AI provider to use for suggestions and expansion</span>
                </div>
                <div class="segmented-control">
                  <button
                    v-for="engine in aiEngines"
                    :key="engine"
                    :class="['segment', { active: selectedEngine === engine }]"
                    @click="selectEngine(engine)"
                  >
                    <span class="segment-label">{{ engine }}</span>
                  </button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Model</span>
                  <span class="setting-desc">Choose the model for AI-powered features</span>
                </div>
                <select
                  :value="selectedModelId"
                  class="setting-select"
                  @change="selectModel(($event.target as HTMLSelectElement).value)"
                >
                  <option v-if="availableModels.length === 0" value="" disabled>No models available</option>
                  <option
                    v-for="model in availableModels"
                    :key="model.id"
                    :value="model.id"
                  >
                    {{ model.name || model.id }}
                  </option>
                </select>
              </div>
            </div>

            <div class="settings-section">
              <span class="section-label">API Keys</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">OpenAI API Key</span>
                  <span class="setting-desc">Required for GPT-4o and GPT-4o-mini models</span>
                </div>
                <div class="key-input-group">
                  <input
                    v-model="openaiKey"
                    :type="showOpenaiKey ? 'text' : 'password'"
                    class="key-input"
                    placeholder="Enter API key..."
                    autocomplete="off"
                    @focus="clearKeyOnFocus('openai')"
                    @blur="saveApiKey('openai')"
                  >
                  <button
                    class="key-toggle"
                    @click="showOpenaiKey = !showOpenaiKey"
                  >
                    <span :class="showOpenaiKey ? 'i-lucide-eye-off' : 'i-lucide-eye'" />
                  </button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Anthropic API Key</span>
                  <span class="setting-desc">Required for Claude Sonnet and Haiku models</span>
                </div>
                <div class="key-input-group">
                  <input
                    v-model="anthropicKey"
                    :type="showAnthropicKey ? 'text' : 'password'"
                    class="key-input"
                    placeholder="Enter API key..."
                    autocomplete="off"
                    @focus="clearKeyOnFocus('anthropic')"
                    @blur="saveApiKey('anthropic')"
                  >
                  <button
                    class="key-toggle"
                    @click="showAnthropicKey = !showAnthropicKey"
                  >
                    <span :class="showAnthropicKey ? 'i-lucide-eye-off' : 'i-lucide-eye'" />
                  </button>
                </div>
              </div>
            </div>

            <div class="settings-section">
              <span class="section-label">Local Models</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Ollama Integration</span>
                  <span class="setting-desc">Connect to a local Ollama instance for privacy-first AI</span>
                </div>
                <button
                  :class="['toggle-switch', { on: ollamaEnabled }]"
                  @click="toggleOllama"
                >
                  <span class="toggle-knob" />
                </button>
              </div>

              <div v-if="ollamaEnabled" class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">Ollama Endpoint</span>
                  <span class="setting-desc">URL for your local Ollama server</span>
                </div>
                <input
                  v-model="ollamaEndpoint"
                  type="url"
                  class="setting-url-input"
                  placeholder="http://localhost:11434"
                  @blur="updateOllamaEndpoint"
                >
              </div>
            </div>
          </div>

          <!-- ═══ PERSONAL TAB ═══ -->
          <div v-else-if="activeTab === 'personal'" key="personal" class="tab-content">
            <SettingsSectionsPersonalSection />
          </div>

          <!-- ═══ ACCOUNT TAB ═══ -->
          <div v-else-if="activeTab === 'account'" key="account" class="tab-content">
            <SettingsSectionsAccountSection @close="handleAccountClose" />
          </div>
        </Transition>
      </main>
    </div>

    <MobileTabBar />

    <!-- Theme swipe overlay -->
    <Teleport to="body">
      <div ref="settingsOverlayRef" class="settings-swipe-overlay" />
    </Teleport>
  </div>
</template>

<style scoped>
.settings-swipe-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: #00D2BE;
  z-index: 9999;
  pointer-events: none;
}
/* ═══════════════════════════════════════════════════════════════════
   MOBILE SETTINGS
   ═══════════════════════════════════════════════════════════════════ */

.settings-page {
  min-height: 100vh;
  min-height: 100dvh;
}

.m-settings {
  display: none;
}

@media (max-width: 768px) {
  .m-settings {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--ms-bg);
  }

  .settings-layout {
    display: none !important;
  }
}

.m-settings {
  --ms-bg: #0A0A0C;
  --ms-card: #111114;
  --ms-border: #1E1E22;
  --ms-text: #FAFAFA;
  --ms-muted: #888890;
  --ms-accent: #00D2BE;
  --ms-green: #4ADE80;
  --ms-red: #EF4444;
  --ms-toggle-off: #1E1E22;
  --ms-knob-off: #555560;
}

:root.light .m-settings {
  --ms-bg: #FAFAF9;
  --ms-card: #FFFFFF;
  --ms-border: #E8E8E6;
  --ms-text: #1A1A1A;
  --ms-muted: #666666;
  --ms-toggle-off: #D4D4D8;
  --ms-knob-off: #888890;
}

.m-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-top: 48px;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 100px);
}

.m-header { padding: 8px 24px 24px; }

.m-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 30px;
  color: var(--ms-text);
  margin: 0;
}

.m-account {
  display: flex;
  align-items: center;
  margin: 0 24px 24px;
  padding: 16px;
  gap: 14px;
  border-radius: 10px;
  background: var(--ms-card);
  border: 1px solid var(--ms-border);
}

.m-avatar {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: rgba(0, 210, 190, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.m-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.m-avatar-letter {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ms-accent);
}

.m-account-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.m-account-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ms-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-account-email {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  color: var(--ms-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-chevron { width: 16px; height: 16px; color: var(--ms-muted); flex-shrink: 0; }

.m-label {
  padding: 0 24px;
  margin-bottom: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 16px;
  color: var(--ms-muted);
}

.m-group {
  margin: 0 24px 24px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--ms-card);
  border: 1px solid var(--ms-border);
}

.m-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 16px;
  border-bottom: 1px solid var(--ms-border);
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  width: 100%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

button.m-row { text-align: left; }
.m-row--last { border-bottom: none; }

.m-row-left { display: flex; align-items: center; gap: 12px; }
.m-row-icon { width: 18px; height: 18px; color: var(--ms-muted); flex-shrink: 0; }

.m-row-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ms-text);
}

.m-row-right { display: flex; align-items: center; gap: 4px; }

.m-row-value {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ms-muted);
}

.m-row-chevron { width: 14px; height: 14px; color: var(--ms-muted); flex-shrink: 0; }

.m-toggle {
  width: 44px;
  height: 26px;
  border-radius: 13px;
  border: none;
  padding: 2px;
  display: flex;
  align-items: center;
  background: var(--ms-toggle-off);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.m-toggle.on { background: var(--ms-accent); justify-content: flex-end; }

.m-toggle-knob {
  width: 22px;
  height: 22px;
  border-radius: 11px;
  background: var(--ms-knob-off);
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.m-toggle.on .m-toggle-knob { background: #FAFAFA; }

.m-connected { gap: 6px; }
.m-dot { width: 6px; height: 6px; border-radius: 3px; background: var(--ms-green); flex-shrink: 0; }

.m-connected-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  color: var(--ms-green);
}

.m-empty-providers { justify-content: center; cursor: default; }

.m-empty-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--ms-muted);
}

.m-signout {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 8px 24px 0;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 18px;
  color: var(--ms-red);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease;
}

.m-signout:active { background: rgba(239, 68, 68, 0.08); }
.m-signout:disabled { opacity: 0.6; cursor: not-allowed; }

/* ═══════════════════════════════════════════════════════════════════
   DESKTOP SETTINGS
   ═══════════════════════════════════════════════════════════════════ */

.settings-layout {
  display: flex;
  min-height: 100vh;
  background: var(--s-bg, #09090B);
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 48px;
  gap: 32px;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #22C55E;
  line-height: 16px;
}

.save-badge-icon {
  font-size: 12px;
}

.nc-fade-enter-active { transition: opacity 0.15s ease; }
.nc-fade-leave-active { transition: opacity 0.4s ease; }
.nc-fade-enter-from,
.nc-fade-leave-to { opacity: 0; }

.settings-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 34px;
  color: var(--s-text, #FAFAFA);
}

.settings-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 18px;
  color: var(--s-muted, #555560);
}

/* Tabs */
.settings-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--s-border, #1A1A1E);
}

.tab-item {
  padding: 12px 20px;
  min-height: 44px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  color: var(--s-tab-text, #555560);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab-item:hover { color: var(--s-text, #FAFAFA); }

.tab-item.active {
  color: var(--s-text, #FAFAFA);
  border-bottom-color: var(--s-accent, #00D2BE);
}

/* Tab Content */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* Section */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 16px;
  color: var(--s-accent, #00D2BE);
  padding-bottom: 4px;
}

/* Setting Row */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--s-surface, #0D0D10);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 8px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  color: var(--s-text, #FAFAFA);
}

.setting-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  color: var(--s-muted, #555560);
}

/* Segmented Control */
.segmented-control {
  display: flex;
  border-radius: 6px;
  padding: 3px;
  gap: 4px;
  background: var(--s-seg-bg, #151518);
}

.segment {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  min-height: 36px;
  border-radius: 4px;
  border: none;
  background: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.segment.active { background: var(--s-seg-active, #09090B); }

.segment-icon {
  font-size: 14px;
  color: var(--s-muted, #555560);
  flex-shrink: 0;
}

.segment.active .segment-icon { color: var(--s-text, #FAFAFA); }

.segment-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  color: var(--s-muted, #555560);
}

.segment.active .segment-label {
  font-weight: 500;
  color: var(--s-text, #FAFAFA);
}

/* Toggle Switch */
.toggle-switch {
  width: 44px;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 12px;
  border: none;
  background: var(--s-toggle-off, #1A1A1E);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s, justify-content 0.2s;
}

.toggle-switch.on {
  background: var(--s-accent, #00D2BE);
  justify-content: flex-end;
}

.toggle-knob {
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--s-knob-off, #555560);
  flex-shrink: 0;
  transition: background 0.2s;
}

.toggle-switch.on .toggle-knob { background: var(--s-knob-on, #FAFAFA); }

/* Select (model dropdown) */
.setting-select {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--s-text, #FAFAFA);
  background: var(--s-surface, #0D0D10);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 8px 32px 8px 12px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23555560' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color 0.15s;
}

.setting-select:focus { border-color: var(--s-accent, #00D2BE); }

/* API Key Input */
.key-input-group {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.15s;
}

.key-input-group:focus-within {
  border-color: var(--s-accent, #00D2BE);
}

.key-input {
  width: 200px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--s-text, #FAFAFA);
  background: var(--s-surface, #0D0D10);
  border: none;
  padding: 8px 12px;
  outline: none;
}

.key-input::placeholder { color: var(--s-muted, #555560); }

.key-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  border-left: 1px solid var(--s-border, #1A1A1E);
  color: var(--s-muted, #555560);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;
}

.key-toggle:hover { color: var(--s-text, #FAFAFA); }

/* URL Input */
.setting-url-input {
  width: 220px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--s-text, #FAFAFA);
  background: var(--s-surface, #0D0D10);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.setting-url-input:focus { border-color: var(--s-accent, #00D2BE); }

/* Light theme */
:root.light .settings-layout {
  --s-bg: #FAFAF9;
  --s-surface: #FFFFFF;
  --s-border: #E8E8E6;
  --s-text: #111111;
  --s-muted: #777777;
  --s-tab-text: #777777;
  --s-accent: #00D2BE;
  --s-seg-bg: #E8E8E6;
  --s-seg-active: #FFFFFF;
  --s-toggle-off: #D4D4D8;
  --s-knob-off: #777777;
  --s-knob-on: #FFFFFF;
}

:root.light .key-input,
:root.light .setting-url-input,
:root.light .setting-select {
  background: #FFFFFF;
  color: #111111;
}
</style>
