<script setup lang="ts">
import type { Template, TemplateCategory } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import { useMapRenderer } from '~/composables/useMapRenderer'
import { useDatabase } from '~/composables/useDatabase'
import { resolveAvatarInitials } from '~/utils/userDisplay'

definePageMeta({
  layout: false,
  middleware: 'auth',
})

const router = useRouter()
const { t } = useI18n()
const { isMobile } = usePlatform()
useBodyScrollLock()
const _session = useAuth()
// Resolve the user the SAME way as dashboard/settings so the avatar (image +
// initials) is identical on every screen. On native the web session is empty;
// the real user lives on mobileAuth/desktopAuth.
const _user = computed(() => {
  if (_isTauri && desktopAuth?.isSignedIn.value && desktopAuth.user.value) {
    return desktopAuth.user.value as { name?: string | null; email?: string | null; image?: string | null }
  }
  if (_isCapacitor && mobileAuth?.isSignedIn.value && mobileAuth.user.value) {
    return mobileAuth.user.value as { name?: string | null; email?: string | null; image?: string | null }
  }
  return _session.data?.value?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined
})
const _userInitials = computed(() => resolveAvatarInitials(_user.value))

function handleMobileUseTemplate(tmpl: { slug: string }) {
  router.push(`/templates/${tmpl.slug}`)
}

// Tauri / Capacitor detection
const _isTauri = import.meta.client && typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
const _isCapacitor = import.meta.client && typeof window !== 'undefined' && 'Capacitor' in window && !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
const desktopAuth = _isTauri ? useDesktopAuth() : null
const mobileAuth = _isCapacitor ? useMobileAuth() : null
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

async function onTemplatePublished() {
  showPublishModal.value = false
  await fetchTemplates()
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
    <MobileTabBar />

    <main class="templates-main">
      <!-- Mobile Templates (Paper G7R-0 / GPV-0) — only the list scrolls -->
      <ClientOnly>
        <MobileTemplatesDark
          v-if="isMobile"
          :user="_user"
          :user-initials="_userInitials"
          :templates="displayedTemplates"
          :total-count="(templates ?? []).length"
          :search-query="searchQuery"
          :sort-label="sortBy"
          :active-category="(activeCategory as unknown as ('all' | TemplateCategory))"
          @update:search-query="(v) => { searchQuery = v; handleSearch() }"
          @open-template="(slug) => router.push(`/templates/${slug}`)"
          @use-template="handleMobileUseTemplate"
          @change-sort="sortBy = sortBy === 'popular' ? 'newest' : sortBy === 'newest' ? 'alphabetical' : 'popular'; setSortBy(sortBy as any)"
          @change-category="(c) => handleCategoryChange(c)"
        />
      </ClientOnly>

      <template v-if="!isMobile">
      <!-- Mobile brand bar + page title -->
      <div class="m-top">
        <NuxtLink to="/dashboard" class="m-brand">
          <NcLogo :size="14" :container-size="24" :radius="6" />
          <span>NeuroCanvas</span>
        </NuxtLink>
        <NuxtLink to="/settings" class="m-avatar-link" aria-label="Settings">
          <div class="m-avatar">V</div>
        </NuxtLink>
      </div>
      <h1 class="m-page-title">{{ $t('templates.page.title') }}</h1>

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
      </template> <!-- /v-if="!isMobile" -->
    </main>

    <!-- Publish Modal (web only) -->
    <TemplatesPublishTemplateModal
      v-if="!_isTauri"
      :open="showPublishModal"
      @close="showPublishModal = false"
      @published="onTemplatePublished"
    />
  </div>
</template>

<style scoped>
.templates-layout {
  display: flex;
  min-height: 100vh;
  background: var(--nc-bg);
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

/* Page title = display 700 (REDESIGN.md §4) */
.page-title {
  font-family: var(--nc-font-display);
  font-size: calc(24px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-text);
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.page-subtitle {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  margin: 4px 0 0;
}

/* Primary CTA = ink pill (REDESIGN.md §5) */
.publish-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: var(--nc-text);
  border: none;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-bg);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.publish-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .publish-btn:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

/* AI Bar — accent-tinted flat panel, hairline, radius 8px */
.ai-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: rgba(var(--nc-accent-rgb), 0.05);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.16);
  border-radius: var(--nc-radius-md);
  margin-bottom: 20px;
}

