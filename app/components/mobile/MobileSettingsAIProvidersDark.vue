<script setup lang="ts">
/**
 * Mobile Settings — AI Providers (Dark)
 * Paper artboard KPL-0 ("Mobile iOS — Settings: AI Providers").
 * Active provider card + Available list + vault note.
 */
import { computed, ref, watch } from 'vue'

interface ProviderLike {
  id: string
  type: string
  name?: string
  selectedModelId?: string
  isDefault?: boolean
  isEnabled?: boolean
  baseUrl?: string
  models?: Array<{ id: string; name?: string }>
}

const props = defineProps<{
  providers: ProviderLike[]
  providerKeyStatus: Map<string, boolean>
  defaultProviderType?: string | null
  keySaving?: string | null
  keyError?: string | null
  keySaved?: number
  keyTestSuccess?: string | null
}>()

const emit = defineEmits<{
  back: []
  'save-key': [payload: { type: string, key: string }]
  'remove-key': [type: string]
  'test-key': [type: string]
  'set-default': [type: string]
  'set-model': [payload: { type: string, modelId: string }]
}>()

// Inline key-entry sheet
const sheetOpen = ref(false)
const sheetType = ref<string | null>(null)
const sheetMode = ref<'connect' | 'rotate'>('connect')
const sheetKey = ref('')
const sheetReveal = ref(false)

function openSheet(type: string, mode: 'connect' | 'rotate' = 'connect') {
  sheetType.value = type
  sheetMode.value = mode
  sheetKey.value = ''
  sheetReveal.value = false
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  sheetType.value = null
  sheetKey.value = ''
}

function saveSheet() {
  if (!sheetType.value) return
  const k = sheetKey.value.trim()
  if (!k) return
  emit('save-key', { type: sheetType.value, key: k })
}

// Auto-close sheet when parent reports a successful save (keySaved bumps).
watch(() => props.keySaved, (next, prev) => {
  if (next && next !== prev && sheetOpen.value) closeSheet()
})

const sheetTitle = computed(() => {
  const map: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    ollama: 'Ollama'
  }
  const name = sheetType.value ? map[sheetType.value] : ''
  return sheetMode.value === 'rotate' ? `Rotate ${name} key` : `Connect ${name}`
})

const sheetPrefix = computed(() => {
  if (sheetType.value === 'anthropic') return 'sk-ant-...'
  if (sheetType.value === 'openrouter') return 'sk-or-...'
  if (sheetType.value === 'openai') return 'sk-...'
  return 'http://localhost:11434'
})

interface ProviderRow {
  type: 'anthropic' | 'openai' | 'openrouter' | 'ollama'
  name: string
  caption: string
  iconKey: 'anthropic' | 'openai' | 'openrouter' | 'ollama'
  italic?: string
}

const ALL_PROVIDERS: ProviderRow[] = [
  { type: 'anthropic', name: 'Anthropic', caption: 'CLAUDE-OPUS-4-7 · 1M CTX', iconKey: 'anthropic' },
  { type: 'openai', name: 'OpenAI', caption: 'GPT-5 · O4 · WHISPER', iconKey: 'openai' },
  { type: 'openrouter', name: 'OpenRouter', caption: '300+ MODELS · BYO BUDGET', iconKey: 'openrouter', italic: '— gateway' },
  { type: 'ollama', name: 'Ollama (local)', caption: 'LOCALHOST:11434 · OFFLINE', iconKey: 'ollama' }
]

function isConnected(type: string): boolean {
  const provider = props.providers.find(p => p.type === type)
  if (!provider) return false
  return props.providerKeyStatus.get(provider.id) === true
}

const activeProviders = computed(() => ALL_PROVIDERS.filter(p => isConnected(p.type)))
const availableProviders = computed(() => ALL_PROVIDERS.filter(p => !isConnected(p.type)))

const liveCount = computed(() => activeProviders.value.length)

const liveLabel = computed(() => {
  const c = liveCount.value
  return `${c} / ${ALL_PROVIDERS.length} LIVE`
})

const vaultLabel = computed(() => liveCount.value > 0 ? 'VAULT OK' : 'NO KEYS')

