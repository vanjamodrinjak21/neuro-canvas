<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { useAISettings } from '~/composables/useAISettings'
import { PROVIDER_TEMPLATES } from '~/types/ai-settings'
import { useThemeReveal } from '~/composables/useThemeReveal'
import { getUserInitials } from '~/utils/userDisplay'

const { t, locale, setLocale, locales: i18nLocales } = useI18n()

definePageMeta({
  layout: false,
  middleware: 'auth'
})

useHead({
  title: () => `${t('settings.page.title')} - NeuroCanvas`
})

const router = useRouter()
const userStore = useUserStore()
const { overlayRef: settingsOverlayRef, reveal: settingsThemeReveal } = useThemeReveal()
const aiSettings = useAISettings()

// Auth
const { data: _sessionData } = useAuth()
const session = _sessionData ?? ref(null)
const { handleSignOut: authSignOut, isLoading: signOutLoading } = useAuthStore()

// Mobile auth (Capacitor)
const mobileAuth = useMobileAuth()
const isMobileSignedIn = mobileAuth.isSignedIn

const user = computed(() => {
  // On Capacitor: prefer mobile auth user if signed in
  if (platformRef.isCapacitor.value && mobileAuth.isSignedIn.value && mobileAuth.user.value) {
    return mobileAuth.user.value
  }
  return session.value?.user
})

const isLocalUser = computed(() => {
  return user.value?.email === 'local@device' || !user.value?.email
})

const userInitial = computed(() => getUserInitials(user.value?.name, 'U'))

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
const tabs = computed(() => [
  { id: 'general', label: t('settings.tabs.general') },
  { id: 'ai-providers', label: t('settings.tabs.ai_providers') },
  { id: 'personal', label: t('settings.tabs.personal') },
  { id: 'account', label: t('settings.tabs.account') }
])

// ─── General Tab ──────────────────────────────────────────────────
const themeOptions = computed(() => [
  { value: 'light', label: t('settings.general.light'), icon: 'i-lucide-sun' },
  { value: 'dark', label: t('settings.general.dark'), icon: 'i-lucide-moon' },
  { value: 'system', label: t('settings.general.system'), icon: 'i-lucide-monitor' }
])

// Auto-check-for-updates toggle (AER-14). Backed by localStorage so it
// survives reloads without bothering the user store; `useAppUpdates` reads
// the same key to gate background polling.
const autoUpdate = useAutoUpdateToggle()
const appUpdates = useAppUpdates()
const checkingForUpdates = ref(false)
async function manualUpdateCheck() {
  if (checkingForUpdates.value) return
  checkingForUpdates.value = true
  try {
    await appUpdates.check()
  } finally {
    checkingForUpdates.value = false
  }
}

const fontSizeOptions = computed(() => [
  { value: 'xs', label: t('settings.general.xs') },
  { value: 'small', label: t('settings.general.small') },
  { value: 'medium', label: t('settings.general.medium') },
  { value: 'large', label: t('settings.general.large') },
  { value: 'xl', label: t('settings.general.xl') }
])

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
  if (!provider) return []
  // Curated providers always show the CURRENT template list. The stored
  // models array can be stale on accounts created before a model bump (the
  // store self-heal only runs on init and isn't persisted), so read the
  // template directly to guarantee the picker is up to date.
  if (provider.type === 'anthropic' || provider.type === 'openai') {
    return PROVIDER_TEMPLATES[provider.type]?.models ?? provider.models ?? []
  }
  return provider.models || []
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
    // Ignore models flagged as not yet available (e.g. not GA)
    if (provider.models.find(m => m.id === modelId)?.available === false) return
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

// ─── Mobile AI Provider key flows (used by MobileSettingsAIProvidersDark) ──
const keySavingType = ref<string | null>(null)
const keyError = ref<string | null>(null)
const keySavedTick = ref(0)