.ai-bar-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--nc-radius-md);
  background: rgba(var(--nc-accent-rgb), 0.12);
  color: var(--nc-accent);
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
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
}

.ai-bar-desc {
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}

/* Input grammar: chip fill, hairline, focus = accent border ONLY */
.ai-bar-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  color: var(--nc-text-muted);
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.ai-bar-input-wrap:focus-within {
  border-color: var(--nc-accent);
}

.ai-bar-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text);
}

.ai-bar-input::placeholder {
  color: var(--nc-text-dim);
}

/* AI-flavored CTA = accent pill (NcButton "ai" variant) */
.ai-generate-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: var(--nc-accent);
  border: none;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-bg);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.ai-generate-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .ai-generate-btn:hover {
    background: var(--nc-accent-light);
    transform: translateY(-1px);
  }
}

.ai-generate-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

/* Errors are coral (REDESIGN.md §1) */
.ai-error-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 20px 0;
  padding: 10px 12px;
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.25);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-coral);
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  color: var(--nc-coral);
  cursor: pointer;
  padding: 0;
  opacity: 0.6;
  transition: opacity var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .ai-error-dismiss:hover {
    opacity: 1;
  }
}

/* Spinner ink = bg color (sits on the accent pill) */
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(var(--nc-bg-rgb), 0.3);
  border-top-color: var(--nc-bg);
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

/* Category tabs — mono uppercase micro-labels (REDESIGN.md §4);
   active = accent text + 2px marker edge, never color alone. */
.cat-tab {
  position: relative;
  padding: 7px 14px;
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  background: none;
  font-family: var(--nc-font-mono);
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
  white-space: nowrap;
}

.cat-tab:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .cat-tab:hover {
    color: var(--nc-text);
    border-color: var(--nc-border-active);
  }
}

.cat-tab.active {
  color: var(--nc-accent);
  border-color: rgba(var(--nc-accent-rgb), 0.45);
}

.cat-tab.active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 3px;
  height: 2px;
  background: var(--nc-accent);
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
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  color: var(--nc-text-muted);
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.search-box:focus-within {
  border-color: var(--nc-accent);
}

.search-input {
  background: none;
  border: none;
  outline: none;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  width: 140px;
}

.search-input::placeholder {
  color: var(--nc-text-dim);
}

/* Sort select — chip fill + hairline; chevron drawn with token hairlines
   (a data-URI glyph can't consume tokens). */
.sort-wrap {
  position: relative;
}

.sort-wrap::after {
  content: '';
  position: absolute;
  right: 11px;
  top: 50%;
  width: 6px;
  height: 6px;
  border-right: 1px solid var(--nc-text-muted);
  border-bottom: 1px solid var(--nc-text-muted);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}

.sort-select {
  padding: 6px 28px 6px 12px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  appearance: none;
  cursor: pointer;
  outline: none;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.sort-select:focus {
  border-color: var(--nc-accent);
}

.sort-select option {
  background: var(--nc-surface-2);
  color: var(--nc-text);
}

/* Focus discipline (REDESIGN.md §1) — inputs are border-only above */
.publish-btn:focus-visible,
.ai-generate-btn:focus-visible,
.ai-error-dismiss:focus-visible,
.cat-tab:focus-visible,
.prompt-signin-btn:focus-visible,
.m-brand:focus-visible,
.m-avatar-link:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
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
  color: var(--nc-text-secondary);
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
}

/* Survey-frame device (REDESIGN.md §5) — dashed hairline + coral corner
   marks, reserved for empty states. */
.empty-state {
  position: relative;
  border: 1px dashed var(--nc-border);
}

.empty-state::before,
.empty-state::after {
  content: '+';
  position: absolute;
  font-family: var(--nc-font-mono);
  font-size: 0.8rem;
  line-height: 1;
  color: var(--nc-coral);
}

.empty-state::before {
  top: 6px;
  left: 9px;
}

.empty-state::after {
  bottom: 6px;
  right: 9px;
}

.empty-state svg {
  color: var(--nc-text-dim);
}

.empty-state p {
  margin: 0;
  font-family: var(--nc-font-display);
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
}

.empty-state span {
  font-size: calc(13px * var(--nc-text-scale, 1));
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--nc-border);
  border-top-color: var(--nc-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Desktop sign-in prompt — accent-tinted flat panel */
.desktop-signin-prompt {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: rgba(var(--nc-accent-rgb), 0.04);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.12);
  border-radius: var(--nc-radius-md);
  margin-bottom: 20px;
}