// Stub stats for active card (real numbers would come from backend telemetry)
function getProviderModels(type: string) {
  const provider = props.providers.find(p => p.type === type)
  return provider?.models || []
}
function getSelectedModelId(type: string): string | undefined {
  return props.providers.find(p => p.type === type)?.selectedModelId
}

function maskKey(type: string): string {
  const provider = props.providers.find(p => p.type === type)
  if (!provider) return '—'
  const prefix = type === 'anthropic' ? 'sk-ant' : type === 'openai' ? 'sk' : 'sk-or'
  return `${prefix}··${provider.id.slice(-4)}`
}
</script>

<template>
  <section class="map" aria-label="AI Providers settings">
    <!-- Top bar -->
    <header class="map-top">
      <button class="map-back" type="button" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5L8 12L15 19" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>SETTINGS</span>
      </button>
      <div class="map-live">
        <span class="map-live-dot" />
        <span class="map-live-label">{{ vaultLabel }}</span>
      </div>
    </header>

    <!-- Hero -->
    <div class="map-hero">
      <span class="map-eyebrow">02 — AI PROVIDERS</span>
      <h1 class="map-hero-line">
        <span class="map-hero-sans">Choose a</span>
        <span class="map-hero-serif">brain.</span>
      </h1>
      <span class="map-hero-meta">Bring your own keys. Vaulted server-side, never in the bundle.</span>
    </div>

    <!-- Scroll body -->
    <div class="map-scroll">
      <!-- ACTIVE -->
      <div class="map-section-head">
        <span class="map-section-label">ACTIVE</span>
        <span class="map-section-status" :class="{ 'map-section-status--mint': liveCount > 0 }">{{ liveLabel }}</span>
      </div>

      <template v-if="activeProviders.length === 0">
        <div class="map-empty">
          <span class="map-empty-title">No active providers.</span>
          <span class="map-empty-sub">Connect a provider below to start generating.</span>
        </div>
      </template>

      <template v-else>
        <div
          v-for="provider in activeProviders"
          :key="provider.type"
          class="map-active-card"
        >
          <div class="map-active-top">
            <div class="map-prov-tile map-prov-tile--lg">
              <svg v-if="provider.iconKey === 'anthropic'" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 4L4 18H7L8 15H14L15 18H18L13 4H9Z M9 12L11 6L13 12H9Z" fill="#00D2BE" />
              </svg>
              <svg v-else-if="provider.iconKey === 'openai'" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="8" stroke="#00D2BE" stroke-width="1.6" />
                <path d="M8 12C9 10 11 10 12 12C13 14 15 14 16 12" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <svg v-else-if="provider.iconKey === 'openrouter'" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12H20" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" />
                <path d="M4 12L9 7M4 12L9 17" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M20 12L15 7M20 12L15 17" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="#00D2BE" stroke-width="1.6" />
                <circle cx="9" cy="10" r="1" fill="#00D2BE" />
                <circle cx="15" cy="10" r="1" fill="#00D2BE" />
                <path d="M9 15C10 16 14 16 15 15" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <div class="map-active-info">
              <div class="map-active-titlebar">
                <span class="map-active-title">{{ provider.name }}</span>
                <span v-if="defaultProviderType === provider.type" class="map-active-italic">primary</span>
              </div>
              <span class="map-active-sub">{{ provider.caption }}</span>
            </div>
            <div v-if="defaultProviderType === provider.type" class="map-status-pill">
              <span class="map-status-dot" />
              <span class="map-status-text">DEFAULT</span>
            </div>
            <button
              v-else
              type="button"
              class="map-status-pill map-status-pill--cta"
              @click="emit('set-default', provider.type)"
            >
              <span class="map-status-text">USE</span>
            </button>
          </div>

          <div class="map-stats">
            <div class="map-stat">
              <span class="map-stat-label">KEY</span>
              <span class="map-stat-value">{{ maskKey(provider.type) }}</span>
            </div>
            <div class="map-stat-divider" />
            <div class="map-stat">
              <span class="map-stat-label">STATUS</span>
              <span class="map-stat-value">CONNECTED</span>
            </div>
            <div class="map-stat-divider" />
            <div class="map-stat">
              <span class="map-stat-label">LATENCY</span>
              <span class="map-stat-value">— ms</span>
            </div>
          </div>

          <div v-if="getProviderModels(provider.type).length > 0" class="map-model-row">
            <span class="map-model-label">MODEL</span>
            <div class="map-model-pills">
              <button
                v-for="m in getProviderModels(provider.type)"
                :key="m.id"
                type="button"
                class="map-model-pill"
                :class="{ 'map-model-pill--on': getSelectedModelId(provider.type) === m.id }"
                @click="emit('set-model', { type: provider.type, modelId: m.id })"
              >{{ m.name.replace(/^Claude\s+/, '') }}</button>
            </div>
          </div>

          <div v-if="keyTestSuccess === provider.type" class="map-test-result map-test-result--ok">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 13L9 17L19 7" stroke="#00D2BE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>Key verified · provider responded</span>
          </div>
          <div v-else-if="keyError && keySaving !== provider.type" class="map-test-result map-test-result--err">
            <span>{{ keyError }}</span>
          </div>

          <div class="map-actions">
            <button
              class="map-action map-action--primary"
              type="button"
              :disabled="keySaving === provider.type"
              @click="emit('test-key', provider.type)"
            >
              {{ keySaving === provider.type ? 'TESTING…' : 'TEST KEY' }}
            </button>
            <button
              class="map-action"
              type="button"
              @click="openSheet(provider.type, 'rotate')"
            >
              ROTATE
            </button>
            <button
              class="map-action"
              type="button"
              @click="emit('remove-key', provider.type)"
            >
              REMOVE
            </button>
          </div>
        </div>
      </template>

      <!-- AVAILABLE -->
      <div class="map-section-head">
        <span class="map-section-label">AVAILABLE</span>
        <span class="map-section-status">TAP TO CONNECT</span>
      </div>

      <div class="map-card">
        <template v-for="(provider, idx) in availableProviders" :key="provider.type">
          <button class="map-row" type="button" @click="openSheet(provider.type, 'connect')">
            <div class="map-icon">
              <svg v-if="provider.iconKey === 'anthropic'" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 4L4 18H7L8 15H14L15 18H18L13 4H9Z M9 12L11 6L13 12H9Z" fill="#A1A1AA" />
              </svg>
              <svg v-else-if="provider.iconKey === 'openai'" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="8" stroke="#A1A1AA" stroke-width="1.6" />
                <path d="M8 12C9 10 11 10 12 12C13 14 15 14 16 12" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <svg v-else-if="provider.iconKey === 'openrouter'" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12H20" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
                <path d="M4 12L9 7M4 12L9 17" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M20 12L15 7M20 12L15 17" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="#A1A1AA" stroke-width="1.6" />
                <circle cx="9" cy="10" r="1" fill="#A1A1AA" />
                <circle cx="15" cy="10" r="1" fill="#A1A1AA" />
                <path d="M9 15C10 16 14 16 15 15" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <div class="map-row-text">
              <span class="map-row-title">
                {{ provider.name }}
                <span v-if="provider.italic" class="map-row-italic">{{ provider.italic }}</span>
              </span>
              <span class="map-row-hint">{{ provider.caption }}</span>
            </div>
            <div class="map-pill">{{ provider.type === 'ollama' ? 'DETECT' : 'CONNECT' }}</div>
          </button>
          <div v-if="idx < availableProviders.length - 1" class="map-divider" />
        </template>
      </div>

      <!-- Vault note -->
      <div class="map-vault-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" stroke="#A1A1AA" stroke-width="1.6" />
          <path d="M8 11V8C8 5.79 9.79 4 12 4C14.21 4 16 5.79 16 8V11" stroke="#A1A1AA" stroke-width="1.6" />
        </svg>
        <span class="map-vault-text">
          KEYS ARE SEALED IN THE SERVER VAULT.<br>
          NEVER LEAVE YOUR ACCOUNT. NEVER LOGGED.
        </span>
      </div>

      <div class="map-spacer" />
    </div>

    <!-- Key entry sheet -->
    <Transition name="map-sheet">
      <div v-if="sheetOpen" class="map-sheet-backdrop" @click.self="closeSheet">
        <div class="map-sheet" role="dialog" aria-modal="true">
          <div class="map-sheet-grab" />
          <div class="map-sheet-eyebrow">{{ sheetMode === 'rotate' ? 'ROTATE KEY' : 'CONNECT PROVIDER' }}</div>
          <h2 class="map-sheet-title">{{ sheetTitle }}<span class="map-sheet-title-dot">.</span></h2>
          <p class="map-sheet-meta">
            Paste your API key. Sealed in the server vault — never logged, never bundled.
          </p>

          <label class="map-sheet-field">
            <span class="map-sheet-label">{{ sheetType === 'ollama' ? 'ENDPOINT URL' : 'API KEY' }}</span>
            <div class="map-sheet-input-wrap">
              <input
                v-model="sheetKey"
                :type="sheetReveal ? 'text' : 'password'"
                class="map-sheet-input"
                :placeholder="sheetPrefix"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
              >
              <button
                class="map-sheet-reveal"
                type="button"
                :aria-label="sheetReveal ? 'Hide key' : 'Show key'"
                @click="sheetReveal = !sheetReveal"
              >
                <svg v-if="sheetReveal" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 3L21 21" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
                  <path d="M10.6 6.2C11.06 6.07 11.53 6 12 6C18 6 22 12 22 12C21.4 13 20.7 14 19.9 14.8M14 14.2C13.45 14.7 12.75 15 12 15C10.34 15 9 13.66 9 12C9 11.25 9.3 10.55 9.8 10" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
                  <path d="M6.5 7.5C3.6 9.4 2 12 2 12C2 12 6 18 12 18C13.36 18 14.62 17.74 15.74 17.32" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2 12C2 12 6 6 12 6C18 6 22 12 22 12C22 12 18 18 12 18C6 18 2 12 2 12Z" stroke="#A1A1AA" stroke-width="1.6" />
                  <circle cx="12" cy="12" r="3" stroke="#A1A1AA" stroke-width="1.6" />
                </svg>
              </button>
            </div>
            <span v-if="keyError && keySaving === sheetType" class="map-sheet-error">{{ keyError }}</span>
            <span v-else class="map-sheet-hint">VAULTED · AES-256-GCM</span>
          </label>

          <div class="map-sheet-actions">
            <button class="map-sheet-btn" type="button" @click="closeSheet">CANCEL</button>
            <button
              class="map-sheet-btn map-sheet-btn--primary"
              type="button"
              :disabled="!sheetKey.trim() || keySaving === sheetType"
              @click="saveSheet"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ keySaving === sheetType ? 'SAVING…' : 'SAVE KEY' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.map button {
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
  color: inherit;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.map input, .map select {
  -webkit-appearance: none;
  appearance: none;
  outline: none;
}
.map {
  --map-bg: #09090B;
  --map-ink: #FAFAFA;
  --map-body: #A1A1AA;
  --map-mute: #52525B;
  --map-mint: #00D2BE;
  --map-surface: rgba(250, 250, 250, 0.04);
  --map-stroke: rgba(250, 250, 250, 0.10);
  --map-stroke-soft: rgba(250, 250, 250, 0.06);

  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--map-bg);
  color: var(--map-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  z-index: 10;
}

/* Top bar */
.map-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 26px) 20px 0 20px;
  flex-shrink: 0;
}
.map-back {
  display: flex; align-items: center; gap: 10px;
  padding: 4px 4px 4px 0;
  background: none; border: none; cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.12em;
  color: var(--map-body);
}
.map-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.map-live-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--map-mint);
  animation: map-pulse 2.4s ease-in-out infinite;
}
@keyframes map-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.map-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.08em;
  color: var(--map-mint);
}