async function handleMobileSaveKey(payload: { type: string, key: string }) {
  const { type, key } = payload
  if (!key) return
  keySavingType.value = type
  keyError.value = null

  try {
    if (type === 'ollama') {
      // Ollama uses an endpoint URL, not an API key
      try {
        const parsed = new URL(key)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          keyError.value = 'Endpoint must be http:// or https://'
          return
        }
      } catch {
        keyError.value = 'Invalid URL'
        return
      }
      let provider = aiSettings.providers.value.find(p => p.type === 'ollama')
      if (!provider) {
        await aiSettings.addProvider('ollama', 'Ollama', undefined, key)
        provider = aiSettings.providers.value.find(p => p.type === 'ollama')
      }
      if (provider) {
        await aiSettings.updateProvider(provider.id, { baseUrl: key, isEnabled: true })
        ollamaEndpoint.value = key
        ollamaEnabled.value = true
        providerKeyStatus.value.set(provider.id, true)
        await aiSettings.setDefaultProvider(provider.id)
      }
      flashSaved()
      keySavedTick.value++
      return
    }

    let provider = aiSettings.providers.value.find(p => p.type === type)
    if (!provider) {
      const nameMap: Record<string, string> = {
        anthropic: 'Claude',
        openai: 'OpenAI',
        openrouter: 'OpenRouter'
      }
      await aiSettings.addProvider(type as any, nameMap[type] || type)
      provider = aiSettings.providers.value.find(p => p.type === type)
    }
    if (!provider) {
      keyError.value = 'Could not create provider'
      return
    }

    await aiSettings.updateProviderApiKey(provider.id, key)

    // Verify the key was actually persisted. On Capacitor without a fresh
    // next-auth session, the vault gate falls through and the key is dropped.
    const persisted = await aiSettings.hasProviderApiKey(provider.id)
    if (!persisted) {
      keyError.value = 'Sign in required to save keys to the vault.'
      return
    }

    // Promote the freshly-saved provider to default — otherwise the
    // auto-registered local/Ollama provider keeps the default slot and
    // AI calls hit localhost instead of the user's chosen API.
    await aiSettings.setDefaultProvider(provider.id)

    providerKeyStatus.value.set(provider.id, true)
    if (type === 'openai') openaiKey.value = KEY_MASK
    if (type === 'anthropic') anthropicKey.value = KEY_MASK
    flashSaved()
    keySavedTick.value++
  } catch (e: any) {
    keyError.value = e?.message || 'Could not save key'
  } finally {
    keySavingType.value = null
  }
}

async function handleMobileRemoveKey(type: string) {
  const provider = aiSettings.providers.value.find(p => p.type === type)
  if (!provider) return
  try {
    await aiSettings.updateProviderApiKey(provider.id, '')
    providerKeyStatus.value.set(provider.id, false)
    if (type === 'openai') openaiKey.value = ''
    if (type === 'anthropic') anthropicKey.value = ''
    flashSaved()
  } catch {
    // swallow — UI already shows the row return to "Connect"
  }
}

async function handleMobileSetModel(payload: { type: string, modelId: string }) {
  const provider = aiSettings.providers.value.find(p => p.type === payload.type)
  if (!provider) return
  await aiSettings.updateProvider(provider.id, { selectedModelId: payload.modelId })
  flashSaved()
}

async function handleMobileSetDefault(type: string) {
  const provider = aiSettings.providers.value.find(p => p.type === type)
  if (!provider) return
  await aiSettings.setDefaultProvider(provider.id)
  flashSaved()
}

async function handleMobileTestKey(type: string) {
  const provider = aiSettings.providers.value.find(p => p.type === type)
  if (!provider) return
  keySavingType.value = type
  keyError.value = null
  try {
    const result = await aiSettings.testConnection(provider.id)
    if (result.success) {
      flashSaved()
      keyError.value = null
      keyTestSuccessType.value = type
      setTimeout(() => { if (keyTestSuccessType.value === type) keyTestSuccessType.value = null }, 3000)
    } else {
      keyError.value = result.message || 'Test failed.'
    }
  } catch (e: any) {
    keyError.value = e?.message || 'Test failed — could not reach the provider.'
  } finally {
    keySavingType.value = null
  }
}

