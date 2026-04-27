<script setup lang="ts">
import type { Template, TemplateCategory } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import { useMapRenderer } from '~/composables/useMapRenderer'
import { useDatabase } from '~/composables/useDatabase'

definePageMeta({
  layout: false,
  middleware: 'auth',
})

const router = useRouter()
const { t } = useI18n()

// Tauri detection
const _isTauri = import.meta.client && typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
const desktopAuth = _isTauri ? useDesktopAuth() : null
const isDesktopSignedIn = computed(() => !!desktopAuth?.isSignedIn.value)

const {
  templates,
  myTemplates,
  loading,
  filters,
  fetchTemplates,
  fetchMyTemplates,
  setCategory,
  setSearch,
  setSortBy,
} = useTemplates()

const showPublishModal = ref(false)
const aiPrompt = ref('')
const aiGenerating = ref(false)
const aiError = ref<string | null>(null)
const searchQuery = ref('')

const mapStore = useMapStore()
const mapRenderer = useMapRenderer()
const db = useDatabase()

const categories = computed<Array<{ value: TemplateCategory | 'all' | 'my'; label: string }>>(() => [
  { value: 'all', label: t('templates.filter.all') },
  { value: 'education', label: t('templates.filter.education') },
  { value: 'business', label: t('templates.filter.business') },
  { value: 'creative', label: t('templates.filter.creative') },
  { value: 'planning', label: t('templates.filter.planning') },
  { value: 'research', label: t('templates.filter.research') },
  { value: 'my', label: t('templates.filter.my_templates') },
])

const activeCategory = ref<string>('all')
const sortBy = ref('popular')
const sortOptions = computed(() => [
  { value: 'popular', label: t('templates.filter.popular') },
  { value: 'newest', label: t('templates.filter.newest') },
  { value: 'alphabetical', label: t('templates.filter.a_z') },
])

const displayedTemplates = computed(() => {
  if (activeCategory.value === 'my') return myTemplates.value ?? []
  return templates.value ?? []
})

function handleCategoryChange(cat: string) {
  activeCategory.value = cat
  if (cat === 'my') {
    filters.myTemplates = true
    fetchMyTemplates()
  } else {
    filters.myTemplates = false
    setCategory(cat as TemplateCategory | 'all')
  }
}

function handleSortChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  sortBy.value = val
  setSortBy(val as any)
}

let searchDebounce: ReturnType<typeof setTimeout>
function handleSearch() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    setSearch(searchQuery.value)
  }, 300)
}

function handleCardClick(template: Template) {
  router.push(`/templates/${template.slug}`)
}

function handlePublish(payload: any) {
  // Will be handled by the modal
  showPublishModal.value = false
}

async function handleAIGenerate() {
  if (!aiPrompt.value.trim() || aiGenerating.value) return
  aiGenerating.value = true
  try {
    // 1. Call server-side AI generation (bypasses client-side vault)
    const result = await $fetch<{ structure: any }>('/api/templates/generate', {
      method: 'POST',
      body: { topic: aiPrompt.value.trim() },
    })

    // 2. Render into a temporary map to get nodes/edges
    mapStore.newDocument()
    mapStore.setTitle(aiPrompt.value)
    mapRenderer.renderMapStructure(result.structure, { x: 0, y: 0 })
    const doc = mapStore.toSerializable()

    // 3. Convert arrays to records (server expects Record<string, any>)
    const nodesRecord: Record<string, any> = {}
    for (const node of doc.nodes) {
      nodesRecord[node.id] = node
    }
    const edgesRecord: Record<string, any> = {}
    for (const edge of doc.edges) {
      edgesRecord[edge.id] = edge
    }

    // 4. Publish as template with inline data (map is in IndexedDB, not server DB)
    const { publishTemplate } = useTemplates()
    await publishTemplate({
      title: aiPrompt.value,
      description: `AI-generated template: ${aiPrompt.value}`,
      category: 'creative',
      tags: ['ai-generated'],
      aiEnhanced: true,
      nodes: nodesRecord,
      edges: edgesRecord,
      settings: doc.settings,
    })

    aiPrompt.value = ''
    await fetchTemplates()
  } catch (e: any) {
    const msg = e?.data?.statusMessage || e?.message || ''
    aiError.value = msg.includes('Session expired')
      ? msg
      : msg.includes('No AI provider')
        ? 'Please add an API key in Settings > AI Providers first.'
        : msg.includes('decrypt')
          ? 'API key issue. Try removing and re-adding your key in Settings.'
          : `Failed to generate. ${msg || 'Check your AI settings and try again.'}`
  } finally {
    aiGenerating.value = false
  }
}

onMounted(async () => {
  if (_isTauri && isDesktopSignedIn.value) {
    // Fetch from remote server using Tauri HTTP plugin (has auth cookies)
    try {
      const data = await desktopAuth!.remoteFetch<{ templates: Template[]; total: number }>('/api/templates?sortBy=popular')
      templates.value = data.templates
    } catch {
      // Fall back to empty state — server unreachable
      templates.value = []
    }
  } else {
    fetchTemplates()
  }
})
</script>

