<script setup lang="ts">
/**
 * Mobile Settings — AI Providers (Dark)
 * Paper artboard KPL-0 ("Mobile iOS — Settings: AI Providers").
 * Active provider card + Available list + vault note.
 */
import { computed, ref, watch } from 'vue'

const { t } = useI18n()

interface ProviderLike {
  id: string
  type: string
  name?: string
  selectedModelId?: string
  isDefault?: boolean
  isEnabled?: boolean
  baseUrl?: string
  models?: Array<{ id: string; name?: string; available?: boolean }>
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
    openrouter: 'OpenRouter'
  }
  const name = sheetType.value ? map[sheetType.value] : ''
  return sheetMode.value === 'rotate'
    ? t('mobile.settingsAiProviders.sheetTitleRotate', { n: name })
    : t('mobile.settingsAiProviders.sheetTitleConnect', { n: name })
})

const sheetPrefix = computed(() => {
  if (sheetType.value === 'anthropic') return 'sk-ant-...'
  if (sheetType.value === 'openrouter') return 'sk-or-...'
  return 'sk-...'
})

interface ProviderRow {
  type: 'anthropic' | 'openai' | 'openrouter'
  name: string
  caption: string
  iconKey: 'anthropic' | 'openai' | 'openrouter'
  italic?: string
}

// Ollama is intentionally excluded on mobile: a phone can't reach an Ollama
// server on the dev machine's localhost, so it's never a usable provider here.
const ALL_PROVIDERS: ProviderRow[] = [
  { type: 'anthropic', name: 'Anthropic', caption: 'CLAUDE-OPUS-4-8 · 1M CTX', iconKey: 'anthropic' },
  { type: 'openai', name: 'OpenAI', caption: 'GPT-5.5 · GPT-5.4 · WHISPER', iconKey: 'openai' },
  { type: 'openrouter', name: 'OpenRouter', caption: '300+ MODELS · BYO BUDGET', iconKey: 'openrouter', italic: `— ${t('mobile.settingsAiProviders.gateway')}` }
]

function isConnected(type: string): boolean {
  const provider = props.providers.find(p => p.type === type)
  if (!provider) return false
  return props.providerKeyStatus.get(provider.id) === true
}

const activeProviders = computed(() => ALL_PROVIDERS.filter(p => isConnected(p.type)))
const availableProviders = computed(() => ALL_PROVIDERS.filter(p => !isConnected(p.type)))

const liveCount = computed(() => activeProviders.value.length)

const liveLabel = computed(() =>
  t('mobile.settingsAiProviders.liveLabel', { n: liveCount.value, total: ALL_PROVIDERS.length })
)