const keyTestSuccessType = ref<string | null>(null)

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

// ─── Mobile Drill-Down Navigation ─────────────────────────────────
const mobileSettingsScreen = ref<'home' | 'general' | 'ai-providers' | 'personal' | 'account' | 'signin-email'>('home')
const platformRef = usePlatform()

const connectedProvidersCount = computed(() =>
  [...providerKeyStatus.value.values()].filter(v => v).length
)

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
  const order = ['xs', 'small', 'medium', 'large', 'xl'] as const
  const current = userStore.preferences.value.fontSize
  const idx = order.indexOf(current as typeof order[number])
  const next = order[(idx + 1) % order.length]
  userStore.setPreference('fontSize', next as any)
}

// Mobile OAuth sign-in (inline in settings)
const mobileSignInEmail = ref('')
const mobileSignInPassword = ref('')
const mobileSignInLoading = ref(false)
const mobileSignInError = ref('')

async function pullAndGoToDashboard() {
  // Settings doesn't keep a syncEngine alive, so the isSignedIn watcher
  // there never fires after login. Kick off a pull in the background and
  // navigate immediately — the dashboard renders skeletons while it loads.
  try {
    const sync = useSyncEngine()
    void sync.initialize().catch(e => console.error('[Settings] post-login sync failed', e))
  } catch (e) {
    console.error('[Settings] post-login sync init failed', e)
  }
  await router.push('/dashboard')
}

async function handleMobileOAuth(provider: 'google' | 'github') {
  try {
    await mobileAuth.loginWithOAuth(provider)
    try { const { getSession } = useAuth(); await getSession({ force: true }) } catch {}
    await pullAndGoToDashboard()
  } catch {
    // Error is surfaced via mobileAuth.loginError
  }
}

async function handleMobileEmailSignIn() {
  if (!mobileSignInEmail.value || !mobileSignInPassword.value) return
  mobileSignInLoading.value = true
  mobileSignInError.value = ''
  try {
    await mobileAuth.loginWithCredentials(mobileSignInEmail.value, mobileSignInPassword.value)
    try { const { getSession } = useAuth(); await getSession({ force: true }) } catch {}
    mobileSettingsScreen.value = 'home'
    await pullAndGoToDashboard()
  } catch (e: any) {
    mobileSignInError.value = e.message || 'Sign in failed'
  } finally {
    mobileSignInLoading.value = false
  }
}

function handleMobileSettingsSignIn(provider: 'google' | 'github' | 'email') {
  if (provider === 'email') {
    mobileSettingsScreen.value = 'signin-email'
    return
  }
  void handleMobileOAuth(provider)
}