<template>
  <div class="templates-layout">
    <AppSidebar active-nav="templates" />

    <main class="templates-main">
      <!-- Header -->
      <div class="templates-header">
        <div class="header-left">
          <h1 class="page-title">{{ $t('templates.page.title') }}</h1>
          <p class="page-subtitle">{{ $t('templates.page.subtitle') }}</p>
        </div>
        <button v-if="!_isTauri" class="publish-btn" @click="showPublishModal = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {{ $t('templates.buttons.publish_template') }}
        </button>
      </div>

      <!-- Desktop sign-in prompt (Tauri, not signed in) -->
      <div v-if="_isTauri && !isDesktopSignedIn" class="desktop-signin-prompt">
        <div class="prompt-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
        </div>
        <div class="prompt-text">
          <span class="prompt-title">{{ $t('templates.desktop_signin.title') }}</span>
          <span class="prompt-desc">{{ $t('templates.desktop_signin.description') }}</span>
        </div>
        <button class="prompt-signin-btn" @click="desktopAuth?.signIn()">
          {{ $t('templates.desktop_signin.sign_in') }}
        </button>
      </div>

      <!-- AI Generate Bar (hide on Tauri — requires server) -->
      <div v-if="!_isTauri" class="ai-bar">
        <div class="ai-bar-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
          </svg>
        </div>
        <div class="ai-bar-text">
          <span class="ai-bar-title">{{ $t('templates.ai_bar.title') }}</span>
          <span class="ai-bar-desc">{{ $t('templates.ai_bar.description') }}</span>
        </div>
        <div class="ai-bar-input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            v-model="aiPrompt"
            type="text"
            class="ai-bar-input"
            :placeholder="$t('templates.ai_bar.example')"
            @keydown.enter="handleAIGenerate"
          >
        </div>
        <button class="ai-generate-btn" :disabled="!aiPrompt.trim() || aiGenerating" @click="handleAIGenerate">
          <svg v-if="!aiGenerating" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
          </svg>
          <div v-else class="btn-spinner" />
          {{ aiGenerating ? $t('templates.ai_bar.generating') : $t('templates.ai_bar.generate') }}
        </button>
      </div>
      <div v-if="aiError && !_isTauri" class="ai-error-banner">
        <span class="i-lucide-alert-triangle ai-error-icon" />
        <span class="ai-error-text">{{ aiError }}</span>
        <button class="ai-error-dismiss" @click="aiError = null">
          <span class="i-lucide-x" />
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="category-tabs">
          <button
            v-for="cat in categories"
            :key="cat.value"
            :class="['cat-tab', { active: activeCategory === cat.value }]"
            @click="handleCategoryChange(cat.value)"
          >
            {{ cat.label }}
          </button>
        </div>

        <div class="filter-right">
          <div class="search-box">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              class="search-input"
              :placeholder="$t('templates.filter.search_placeholder')"
              @input="handleSearch"
            >
          </div>
          <div class="sort-wrap">
            <select v-model="sortBy" class="sort-select" @change="handleSortChange">
              <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Templates Grid -->
      <div v-if="loading && displayedTemplates.length === 0" class="loading-state">
        <div class="spinner" />
        <span>{{ $t('templates.loading') }}</span>
      </div>

      <div v-else-if="displayedTemplates.length === 0" class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 3v18" />
        </svg>
        <p>{{ $t('templates.empty_state.title') }}</p>
        <span>{{ $t('templates.empty_state.description') }}</span>
      </div>

      <div v-else class="templates-grid">
        <TemplatesTemplateCard
          v-for="tmpl in displayedTemplates"
          :key="tmpl.id"
          :template="tmpl"
          @click="handleCardClick"
        />
      </div>
    </main>

    <!-- Publish Modal (web only) -->
    <TemplatesPublishTemplateModal
      v-if="!_isTauri"
      :open="showPublishModal"
      @close="showPublishModal = false"
      @publish="handlePublish"
    />
  </div>
</template>

<style scoped>
.templates-layout {
  display: flex;
  min-height: 100vh;
  background: var(--tpl-bg, #0D0D0F);
}

.templates-main {
  flex: 1;
  padding: 32px 40px;
  min-width: 0;
  overflow-y: auto;
  max-height: 100vh;
}

/* Header */
.templates-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--tpl-text, #E8E8EC);
  margin: 0;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  color: var(--tpl-muted, #71717A);
  margin: 4px 0 0;
}

.publish-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: none;
  border: 1px solid #00D2BE;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #00D2BE;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.publish-btn:hover {
  background: rgba(0, 210, 190, 0.08);
}

/* AI Bar */
.ai-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: rgba(0, 210, 190, 0.06);
  border: 1px solid rgba(0, 210, 190, 0.12);
  border-radius: 12px;
  margin-bottom: 20px;
}