const vaultLabel = computed(() =>
  liveCount.value > 0
    ? t('mobile.settingsAiProviders.vaultOk')
    : t('mobile.settingsAiProviders.noKeys')
)

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
  <section class="map" :aria-label="t('mobile.settingsAiProviders.ariaSection')">
    <!-- Top bar -->
    <header class="map-top">
      <button class="map-back" type="button" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ t('mobile.settingsAiProviders.back') }}</span>
      </button>
      <div class="map-live">
        <span class="map-live-dot" />
        <span class="map-live-label">{{ vaultLabel }}</span>
      </div>
    </header>

    <!-- Hero -->
    <div class="map-hero">
      <span class="map-eyebrow">{{ t('mobile.settingsAiProviders.eyebrow') }}</span>
      <h1 class="map-hero-line">
        <span class="map-hero-sans">{{ t('mobile.settingsAiProviders.heroLead') }}</span>
        <span class="map-hero-serif">{{ t('mobile.settingsAiProviders.heroAccent') }}</span>
      </h1>
      <span class="map-hero-meta">{{ t('mobile.settingsAiProviders.heroMeta') }}</span>
    </div>

    <!-- Scroll body -->
    <div class="map-scroll">
      <!-- ACTIVE -->
      <div class="map-section-head">
        <span class="map-section-label">{{ t('mobile.settingsAiProviders.sectionActive') }}</span>
        <span class="map-section-status" :class="{ 'map-section-status--mint': liveCount > 0 }">{{ liveLabel }}</span>
      </div>

      <template v-if="activeProviders.length === 0">
        <div class="map-empty">
          <span class="map-empty-title">{{ t('mobile.settingsAiProviders.emptyTitle') }}</span>
          <span class="map-empty-sub">{{ t('mobile.settingsAiProviders.emptySub') }}</span>
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
                <path d="M9 4L4 18H7L8 15H14L15 18H18L13 4H9Z M9 12L11 6L13 12H9Z" fill="currentColor" />
              </svg>
              <svg v-else-if="provider.iconKey === 'openai'" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6" />
                <path d="M8 12C9 10 11 10 12 12C13 14 15 14 16 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <svg v-else-if="provider.iconKey === 'openrouter'" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12H20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                <path d="M4 12L9 7M4 12L9 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M20 12L15 7M20 12L15 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.6" />
                <circle cx="9" cy="10" r="1" fill="currentColor" />
                <circle cx="15" cy="10" r="1" fill="currentColor" />
                <path d="M9 15C10 16 14 16 15 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <div class="map-active-info">
              <div class="map-active-titlebar">
                <span class="map-active-title">{{ provider.name }}</span>
                <span v-if="defaultProviderType === provider.type" class="map-active-italic">{{ t('mobile.settingsAiProviders.primary') }}</span>
              </div>
              <span class="map-active-sub">{{ provider.caption }}</span>
            </div>
            <div v-if="defaultProviderType === provider.type" class="map-status-pill">
              <span class="map-status-dot" />
              <span class="map-status-text">{{ t('mobile.settingsAiProviders.statusDefault') }}</span>
            </div>
            <button
              v-else
              type="button"
              class="map-status-pill map-status-pill--cta"
              @click="emit('set-default', provider.type)"
            >
              <span class="map-status-text">{{ t('mobile.settingsAiProviders.statusUse') }}</span>
            </button>
          </div>

          <div class="map-stats">
            <div class="map-stat">
              <span class="map-stat-label">{{ t('mobile.settingsAiProviders.statKey') }}</span>
              <span class="map-stat-value">{{ maskKey(provider.type) }}</span>
            </div>
            <div class="map-stat-divider" />
            <div class="map-stat">
              <span class="map-stat-label">{{ t('mobile.settingsAiProviders.statStatus') }}</span>
              <span class="map-stat-value map-stat-value--ok">{{ t('mobile.settingsAiProviders.connected') }}</span>
            </div>
          </div>

          <div v-if="getProviderModels(provider.type).length > 0" class="map-model-row">
            <span class="map-model-label">{{ t('mobile.settingsAiProviders.modelLabel') }}</span>
            <div class="map-model-pills">
              <button
                v-for="m in getProviderModels(provider.type)"
                :key="m.id"
                type="button"
                class="map-model-pill"
                :class="{
                  'map-model-pill--on': getSelectedModelId(provider.type) === m.id,
                  'map-model-pill--soon': m.available === false,
                }"
                :disabled="m.available === false"
                @click="m.available === false ? null : emit('set-model', { type: provider.type, modelId: m.id })"
              >{{ (m.name ?? m.id).replace(/^Claude\s+/, '') }}{{ m.available === false ? ` · ${t('mobile.settingsAiProviders.soon')}` : '' }}</button>
            </div>
          </div>

          <div v-if="keyTestSuccess === provider.type" class="map-test-result map-test-result--ok">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ t('mobile.settingsAiProviders.keyVerified') }}</span>
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
              {{ keySaving === provider.type ? t('mobile.settingsAiProviders.testing') : t('mobile.settingsAiProviders.testKey') }}
            </button>
            <button
              class="map-action"
              type="button"
              @click="openSheet(provider.type, 'rotate')"
            >
              {{ t('mobile.settingsAiProviders.rotate') }}
            </button>
            <button
              class="map-action"
              type="button"
              @click="emit('remove-key', provider.type)"
            >
              {{ t('mobile.settingsAiProviders.remove') }}
            </button>
          </div>
        </div>
      </template>

      <!-- AVAILABLE -->
      <div class="map-section-head">
        <span class="map-section-label">{{ t('mobile.settingsAiProviders.sectionAvailable') }}</span>
        <span class="map-section-status">{{ t('mobile.settingsAiProviders.tapToConnect') }}</span>
      </div>

      <div class="map-card">
        <template v-for="(provider, idx) in availableProviders" :key="provider.type">
          <button class="map-row" type="button" @click="openSheet(provider.type, 'connect')">
            <div class="map-icon">
              <svg v-if="provider.iconKey === 'anthropic'" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 4L4 18H7L8 15H14L15 18H18L13 4H9Z M9 12L11 6L13 12H9Z" fill="currentColor" />
              </svg>
              <svg v-else-if="provider.iconKey === 'openai'" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6" />
                <path d="M8 12C9 10 11 10 12 12C13 14 15 14 16 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <svg v-else-if="provider.iconKey === 'openrouter'" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12H20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                <path d="M4 12L9 7M4 12L9 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M20 12L15 7M20 12L15 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.6" />
                <circle cx="9" cy="10" r="1" fill="currentColor" />
                <circle cx="15" cy="10" r="1" fill="currentColor" />
                <path d="M9 15C10 16 14 16 15 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <div class="map-row-text">
              <span class="map-row-title">
                {{ provider.name }}
                <span v-if="provider.italic" class="map-row-italic">{{ provider.italic }}</span>
              </span>
              <span class="map-row-hint">{{ provider.caption }}</span>
            </div>
            <div class="map-pill">{{ t('mobile.settingsAiProviders.connect') }}</div>
          </button>
          <div v-if="idx < availableProviders.length - 1" class="map-divider" />
        </template>
      </div>

      <!-- Vault note -->
      <div class="map-vault-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.6" />
          <path d="M8 11V8C8 5.79 9.79 4 12 4C14.21 4 16 5.79 16 8V11" stroke="currentColor" stroke-width="1.6" />
        </svg>
        <span class="map-vault-text">
          {{ t('mobile.settingsAiProviders.vaultLine1') }}<br>
          {{ t('mobile.settingsAiProviders.vaultLine2') }}
        </span>
      </div>

      <div class="map-spacer" />
    </div>

    <!-- Key entry sheet -->
    <Transition name="map-sheet">
      <div v-if="sheetOpen" class="map-sheet-backdrop" @click.self="closeSheet">
        <div class="map-sheet" role="dialog" aria-modal="true">
          <div class="map-sheet-grab" />
          <div class="map-sheet-eyebrow">{{ sheetMode === 'rotate' ? t('mobile.settingsAiProviders.sheetEyebrowRotate') : t('mobile.settingsAiProviders.sheetEyebrowConnect') }}</div>
          <h2 class="map-sheet-title">{{ sheetTitle }}<span class="map-sheet-title-dot">.</span></h2>
          <p class="map-sheet-meta">
            {{ t('mobile.settingsAiProviders.sheetMeta') }}
          </p>

          <label class="map-sheet-field">
            <span class="map-sheet-label">{{ t('mobile.settingsAiProviders.fieldApiKey') }}</span>
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
                :aria-label="sheetReveal ? t('mobile.settingsAiProviders.hideKey') : t('mobile.settingsAiProviders.showKey')"
                @click="sheetReveal = !sheetReveal"
              >
                <svg v-if="sheetReveal" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 3L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path d="M10.6 6.2C11.06 6.07 11.53 6 12 6C18 6 22 12 22 12C21.4 13 20.7 14 19.9 14.8M14 14.2C13.45 14.7 12.75 15 12 15C10.34 15 9 13.66 9 12C9 11.25 9.3 10.55 9.8 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path d="M6.5 7.5C3.6 9.4 2 12 2 12C2 12 6 18 12 18C13.36 18 14.62 17.74 15.74 17.32" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2 12C2 12 6 6 12 6C18 6 22 12 22 12C22 12 18 18 12 18C6 18 2 12 2 12Z" stroke="currentColor" stroke-width="1.6" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6" />
                </svg>
              </button>
            </div>
            <span v-if="keyError && keySaving === sheetType" class="map-sheet-error">{{ keyError }}</span>
            <span v-else class="map-sheet-hint">{{ t('mobile.settingsAiProviders.vaulted') }} · AES-256-GCM</span>
          </label>

          <div class="map-sheet-actions">
            <button class="map-sheet-btn" type="button" @click="closeSheet">{{ t('mobile.settingsAiProviders.cancel') }}</button>
            <button
              class="map-sheet-btn map-sheet-btn--primary"
              type="button"
              :disabled="!sheetKey.trim() || keySaving === sheetType"
              @click="saveSheet"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ keySaving === sheetType ? t('mobile.settingsAiProviders.saving') : t('mobile.settingsAiProviders.saveKey') }}</span>
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
/* The reset above kills the UA ring — restore keyboard focus visibility
   per base.css grammar (REDESIGN.md §1); text inputs keep the
   focus-within border grammar instead. */