async function handleMobileSignOut() {
  await aiSettings.clearAllSecrets()
  if (platformRef.isCapacitor.value) {
    mobileAuth.signOut()
    // Refresh nuxt-auth so it picks up the local-user fallback from localStorage
    try { const { getSession } = useAuth(); await getSession({ force: true }) } catch {}
    // Reset settings screen to home and re-read user
    mobileSettingsScreen.value = 'home'
    return
  }
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
        <!-- ── Home Screen ── -->
        <template v-if="mobileSettingsScreen === 'home'">
          <MobileSettingsDark
            :user="user"
            :user-initial="userInitial"
            :is-local-user="isLocalUser"
            :connected-providers-count="connectedProvidersCount"
            :sign-out-loading="signOutLoading"
            @open-account="mobileSettingsScreen = 'account'"
            @open-general="mobileSettingsScreen = 'general'"
            @open-ai-providers="mobileSettingsScreen = 'ai-providers'"
            @open-personal="mobileSettingsScreen = 'personal'"
            @sign-out="handleMobileSignOut"
            @sign-in="handleMobileSettingsSignIn"
          />
        </template>

        <!-- ── Email Sign-In Screen (mobile native only) ── -->
        <template v-else-if="mobileSettingsScreen === 'signin-email'">
          <div class="m-subheader">
            <button class="m-back-btn" @click="mobileSettingsScreen = 'home'">
              <span class="i-lucide-arrow-left" />
            </button>
            <h2 class="m-subtitle">{{ $t('settings.signin_section.title') }}</h2>
          </div>

          <div class="m-group">
            <div class="m-row m-row--field">
              <label class="m-field-label">{{ $t('auth.signin.email_label') }}</label>
              <input v-model="mobileSignInEmail" type="email" class="m-field-input" :placeholder="$t('auth.desktop_auth.email_placeholder')" autocomplete="email">
            </div>
            <div class="m-row m-row--field m-row--last">
              <label class="m-field-label">{{ $t('auth.signin.password_label') }}</label>
              <input v-model="mobileSignInPassword" type="password" class="m-field-input" :placeholder="$t('auth.signin.password_placeholder')" autocomplete="current-password">
            </div>
          </div>

          <div v-if="mobileSignInError" class="m-signin-error">{{ mobileSignInError }}</div>

          <button
            class="m-signin-submit"
            :disabled="!mobileSignInEmail || !mobileSignInPassword || mobileSignInLoading"
            @click="handleMobileEmailSignIn"
          >
            {{ mobileSignInLoading ? $t('settings.signin_section.loading') : $t('settings.signin_section.submit') }}
          </button>
        </template>

        <!-- ── General Screen (Paper KL8-0) ── -->
        <template v-else-if="mobileSettingsScreen === 'general'">
          <MobileSettingsGeneralDark @back="mobileSettingsScreen = 'home'" />
        </template>

        <!-- ── AI Providers Screen (Paper KPL-0) ── -->
        <template v-else-if="mobileSettingsScreen === 'ai-providers'">
          <MobileSettingsAIProvidersDark
            :providers="aiSettings.providers.value"
            :provider-key-status="providerKeyStatus"
            :default-provider-type="aiSettings.defaultProvider.value?.type || null"
            :key-saving="keySavingType"
            :key-error="keyError"
            :key-saved="keySavedTick"
            :key-test-success="keyTestSuccessType"
            @back="mobileSettingsScreen = 'home'"
            @save-key="handleMobileSaveKey"
            @remove-key="handleMobileRemoveKey"
            @test-key="handleMobileTestKey"
            @set-default="handleMobileSetDefault"
            @set-model="handleMobileSetModel"
          />
        </template>

        <!-- ── Personal Screen (Paper KTB-0) ── -->
        <template v-else-if="mobileSettingsScreen === 'personal'">
          <MobileSettingsPersonalDark
            :user="user"
            :user-initial="userInitial"
            :locale="locale"
            :i18n-locales="i18nLocales as Array<{ code: string; name: string }>"
            @back="mobileSettingsScreen = 'home'"
            @set-locale="(c) => { setLocale(c); if (typeof localStorage !== 'undefined') localStorage.setItem('i18n_locale', c) }"
          />
        </template>

        <!-- ── Account Screen (Paper KXU-0) ── -->
        <template v-else-if="mobileSettingsScreen === 'account'">
          <MobileSettingsAccountDark
            :user="user"
            :provider="(session as any)?.provider || 'Credentials'"
            @back="mobileSettingsScreen = 'home'"
          />
        </template>

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
          <span class="settings-eyebrow">04 — settings</span>
          <div class="settings-title-row">
            <h1 class="settings-title">
              {{ $t('settings.page.title') }}<span class="settings-title-italic">.</span>
            </h1>
            <Transition name="nc-fade">
              <span v-if="saveStatus === 'saved'" class="save-badge">
                <span class="save-badge-icon i-lucide-check" />
                {{ $t('settings.saved') }}
              </span>
            </Transition>
          </div>
          <p class="settings-subtitle">{{ $t('settings.page.subtitle') }}</p>
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
              <span class="section-label">{{ $t('settings.section_labels.appearance') }}</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">{{ $t('settings.general.theme') }}</span>
                  <span class="setting-desc">{{ $t('settings.general.choose_appearance') }}</span>
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
                  <span class="setting-title">{{ $t('settings.general.font_size') }}</span>
                  <span class="setting-desc">{{ $t('settings.general.adjust_text_size') }}</span>
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
                  <span class="setting-title">{{ $t('settings.general.reduced_motion') }}</span>
                  <span class="setting-desc">{{ $t('settings.general.minimize_animations') }}</span>
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
              <span class="section-label">{{ $t('settings.section_labels.canvas') }}</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">{{ $t('settings.general.show_grid') }}</span>
                  <span class="setting-desc">{{ $t('settings.general.display_grid') }}</span>
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
                  <span class="setting-title">{{ $t('settings.general.show_minimap') }}</span>
                  <span class="setting-desc">{{ $t('settings.general.display_minimap') }}</span>
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
                  <span class="setting-title">{{ $t('settings.general.auto_save') }}</span>
                  <span class="setting-desc">{{ $t('settings.general.auto_save_desc', { interval: userStore.preferences.value.autoSaveInterval / 1000 }) }}</span>
                </div>
                <button
                  :class="['toggle-switch', { on: userStore.preferences.value.autoSave }]"
                  @click="userStore.setPreference('autoSave', !userStore.preferences.value.autoSave)"
                >
                  <span class="toggle-knob" />
                </button>
              </div>
            </div>

            <!-- Updates (AER-14) — cross-platform: Tauri installs in-app,
                 web hard-reloads, mobile deep-links to App/Play Store. -->
            <div class="settings-section">
              <span class="section-label">{{ $t('settings.section_labels.updates') }}</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">{{ $t('settings.general.auto_check_updates') }}</span>
                  <span class="setting-desc">{{ $t('settings.general.auto_check_updates_desc') }}</span>
                </div>
                <button
                  :class="['toggle-switch', { on: autoUpdate.enabled.value }]"
                  :aria-pressed="autoUpdate.enabled.value"
                  @click="autoUpdate.setEnabled(!autoUpdate.enabled.value)"
                >
                  <span class="toggle-knob" />
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">{{ $t('settings.general.current_version') }}</span>
                  <span class="setting-desc">
                    <template v-if="appUpdates.updateAvailable.value && appUpdates.latestVersion.value">
                      v{{ appUpdates.currentVersion }} → v{{ appUpdates.latestVersion.value }}
                    </template>
                    <template v-else>
                      v{{ appUpdates.currentVersion }} — {{ $t('settings.general.up_to_date') }}
                    </template>
                  </span>
                </div>
                <button
                  type="button"
                  class="setting-action-btn"
                  :disabled="checkingForUpdates"
                  @click="manualUpdateCheck"
                >
                  {{ $t('settings.general.check_now') }}
                </button>
              </div>
            </div>
          </div>

          <!-- ═══ AI PROVIDERS TAB ═══ -->
          <div v-else-if="activeTab === 'ai-providers'" key="ai-providers" class="tab-content">
            <div class="settings-section">
              <span class="section-label">{{ $t('settings.section_labels.default_provider') }}</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">{{ $t('settings.ai_providers.ai_engine') }}</span>
                  <span class="setting-desc">{{ $t('settings.ai_providers.select_provider') }}</span>
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
                  <span class="setting-title">{{ $t('settings.ai_providers.model') }}</span>
                  <span class="setting-desc">{{ $t('settings.ai_providers.choose_model') }}</span>
                </div>
                <select
                  :value="selectedModelId"
                  class="setting-select"
                  @change="selectModel(($event.target as HTMLSelectElement).value)"
                >
                  <option v-if="availableModels.length === 0" value="" disabled>{{ $t('settings.ai_providers.no_models') }}</option>
                  <option
                    v-for="model in availableModels"
                    :key="model.id"
                    :value="model.id"
                    :disabled="model.available === false"
                  >
                    {{ model.name || model.id }}{{ model.available === false ? ` — ${$t('settings.ai_providers.coming_soon')}` : '' }}
                  </option>
                </select>
              </div>
            </div>

            <div class="settings-section">
              <span class="section-label">{{ $t('settings.section_labels.api_keys') }}</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">{{ $t('settings.ai_providers.openai_key') }}</span>
                  <span class="setting-desc">{{ $t('settings.ai_providers.openai_desc') }}</span>
                </div>
                <div class="key-input-group">
                  <input
                    v-model="openaiKey"
                    :type="showOpenaiKey ? 'text' : 'password'"
                    class="key-input"
                    :placeholder="$t('settings.ai_api_key_placeholder')"
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
                  <span class="setting-title">{{ $t('settings.ai_providers.anthropic_key') }}</span>
                  <span class="setting-desc">{{ $t('settings.ai_providers.anthropic_desc') }}</span>
                </div>
                <div class="key-input-group">
                  <input
                    v-model="anthropicKey"
                    :type="showAnthropicKey ? 'text' : 'password'"
                    class="key-input"
                    :placeholder="$t('settings.ai_api_key_placeholder')"
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
              <span class="section-label">{{ $t('settings.section_labels.local_models') }}</span>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">{{ $t('settings.ai_providers.ollama') }}</span>
                  <span class="setting-desc">{{ $t('settings.ai_providers.ollama_desc') }}</span>
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
                  <span class="setting-title">{{ $t('settings.ai_providers.ollama_endpoint') }}</span>
                  <span class="setting-desc">{{ $t('settings.ai_providers.ollama_endpoint_desc') }}</span>
                </div>
                <input
                  v-model="ollamaEndpoint"
                  type="url"
                  class="setting-url-input"
                  :placeholder="$t('settings.local_model_url_placeholder')"
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

.m-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 20px 0;
  height: 44px;
}
.m-brand {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(17px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 22px;
  letter-spacing: -0.01em; color: var(--ms-text); margin: 0;
}
.m-topbar-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: #1A1A1E; border: 1px solid var(--ms-border);
  color: var(--ms-accent);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 16px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
:root.light .m-topbar-avatar {
  background: #F5F5F4;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.m-header { padding: 12px 20px 20px; }

.m-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(28px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 34px;
  color: var(--ms-text);
  margin: 0;
}

.m-account {
  display: flex;
  align-items: center;
  margin: 0 20px 20px;
  padding: 16px;
  gap: 14px;
  border-radius: 10px;
  background: var(--ms-card);
  border: 1px solid var(--ms-border);
}
:root.platform-ios .m-account { border-radius: 10px; }
:root.platform-android .m-account { border-radius: 16px; }

.m-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 210, 190, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}

.m-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.m-avatar-letter {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(20px * var(--nc-text-scale, 1));
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
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 20px;
  color: var(--ms-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-account-email {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 16px;
  color: var(--ms-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-chevron { width: 16px; height: 16px; color: var(--ms-muted); flex-shrink: 0; }

/* Sign-in prompt card */
.m-signin-card {
  display: flex;
  align-items: center;
  margin: 0 24px 24px;
  padding: 16px;
  gap: 14px;
  border-radius: 10px;
  background: var(--ms-card);
  border: 1px solid var(--ms-border);
}

.m-signin-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: rgba(0, 210, 190, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.m-signin-icon {
  width: 24px;
  height: 24px;
  color: var(--ms-accent);
}

.m-signin-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.m-signin-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 20px;
  color: var(--ms-text);
}

.m-signin-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 16px;
  color: var(--ms-muted);
}

.m-signin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  border-radius: 10px;
  background: var(--ms-accent);
  color: #FFFFFF;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 18px;
  text-decoration: none;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s ease;
}

.m-signin-btn:active {
  opacity: 0.85;
}

/* Sign-in section with OAuth + email */
.m-signin-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 24px 24px;
}

.m-signin-section .m-signin-card {
  margin: 0;
  padding: 16px;
  border-radius: 12px;
  background: var(--ms-card);
  border: 1px solid var(--ms-border);
  display: flex;
  align-items: center;
  gap: 14px;
}

.m-oauth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 50px;
  border-radius: 12px;
  border: 1px solid var(--ms-border);
  background: var(--ms-card);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--ms-text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease;
}

.m-oauth-btn:active { background: var(--ms-border); }
.m-oauth-btn:disabled { opacity: 0.5; }

.m-oauth-icon { width: 20px; height: 20px; flex-shrink: 0; }
.m-oauth-email-icon { width: 18px; height: 18px; color: var(--ms-muted); flex-shrink: 0; }

/* Email sign-in screen */
.m-signin-error {
  margin: 0 24px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: #EF4444;
}

.m-signin-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  margin: 0 24px;
  border-radius: 12px;
  border: none;
  background: var(--ms-accent);
  color: #FFFFFF;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s ease;
}