/* Hero */
.map-hero {
  display: flex; flex-direction: column;
  padding: 18px 20px 0 20px;
  flex-shrink: 0;
}
.map-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0;
}
.map-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 36px; line-height: 38px;
  letter-spacing: -0.025em; color: var(--map-ink);
}
.map-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: 46px; line-height: 38px;
  letter-spacing: -0.02em; color: var(--map-mint);
}
.map-hero-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px; line-height: 20px;
  color: var(--map-body); margin-top: 10px;
}

/* Scroll */
.map-scroll {
  flex: 1 1 0; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  padding: 0 20px;
  scrollbar-width: none;
}
.map-scroll::-webkit-scrollbar { display: none; }

.map-section-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 4px 10px;
}
.map-section-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-section-status {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.08em;
  color: var(--map-mute);
}
.map-section-status--mint { color: var(--map-mint); }

/* Empty state */
.map-empty {
  display: flex; flex-direction: column; gap: 4px;
  padding: 18px;
  background: var(--map-surface);
  border: 1px dashed var(--map-stroke);
  border-radius: 14px;
}
.map-empty-title {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-size: 18px; color: var(--map-ink);
}
.map-empty-sub {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.04em;
  color: var(--map-mute);
}

/* Active provider card */
.map-active-card {
  display: flex; flex-direction: column; gap: 16px;
  padding: 16px;
  background: rgba(0, 210, 190, 0.04);
  border: 1px solid rgba(0, 210, 190, 0.22);
  border-radius: 16px;
}
.map-active-top { display: flex; align-items: center; gap: 12px; }
.map-prov-tile {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.28);
  flex-shrink: 0;
}
.map-prov-tile--lg { width: 44px; height: 44px; border-radius: 12px; }
.map-active-info {
  display: flex; flex-direction: column; gap: 3px;
  flex: 1 1 0; min-width: 0;
}
.map-active-titlebar { display: flex; align-items: baseline; gap: 8px; }
.map-active-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 16px; line-height: 20px;
  letter-spacing: -0.01em; color: var(--map-ink);
}
.map-active-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-size: 16px; color: var(--map-mint);
}
.map-active-sub {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.04em;
  color: var(--map-mute);
}
.map-status-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
  flex-shrink: 0;
}
.map-status-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--map-mint);
}
.map-status-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 600; font-size: 9px; letter-spacing: 0.08em;
  color: var(--map-mint);
}
.map-status-pill--cta {
  cursor: pointer;
  background: var(--map-mint);
  border-color: var(--map-mint);
}
.map-status-pill--cta .map-status-text { color: #09090B; }

.map-stats { display: flex; gap: 12px; }
.map-stat {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1 1 0; min-width: 0;
}
.map-stat-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 9px; letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-stat-value {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 12px; color: var(--map-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.map-stat-divider { width: 1px; background: var(--map-stroke-soft); }

.map-model-row {
  display: flex; flex-direction: column; gap: 8px;
}
.map-model-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 9px; letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-model-pills {
  display: flex; gap: 6px;
  overflow-x: auto;
  margin: 0 -16px;
  padding: 0 16px 2px 16px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.map-model-pills::-webkit-scrollbar { display: none; }
.map-model-pill {
  flex: 0 0 auto;
  padding: 6px 10px;
  background: var(--map-surface);
  border: 1px solid var(--map-stroke);
  border-radius: 999px;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 12px; letter-spacing: -0.005em;
  color: var(--map-body);
  white-space: nowrap;
}
.map-model-pill--on {
  background: rgba(0, 210, 190, 0.10);
  border-color: rgba(0, 210, 190, 0.45);
  color: var(--map-mint);
  font-weight: 600;
}

.map-test-result {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.02em;
  line-height: 14px;
}
.map-test-result--ok {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.30);
  color: var(--map-mint);
}
.map-test-result--err {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.30);
  color: #FCA5A5;
}

.map-actions { display: flex; gap: 8px; }
.map-action {
  flex: 1 1 0;
  padding: 10px;
  background: var(--map-surface);
  border: 1px solid var(--map-stroke);
  border-radius: 10px;
  cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 600; font-size: 10px; letter-spacing: 0.10em;
  color: var(--map-body);
  text-align: center;
}
.map-action--primary {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.28);
  color: var(--map-mint);
}

/* Available card */
.map-card {
  background: var(--map-surface);
  border: 1px solid var(--map-stroke-soft);
  border-radius: 16px;
  overflow: hidden;
}
.map-row {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: transparent; border: none;
  cursor: pointer; text-align: left;
  font-family: inherit; color: inherit;
  transition: background 150ms ease;
}
.map-row:active { background: rgba(250, 250, 250, 0.04); }
.map-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.08);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.map-row-text {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1 1 0; min-width: 0;
}
.map-row-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 14px; line-height: 18px;
  letter-spacing: -0.01em; color: var(--map-ink);
}
.map-row-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: 13px; color: var(--map-body);
  margin-left: 4px;
}
.map-row-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.04em;
  color: var(--map-mute);
}
.map-pill {
  padding: 5px 10px;
  background: var(--map-surface);
  border: 1px solid var(--map-stroke);
  border-radius: 999px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 600; font-size: 9px; letter-spacing: 0.10em;
  color: var(--map-body);
  flex-shrink: 0;
}
.map-divider {
  height: 1px; background: var(--map-stroke-soft);
  margin: 0 16px;
}