.map button:focus-visible,
.map select:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 2px;
}
.map {
  --map-bg: var(--nc-bg);
  --map-ink: var(--nc-ink);
  --map-body: var(--nc-ink-soft);
  --map-mute: var(--nc-ink-faint);
  --map-mint: var(--nc-accent);
  --map-surface: var(--nc-chip-bg);
  --map-stroke: var(--nc-border);
  --map-stroke-soft: var(--nc-border-subtle);

  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--map-bg);
  color: var(--map-ink);
  font-family: var(--nc-font-body);
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
  min-height: 44px;
  padding: 4px 4px 4px 0;
  background: none; border: none; cursor: pointer;
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--map-body);
}
.map-back svg { color: var(--nc-text-muted); }
/* Vault chip — chip grammar (REDESIGN.md §5): chip fill + hairline + accent text */
.map-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--map-stroke);
}
.map-live-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--map-mint);
  animation: map-pulse 2.4s ease-in-out infinite;
}
@keyframes map-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@media (prefers-reduced-motion: reduce) {
  .map-live-dot { animation: none; }
}
.map-live-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--nc-accent-text);
}

/* Hero */
.map-hero {
  display: flex; flex-direction: column;
  padding: 18px 20px 0 20px;
  flex-shrink: 0;
}
.map-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.map-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0;
}
.map-hero-sans {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--map-ink);
}
.map-hero-serif {
  font-family: var(--nc-font-serif);
  font-style: italic; font-weight: 400;
  font-size: calc(46px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--nc-accent-text);
}
.map-hero-meta {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 20px;
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
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.map-section-status {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--map-mute);
}
.map-section-status--mint { color: var(--nc-accent-text); }