.m-signin-submit:active { opacity: 0.85; }
.m-signin-submit:disabled { opacity: 0.4; cursor: not-allowed; }

.m-label {
  padding: 0 24px;
  margin-bottom: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 16px;
  color: var(--ms-muted);
}

.m-group {
  margin: 0 20px 20px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--ms-card);
  border: 1px solid var(--ms-border);
}
:root.platform-ios .m-group { border-radius: 10px; }
:root.platform-android .m-group { border-radius: 16px; }

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
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--ms-text);
}

.m-row-right { display: flex; align-items: center; gap: 4px; }

.m-row-value {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(14px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--ms-green);
}

.m-empty-providers { justify-content: center; cursor: default; }

.m-empty-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--ms-muted);
}

.m-signout {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  margin: 8px 20px 0;
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  background: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 18px;
  color: var(--ms-red);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease;
}
:root.platform-ios .m-signout { border-radius: 10px; }
:root.platform-android .m-signout { border-radius: 28px; }

.m-signout:active { background: rgba(239, 68, 68, 0.08); }
.m-signout:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── Sub-screen header with back button ─── */
.m-subheader {
  display: flex;
  align-items: center;
  padding: 8px 16px 20px;
  gap: 12px;
}

.m-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: none;
  background: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  color: var(--ms-text);
  font-size: calc(20px * var(--nc-text-scale, 1));
}