.prompt-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--nc-radius-md);
  background: rgba(var(--nc-accent-rgb), 0.1);
  color: var(--nc-accent);
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
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
}

.prompt-desc {
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}

/* Ink pill (REDESIGN.md §5) */
.prompt-signin-btn {
  padding: 8px 20px;
  background: var(--nc-text);
  border: none;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-bg);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.prompt-signin-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .prompt-signin-btn:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */

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
/* Mobile brand bar + title (shown only on mobile) */
.m-top, .m-page-title { display: none; }

@media (max-width: 768px) {
  .templates-layout { flex-direction: column; }
  :deep(.sidebar) { display: none; }

  .templates-main {
    padding: 8px 20px calc(env(safe-area-inset-bottom, 0px) + 96px);
    max-height: none;
  }

  /* App bar */
  .m-top {
    display: flex; align-items: center; justify-content: space-between;
    height: 44px;
  }
  .m-brand {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--nc-font-display);
    font-size: calc(17px * var(--nc-text-scale, 1)); font-weight: 700; line-height: 22px;
    letter-spacing: -0.02em; color: var(--nc-text); margin: 0;
    text-decoration: none;
  }
  .m-avatar-link { display: flex; align-items: center; text-decoration: none; }
  .m-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--nc-surface-3); border: 1px solid var(--nc-border);
    color: var(--nc-accent);
    font-family: var(--nc-font-body);
    font-size: calc(13px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 16px;
    display: flex; align-items: center; justify-content: center;
  }

  /* Page title */
  .m-page-title {
    display: block;
    font-family: var(--nc-font-display);
    font-size: calc(28px * var(--nc-text-scale, 1)); font-weight: 700; line-height: 1.05;
    letter-spacing: -0.02em; color: var(--nc-text);
    margin: 12px 0 16px;
  }

  /* Hide desktop header bits on mobile */
  .templates-header,
  .desktop-signin-prompt,
  .ai-bar,
  .ai-error-banner { display: none; }

  /* Filter row: stack chips on top, search above */
  .filter-bar {
    display: flex; flex-direction: column; gap: 12px;
    margin: 0 0 12px; padding: 0;
  }
  .filter-right { width: 100%; order: -1; }
  .filter-right .search-box {
    display: flex; align-items: center; gap: 10px;
    width: 100%; height: auto;
    padding: 12px; border-radius: var(--nc-radius-md);
    background: var(--nc-chip-bg); border: 1px solid var(--nc-border);
  }
  .filter-right .search-box svg { color: var(--nc-text-muted); flex-shrink: 0; }
  .filter-right .search-input {
    flex: 1; width: 100%;
    background: none; border: none; outline: none;
    font-family: var(--nc-font-body);
    font-size: calc(15px * var(--nc-text-scale, 1)); line-height: 18px;
    color: var(--nc-text); padding: 0;
  }
  .filter-right .search-input::placeholder { color: var(--nc-text-dim); }
  .sort-wrap { display: none; }

  /* Category chips — 44px touch targets (REDESIGN.md §9) */
  .category-tabs {
    display: flex; gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .category-tabs::-webkit-scrollbar { display: none; }
  .cat-tab {
    flex-shrink: 0;
    min-height: 44px;
    padding: 8px 14px;
    background: var(--nc-chip-bg);
    border: 1px solid var(--nc-border);
    color: var(--nc-text-secondary);
  }
  .cat-tab.active {
    color: var(--nc-accent);
    border-color: rgba(var(--nc-accent-rgb), 0.45);
  }

  /* Template card list (single column) */
  .templates-grid {
    display: flex; flex-direction: column; gap: 10px;
    grid-template-columns: none;
    padding: 0;
  }

  /* iOS — search stays on the 8px input radius */
  :root.platform-ios .filter-right .search-box { border-radius: var(--nc-radius-md); }
  :root.platform-ios .templates-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 116px);
  }

  /* Android (MD3) — full pills */
  :root.platform-android .filter-right .search-box { border-radius: 999px; padding: 12px 16px; }
  :root.platform-android .cat-tab { border-radius: 999px; }
  :root.platform-android .templates-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
  }
}
</style>