/* Empty state — dashed survey frame is sanctioned for empty states (§5) */
.map-empty {
  display: flex; flex-direction: column; gap: 4px;
  padding: 18px;
  background: var(--map-surface);
  border: 1px dashed var(--map-stroke);
  border-radius: 0.5rem;
}
.map-empty-title {
  font-family: var(--nc-font-serif);
  font-style: italic; font-size: calc(18px * var(--nc-text-scale, 1)); color: var(--map-ink);
}
.map-empty-sub {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--map-mute);
}

/* Active provider card */
.map-active-card {
  display: flex; flex-direction: column; gap: 13px;
  padding: 15px;
  background: rgba(var(--nc-accent-rgb), 0.04);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.22);
  border-radius: 0.5rem;
}
.map-active-top { display: flex; align-items: center; gap: 12px; }
.map-prov-tile {
  width: 36px; height: 36px;
  border-radius: 0.4rem;
  display: flex; align-items: center; justify-content: center;
  background: rgba(var(--nc-accent-rgb), 0.10);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.28);
  color: var(--nc-accent-text);
  flex-shrink: 0;
}
.map-prov-tile--lg { width: 44px; height: 44px; border-radius: 0.4rem; }
.map-active-info {
  display: flex; flex-direction: column; gap: 3px;
  flex: 1 1 0; min-width: 0;
}
.map-active-titlebar { display: flex; align-items: baseline; gap: 8px; }
.map-active-title {
  font-family: var(--nc-font-body);
  font-weight: 600; font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 20px;
  letter-spacing: -0.01em; color: var(--map-ink);
}
/* Primary marker — mono micro-label (serif italic is reserved for page titles) */
.map-active-italic {
  font-family: var(--nc-font-mono);
  font-style: normal; font-weight: 500;
  font-size: calc(10px * var(--nc-text-scale, 1));
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--nc-accent-text);
}
.map-active-sub {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--map-mute);
}
.map-status-pill {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--map-stroke);
  flex-shrink: 0;
}
.map-status-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--map-mint);
}
.map-status-text {
  font-family: var(--nc-font-mono);
  font-weight: 600; font-size: calc(9px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--nc-accent-text);
}
.map-status-pill--cta {
  cursor: pointer;
  background: var(--map-mint);
  border-color: var(--map-mint);
  transition: transform 120ms var(--nc-ease);
}
/* Vertical hit-area extension to reach the 44px minimum */
.map-status-pill--cta::before {
  content: '';
  position: absolute;
  inset: -11px 0;
}
.map-status-pill--cta:active { transform: scale(0.97); }
.map-status-pill--cta .map-status-text { color: var(--nc-bg); }