/* Vault note */
.map-vault-note {
  display: flex; align-items: flex-start; gap: 10px;
  margin-top: 18px;
  padding: 12px 14px;
  background: var(--map-surface);
  border: 1px solid var(--map-stroke-soft);
  border-radius: 12px;
}
.map-vault-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 14px;
  letter-spacing: 0.04em;
  color: var(--map-body);
}

.map-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}

/* Key entry sheet */
.map-sheet-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex; align-items: flex-end;
  justify-content: center;
  padding-bottom: var(--kbd-h, 0px);
  transition: padding-bottom 220ms cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 100;
}
.map-sheet {
  width: 100%;
  display: flex; flex-direction: column;
  padding: 14px 20px calc(28px + env(safe-area-inset-bottom, 0px)) 20px;
  background: #0E0E11;
  border-top: 1px solid var(--map-stroke);
  border-radius: 22px 22px 0 0;
}
.map-sheet-grab {
  align-self: center;
  width: 40px; height: 4px; border-radius: 999px;
  background: var(--map-stroke);
  margin-bottom: 18px;
}
.map-sheet-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-sheet-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 28px; line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--map-ink);
  margin: 10px 0 0 0;
}
.map-sheet-title-dot {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  color: var(--map-mint);
  margin-left: 2px;
}
.map-sheet-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px; line-height: 19px;
  color: var(--map-body);
  margin: 8px 0 18px 0;
}
.map-sheet-field {
  display: flex; flex-direction: column; gap: 8px;
}
.map-sheet-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-sheet-input-wrap {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  background: var(--map-surface);
  border: 1px solid var(--map-stroke);
  border-radius: 12px;
}
.map-sheet-input {
  flex: 1 1 0;
  background: none; border: none;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 13px; letter-spacing: 0.02em;
  color: var(--map-ink);
  outline: none;
  min-width: 0;
}
.map-sheet-input::placeholder { color: var(--map-mute); }
.map-sheet-reveal {
  background: none; border: none; cursor: pointer;
  padding: 4px;
  display: flex; align-items: center; justify-content: center;
}
.map-sheet-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 9px; letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-sheet-error {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.04em;
  color: var(--map-red, #EF4444);
}
.map-sheet-actions {
  display: flex; gap: 10px;
  margin-top: 22px;
}
.map-sheet-btn {
  flex: 1 1 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px;
  background: var(--map-surface);
  border: 1px solid var(--map-stroke);
  border-radius: 12px;
  cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 600; font-size: 11px; letter-spacing: 0.10em;
  color: var(--map-body);
}
.map-sheet-btn--primary {
  flex: 2 1 0;
  background: var(--map-mint);
  border-color: var(--map-mint);
  color: #09090B;
}
.map-sheet-btn--primary:disabled {
  opacity: 0.5; cursor: not-allowed;
}
.map-sheet-btn--primary:active:not(:disabled) {
  background: #00b8a6;
  border-color: #00b8a6;
}

.map-sheet-enter-active, .map-sheet-leave-active {
  transition: opacity 200ms ease;
}
.map-sheet-enter-active .map-sheet, .map-sheet-leave-active .map-sheet {
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}
.map-sheet-enter-from, .map-sheet-leave-to { opacity: 0; }
.map-sheet-enter-from .map-sheet, .map-sheet-leave-to .map-sheet {
  transform: translateY(100%);
}
</style>