.m-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(20px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 26px;
  color: var(--ms-text);
  margin: 0;
}

/* ─── Nav rows (Home screen drill-down) ─── */
.m-row--nav {
  gap: 14px;
}

.m-row-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--ms-border);
  flex-shrink: 0;
}

.m-row-hint {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 16px;
  color: rgba(136, 136, 144, 0.6);
  flex: 1;
  text-align: right;
}

.m-row-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: flex-end;
}

/* ─── Segmented control ─── */
.m-segmented-control {
  display: flex;
  margin: 0 24px 16px;
  background: var(--ms-card);
  border-radius: 10px;
  padding: 4px;
  border: 1px solid var(--ms-border);
  gap: 4px;
}

.m-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 36px;
  border-radius: 8px;
  gap: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 150ms ease;
  -webkit-tap-highlight-color: transparent;
}

.m-seg-icon { font-size: calc(16px * var(--nc-text-scale, 1)); color: var(--ms-muted); }
.m-seg-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--ms-muted);
}

.m-seg.active { background: var(--ms-border); }
.m-seg.active .m-seg-icon { color: var(--ms-text); }
.m-seg.active .m-seg-label { font-weight: 600; color: var(--ms-text); }

/* ─── Column layout in rows ─── */
.m-row-col {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.m-row-sub {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 16px;
  color: var(--ms-muted);
}

.m-row-action {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--ms-accent);
}