.map-stats { display: flex; gap: 12px; }
.map-stat {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1 1 0; min-width: 0;
}
.map-stat-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(9px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-stat-value {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); color: var(--map-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.map-stat-value--ok { color: var(--nc-accent-text); }
.map-stat-divider { width: 1px; background: var(--map-stroke-soft); }

.map-model-row {
  display: flex; flex-direction: column; gap: 8px;
}
.map-model-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(9px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--map-mute);
}
.map-model-pills {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.map-model-pill {
  position: relative;
  flex: 0 0 auto;
  padding: 6px 10px;
  background: var(--map-surface);
  border: 1px solid var(--map-stroke);
  border-radius: 999px;
  cursor: pointer;
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); letter-spacing: -0.005em;
  color: var(--map-body);
  white-space: nowrap;
  transition: background-color 120ms var(--nc-ease), border-color 120ms var(--nc-ease), color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
}
/* Vertical hit-area extension to reach the 44px minimum */
.map-model-pill::before {
  content: '';
  position: absolute;
  inset: -8px 0;
}
.map-model-pill:active:not(:disabled) { transform: scale(0.97); }
.map-model-pill--on {
  background: rgba(var(--nc-accent-rgb), 0.10);
  border-color: rgba(var(--nc-accent-rgb), 0.45);
  color: var(--nc-accent-text);
  font-weight: 600;
}
.map-model-pill--soon {
  opacity: 0.45;
  cursor: not-allowed;
}

.map-test-result {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-radius: 0.4rem;
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.02em;
  line-height: 14px;
}
.map-test-result--ok {
  background: rgba(var(--nc-accent-rgb), 0.10);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.30);
  color: var(--nc-accent-text);
}
/* Validation errors are coral (REDESIGN.md §1) */
.map-test-result--err {
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.30);
  color: var(--nc-coral);
}

.map-actions { display: flex; gap: 8px; }
.map-action {
  position: relative;
  flex: 1 1 0;
  padding: 10px;
  background: var(--map-surface);
  border: 1px solid var(--map-stroke);
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: var(--nc-font-mono);
  font-weight: 600; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.10em;
  color: var(--map-body);
  text-align: center;
  transition: background-color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
}
/* Vertical hit-area extension to reach the 44px minimum */
.map-action::before {
  content: '';
  position: absolute;
  inset: -4px 0;
}
.map-action:active:not(:disabled) { transform: scale(0.97); background: var(--nc-surface-3); }
.map-action:disabled { opacity: 0.45; cursor: not-allowed; }
.map-action--primary {
  background: rgba(var(--nc-accent-rgb), 0.10);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.28);
  color: var(--nc-accent-text);
}

/* Available card */
.map-card {
  background: var(--map-surface);
  border: 1px solid var(--map-stroke-soft);
  border-radius: 0.5rem;
  overflow: hidden;
}
.map-row {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: transparent; border: none;
  cursor: pointer; text-align: left;
  font-family: inherit; color: inherit;
  transition: background-color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.map-row:active { background: var(--nc-surface-3); transform: scale(0.97); }
.map-icon {
  width: 36px; height: 36px;
  border-radius: 0.4rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--map-stroke-soft);
  color: var(--nc-text-muted);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.map-row-text {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1 1 0; min-width: 0;
}
.map-row-title {
  font-family: var(--nc-font-body);
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em; color: var(--map-ink);
}
/* Aside note — mono micro-label (serif italic is reserved for page titles) */
.map-row-italic {
  font-family: var(--nc-font-mono);
  font-style: normal; font-weight: 500;
  font-size: calc(10px * var(--nc-text-scale, 1));
  letter-spacing: 0.06em;
  color: var(--nc-text-dim);
  margin-left: 4px;
}
.map-row-hint {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--map-mute);
}
.map-pill {
  padding: 5px 10px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--map-stroke);
  border-radius: 999px;
  font-family: var(--nc-font-mono);
  font-weight: 600; font-size: calc(9px * var(--nc-text-scale, 1)); letter-spacing: 0.10em;
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
  border-radius: 0.5rem;
  color: var(--nc-text-muted);
}
.map-vault-text {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.04em;
  color: var(--map-body);
}