.ai-bar-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(0, 210, 190, 0.15);
  color: #00D2BE;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ai-bar-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex-shrink: 0;
}

.ai-bar-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--tpl-text, #E8E8EC);
}

.ai-bar-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: var(--tpl-muted, #71717A);
}

.ai-bar-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--tpl-surface, #111113);
  border: 1px solid var(--tpl-border, #1A1A1E);
  border-radius: 8px;
  color: var(--tpl-muted, #71717A);
}

.ai-bar-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--tpl-text, #E8E8EC);
}

.ai-bar-input::placeholder {
  color: var(--tpl-muted, #52525B);
}

.ai-generate-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #00D2BE;
  border: none;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #09090B;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.ai-generate-btn:hover {
  opacity: 0.9;
}

.ai-generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-error-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 20px 0;
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  color: #f87171;
  font-size: 13px;
  line-height: 1.4;
}

.ai-error-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 1px;
}

.ai-error-text {
  flex: 1;
}

.ai-error-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #f87171;
  cursor: pointer;
  padding: 0;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.ai-error-dismiss:hover {
  opacity: 1;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(9, 9, 11, 0.3);
  border-top-color: #09090B;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.category-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.cat-tab {
  padding: 6px 14px;
  border: 1px solid var(--tpl-border, #1A1A1E);
  border-radius: 8px;
  background: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--tpl-secondary, #A1A1AA);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.cat-tab:hover {
  color: var(--tpl-text, #E8E8EC);
  border-color: var(--tpl-border-hover, #2A2A30);
}

.cat-tab.active {
  background: #00D2BE;
  border-color: #00D2BE;
  color: #09090B;
  font-weight: 600;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--tpl-surface, #111113);
  border: 1px solid var(--tpl-border, #1A1A1E);
  border-radius: 8px;
  color: var(--tpl-muted, #71717A);
}

.search-input {
  background: none;
  border: none;
  outline: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--tpl-text, #E8E8EC);
  width: 140px;
}

.search-input::placeholder {
  color: var(--tpl-muted, #52525B);
}

.sort-wrap {
  position: relative;
}

.sort-select {
  padding: 6px 28px 6px 12px;
  background: var(--tpl-surface, #111113);
  border: 1px solid var(--tpl-border, #1A1A1E);
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--tpl-text, #E8E8EC);
  appearance: none;
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.sort-select option {
  background: #111113;
  color: #E8E8EC;
}

/* Grid */
.templates-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

/* Loading + Empty */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: var(--tpl-muted, #71717A);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
}

.empty-state svg {
  color: var(--tpl-border, #2A2A30);
}

.empty-state p {
  margin: 0;
  font-weight: 500;
  color: var(--tpl-text, #E8E8EC);
}

.empty-state span {
  font-size: 13px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--tpl-border, #1A1A1E);
  border-top-color: #00D2BE;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Desktop sign-in prompt */
.desktop-signin-prompt {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: rgba(0, 210, 190, 0.04);
  border: 1px solid rgba(0, 210, 190, 0.1);
  border-radius: 12px;
  margin-bottom: 20px;
}

.prompt-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(0, 210, 190, 0.1);
  color: #00D2BE;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.prompt-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.prompt-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--tpl-text, #E8E8EC);
}

.prompt-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: var(--tpl-muted, #71717A);
}

.prompt-signin-btn {
  padding: 8px 20px;
  background: #00D2BE;
  border: none;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #09090B;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.prompt-signin-btn:hover {
  opacity: 0.9;
}

/* Light theme */
:root.light .templates-layout {
  --tpl-bg: #F5F5F3;
  --tpl-surface: #FFFFFF;
  --tpl-border: #E8E8E6;
  --tpl-border-hover: #D4D4D2;
  --tpl-text: #111111;
  --tpl-secondary: #71717A;
  --tpl-muted: #71717A;
}

:root.light .ai-bar {
  background: rgba(0, 210, 190, 0.04);
  border-color: rgba(0, 210, 190, 0.1);
}

:root.light .sort-select option,
:root.light .ai-bar-input-wrap {
  background: #FFFFFF;
}

/* Laptop */
@media (max-width: 1366px) {
  .templates-main { padding: 28px 32px; }
  .templates-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Tablet */
@media (max-width: 1024px) {
  .templates-grid { grid-template-columns: repeat(2, 1fr); }
  .ai-bar-text { display: none; }
}

/* Mobile */
@media (max-width: 768px) {
  .templates-layout { flex-direction: column; }
  .templates-main { padding: 20px 16px; max-height: none; }
  .templates-header { flex-direction: column; gap: 12px; }
  .templates-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .filter-bar { flex-direction: column; align-items: flex-start; }
  .filter-right { width: 100%; }
  .search-input { width: 100%; }
  .ai-bar { flex-wrap: wrap; }
  .ai-bar-input-wrap { min-width: 200px; }
}

@media (max-width: 480px) {
  .templates-grid { grid-template-columns: 1fr; }
}
</style>