.m-row-action-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--ms-accent);
}

.m-row-check {
  width: 18px;
  height: 18px;
  color: var(--ms-accent);
  flex-shrink: 0;
}

/* ─── Profile row ─── */
.m-row--profile {
  gap: 14px;
  padding: 16px;
}

.m-avatar--lg {
  width: 56px;
  height: 56px;
  border-radius: 28px;
}

.m-avatar--lg .m-avatar-letter {
  font-size: calc(24px * var(--nc-text-scale, 1));
  line-height: 28px;
}

/* ─── Field rows ─── */
.m-row--field {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 14px 16px;
}

.m-field-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--ms-muted);
}

.m-field-input {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  background: var(--ms-bg);
  border: 1px solid var(--ms-border);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 18px;
  color: var(--ms-text);
  outline: none;
}

.m-field-input:focus {
  border-color: var(--ms-accent);
}

/* ─── Danger row ─── */
.m-row--danger .m-row-icon,
.m-row--danger .m-row-text {
  color: var(--ms-red);
}

.m-row--danger .m-row-chevron {
  color: rgba(239, 68, 68, 0.5);
}

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
  gap: 8px;
}

.settings-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.06em;
  color: var(--s-muted, #555560);
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
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: #22C55E;
  line-height: 16px;
}

.save-badge-icon {
  font-size: calc(12px * var(--nc-text-scale, 1));
}