.map-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}

/* Key entry sheet — flat scrim (no blur in chrome, REDESIGN.md §5) */
.map-sheet-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: flex-end;
  justify-content: center;
  padding-bottom: var(--kbd-h, 0px);
  transition: padding-bottom 220ms var(--nc-ease);
  z-index: 100;
}
/* Flat surface-2 + hairline top (REDESIGN.md sheet grammar) */
.map-sheet {
  width: 100%;
  display: flex; flex-direction: column;
  /* Extra bottom space so the Save button clears the fixed tab dock (~76px). */
  padding: 14px 20px calc(28px + 76px + env(safe-area-inset-bottom, 0px)) 20px;
  background: var(--nc-surface-2);
  border-top: 1px solid var(--map-stroke);
  border-radius: 0.5rem 0.5rem 0 0;
}
/* Drag handle in --nc-border color */
.map-sheet-grab {
  align-self: center;
  width: 40px; height: 4px; border-radius: 999px;
  background: var(--nc-border);
  margin-bottom: 18px;
}
.map-sheet-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.map-sheet-title {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(28px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--map-ink);
  margin: 10px 0 0 0;
}
/* Accent dot — inherits display face; serif never in sheets (REDESIGN.md §4) */
.map-sheet-title-dot {
  color: var(--nc-accent-text);
  margin-left: 2px;
}
.map-sheet-meta {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 19px;
  color: var(--map-body);
  margin: 8px 0 18px 0;
}
.map-sheet-field {
  display: flex; flex-direction: column; gap: 8px;
}
.map-sheet-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--map-mute);
}
/* Input grammar: chip fill + hairline, accent focus border only */
.map-sheet-input-wrap {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--map-stroke);
  border-radius: 0.5rem;
  transition: border-color 150ms var(--nc-ease);
}
.map-sheet-input-wrap:focus-within { border-color: var(--nc-accent); }
.map-sheet-input {
  flex: 1 1 0;
  background: none; border: none;
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(13px * var(--nc-text-scale, 1)); letter-spacing: 0.02em;
  color: var(--map-ink);
  outline: none;
  min-width: 0;
}
.map-sheet-input::placeholder { color: var(--nc-text-dim); }
.map-sheet-reveal {
  position: relative;
  background: none; border: none; cursor: pointer;
  padding: 4px;
  color: var(--nc-text-muted);
  display: flex; align-items: center; justify-content: center;
}
/* Expand hit area to the 44px minimum */
.map-sheet-reveal::before {
  content: '';
  position: absolute;
  inset: -10px;
}
.map-sheet-hint {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(9px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--map-mute);
}
/* Validation errors are coral (REDESIGN.md §1) */
.map-sheet-error {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--nc-coral);
}
.map-sheet-actions {
  display: flex; gap: 10px;
  margin-top: 22px;
}
.map-sheet-btn {
  flex: 1 1 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--map-stroke);
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: var(--nc-font-mono);
  font-weight: 600; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.10em;
  color: var(--map-body);
  transition: background-color 120ms var(--nc-ease), border-color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.map-sheet-btn:active:not(:disabled) { transform: scale(0.97); }
.map-sheet-btn--primary {
  flex: 2 1 0;
  background: var(--map-mint);
  border-color: var(--map-mint);
  color: var(--nc-bg);
}
.map-sheet-btn--primary:disabled {
  opacity: 0.45; cursor: not-allowed;
}
.map-sheet-btn--primary:active:not(:disabled) {
  background: var(--nc-accent-dark);
  border-color: var(--nc-accent-dark);
}

/* Sheet motion — 200-280ms, single ease, percent-based translateY */
.map-sheet-enter-active, .map-sheet-leave-active {
  transition: opacity 200ms var(--nc-ease);
}
.map-sheet-enter-active .map-sheet, .map-sheet-leave-active .map-sheet {
  transition: transform 280ms var(--nc-ease);
}
.map-sheet-enter-from, .map-sheet-leave-to { opacity: 0; }
.map-sheet-enter-from .map-sheet, .map-sheet-leave-to .map-sheet {
  transform: translateY(100%);
}
@media (prefers-reduced-motion: reduce) {
  .map-sheet-enter-active .map-sheet, .map-sheet-leave-active .map-sheet {
    transition: none;
  }
}
</style>