.nc-fade-enter-active { transition: opacity 0.15s ease; }
.nc-fade-leave-active { transition: opacity 0.4s ease; }
.nc-fade-enter-from,
.nc-fade-leave-to { opacity: 0; }

.settings-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(32px * var(--nc-text-scale, 1));
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--s-text, #FAFAFA);
  margin: 0;
}

.settings-title-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  color: var(--nc-accent, #00D2BE);
}

.settings-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(14px * var(--nc-text-scale, 1));
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
  font-size: calc(14px * var(--nc-text-scale, 1));
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
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0.06em;
  line-height: 14px;
  color: var(--s-muted, #52525B);
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
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--s-text, #FAFAFA);
}

.setting-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  transition: background 220ms cubic-bezier(0.4, 0, 0.2, 1),
              color 220ms cubic-bezier(0.4, 0, 0.2, 1),
              transform 120ms cubic-bezier(0.4, 0, 0.2, 1);
}

.segment:active { transform: scale(0.96); }

.segment.active { background: var(--s-seg-active, #09090B); }

.segment-icon {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--s-muted, #555560);
  flex-shrink: 0;
}

.segment.active .segment-icon { color: var(--s-text, #FAFAFA); }

.segment-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  position: relative;
  width: 44px;
  height: 24px;
  padding: 2px;
  border-radius: 12px;
  border: none;
  background: var(--s-toggle-off, #1A1A1E);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 220ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-switch.on {
  background: var(--s-accent, #00D2BE);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--s-knob-off, #555560);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1),
              background 220ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-switch.on .toggle-knob {
  background: var(--s-knob-on, #FAFAFA);
  transform: translateX(20px);
}

/* Select (model dropdown) */
.setting-select {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
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

/* Inline "Check now" button used by the Updates section (AER-14). */
.setting-action-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--s-text, #FAFAFA);
  background: var(--s-surface, #0D0D10);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, opacity 0.15s;
}

.setting-action-btn:hover:not(:disabled) {
  border-color: var(--s-accent, #00D2BE);
  color: var(--s-accent, #00D2BE);
}

.setting-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  font-size: calc(12px * var(--nc-text-scale, 1));
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
