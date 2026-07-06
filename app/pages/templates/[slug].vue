<script setup lang="ts">
import type { GenerationDepth, GenerationStyle, TemplatePreviewData } from '~/types'
import { useAI } from '~/composables/useAI'
import { useDatabase } from '~/composables/useDatabase'
import { useMapRenderer } from '~/composables/useMapRenderer'
import { useMapStore } from '~/stores/mapStore'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { userFriendlyError } from '~/utils/userFriendlyError'
import NcAiMark from '~/components/ui/NcAiMark.vue'

definePageMeta({
  layout: false,
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const { t, locale: currentLocale } = useI18n()
const slug = route.params.slug as string

const {
  currentTemplate: template,
  loading,
  error,
  fetchTemplate,
  useTemplate,
} = useTemplates()

// Localized text for built-in templates (DB stores English only).
const builtin = useBuiltinTemplateText()
const displayTitle = computed(() => (template.value ? builtin.title(template.value) : ''))
const displayDescription = computed(() => (template.value ? builtin.description(template.value) : ''))

const ai = useAI()
const mapStore = useMapStore()
const mapRenderer = useMapRenderer()
const db = useDatabase()
const syncEngine = useSyncEngine()

// Tauri desktop is a SPA with no local /api server, so server-side $fetch calls
// must be skipped or routed through the desktop HTTP plugin.
const _isTauri = import.meta.client && typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

// useToast is auto-imported by Nuxt under normal conditions. Wrap in a guard
// so a brief window where the file does not yet exist (parallel agent) cannot
// crash the page — fall back to console.error and inline error state.
type ToastFn = (msg: string) => void
function safeToast(): { error: ToastFn; success: ToastFn; warning: ToastFn } {
  try {
    const t = typeof useToast === 'function' ? useToast() : null
    if (t) return { error: t.error, success: t.success, warning: t.warning }
  } catch {
    // ignore — fall through
  }
  const noop: ToastFn = (m) => console.warn('[adapt toast]', m)
  return { error: noop, success: noop, warning: noop }
}

const showAdaptModal = ref(false)
const adapting = ref(false)
const adaptProgress = ref<{ done: number; total: number } | null>(null)
const adaptError = ref<string | null>(null)

// Category hues come from the token palette only (REDESIGN.md §9 — never
// re-hardcode a palette in a component). Consumed via v-bind() in scoped CSS.
const categoryColors: Record<string, string> = {
  education: 'var(--nc-node-blue)',
  business: 'var(--nc-accent)',
  creative: 'var(--nc-node-orange)',
  planning: 'var(--nc-node-purple)',
  research: 'var(--nc-node-pink)',
}

const categoryColor = computed(() => categoryColors[template.value?.category ?? ''] || 'var(--nc-text-muted)')

const preview = computed(() => template.value?.previewData as TemplatePreviewData | null)

const authorInitial = computed(() => {
  const name = template.value?.author?.name || 'N'
  return name.charAt(0).toUpperCase()
})

const authorName = computed(() => template.value?.author?.name || 'NeuroCanvas')

const publishedDate = computed(() => {
  if (!template.value) return ''
  const d = new Date(template.value.createdAt)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return t('templates.detail.published_today')
  if (diff === 1) return t('templates.detail.published_yesterday')
  return t('templates.detail.published_days_ago', { days: diff })
})

const formattedUses = computed(() => {
  const count = template.value?.usageCount || 0
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(count)
})

async function handleUse() {
  if (!template.value) return
  try {
    const result = await useTemplate(template.value.slug)
    router.push(`/map/${result.mapId}`)
  } catch {
    // error shown via composable
  }
}

// Maps the user-picked GenerationDepth to AI map-structure shape params.
// - shallow: a flat single level, fewer branches
// - medium: one extra child layer
// - deep: two child layers
function depthToOptions(depth: GenerationDepth): { branchCount: number; maxDepth: number } {
  if (depth === 'shallow') return { branchCount: 4, maxDepth: 1 }
  if (depth === 'deep') return { branchCount: 6, maxDepth: 3 }
  return { branchCount: 5, maxDepth: 2 }
}

async function handleAdaptGenerate(payload: { topic: string; depth: GenerationDepth; style: GenerationStyle; domain?: string }) {
  if (!template.value) return
  const toast = safeToast()
  const tplSlug = template.value.slug

  adaptError.value = null
  adapting.value = true
  // Four logical phases — the AI call is opaque, so we update the counter
  // at phase transitions rather than per-node.
  adaptProgress.value = { done: 0, total: 4 }

  try {
    // Phase 1: validate template + credential server-side. Throws 400 if no
    // AI credential, 404 if template missing, 429 if rate-limited.
    // Skipped on Tauri: there is no local /api server, and native uses on-device
    // BYOK keys (not the server vault), so the pre-check is inapplicable — a
    // plain $fetch would hit the app origin and fail. generateMapStructure below
    // surfaces any missing-provider error from the local provider instead.
    adaptProgress.value = { done: 1, total: 4 }
    if (!_isTauri) {
      await $fetch(`/api/templates/${tplSlug}/adapt`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: {
          topic: payload.topic,
          depth: payload.depth,
          style: payload.style,
          domain: payload.domain,
        },
      })
    }

    // Phase 2: generate adapted structure via configured LLM.
    // NOTE: The current AI composable does not expose a "fill content into a
    // fixed template skeleton" method; `generateMapStructure` produces a
    // fresh structure shaped by depth/style/domain. The template's role here
    // is to (a) gate the action behind a publicly available shape the user
    // chose, and (b) supply the topic-adjacent style/depth defaults.
    adaptProgress.value = { done: 2, total: 4 }
    const { branchCount, maxDepth } = depthToOptions(payload.depth)
    const structure = await ai.generateMapStructure(payload.topic, {
      branchCount,
      maxDepth,
      style: payload.style,
      domain: payload.domain,
      includeCrossConnections: payload.depth !== 'shallow',
      locale: currentLocale.value,
    })

    // Phase 3: build a fresh document and render the structure into it.
    adaptProgress.value = { done: 3, total: 4 }
    mapStore.newDocument()
    mapStore.setTitle(payload.topic)
    mapRenderer.renderMapStructure(structure, { x: 0, y: 0 })

    // Phase 4: persist + best-effort sync, then navigate.
    adaptProgress.value = { done: 4, total: 4 }
    const doc = mapStore.toSerializable()
    await db.saveMap(doc)
    if (syncEngine.isSyncEnabled.value) {
      // Don't block navigation on the network round-trip.
      syncEngine.debouncedPush(doc.id)
    }

    showAdaptModal.value = false
    router.push(`/map/${doc.id}`)
  } catch (e: unknown) {
    console.error('[templates/adapt] failed:', e)

    const err = e as { statusCode?: number; status?: number; data?: { statusCode?: number; statusMessage?: string }; message?: string }
    const status = err?.statusCode ?? err?.status ?? err?.data?.statusCode ?? 0
    const serverMsg = err?.data?.statusMessage || ''

    // Special-case the missing-credential error — it's actionable and the
    // server's message already references Settings > AI Providers.
    const isNoCredential =
      status === 400 && /no ai provider/i.test(serverMsg) ||
      /no api key|no ai provider/i.test(err?.message || '')

    if (isNoCredential) {
      adaptError.value = t('templates.ai_adapt_modal.error_no_credential')
      toast.error(adaptError.value)
      return
    }

    // If the server-side validation succeeded but the AI call returned
    // unparseable JSON, fall back to a plain unadapted copy and warn.
    const isParseError = /invalid response format|expected array|parse|json/i.test(err?.message || '')
    if (status === 0 || isParseError) {
      try {
        toast.warning(t('templates.ai_adapt_modal.error_failed'))
        const result = await useTemplate(tplSlug)
        showAdaptModal.value = false
        router.push(`/map/${result.mapId}`)
        return
      } catch (fallbackErr) {
        console.error('[templates/adapt] fallback also failed:', fallbackErr)
      }
    }

    // Generic error path — surface a clean message via userFriendlyError +
    // toast, and keep the modal open so the user can retry.
    adaptError.value = userFriendlyError(e, t)
    toast.error(adaptError.value)
  } finally {
    adapting.value = false
    adaptProgress.value = null
  }
}

function handleAdaptModalClose() {
  // If a generation is in flight, closing the modal hides UI but lets the
  // background call resolve (navigation still happens on success). This is
  // intentional — there's no AbortController plumbed through ai.generateMapStructure.
  if (!adapting.value) {
    adaptError.value = null
  }
  showAdaptModal.value = false
}

onMounted(() => {
  fetchTemplate(slug)
})
</script>

<template>
  <div class="detail-layout">
    <AppSidebar active-nav="templates" />

    <main class="detail-main">
      <!-- Breadcrumb -->
      <nav class="breadcrumb">
        <NuxtLink to="/templates" class="breadcrumb-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {{ $t('common.nav.templates') }}
        </NuxtLink>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span class="breadcrumb-current">{{ displayTitle || '...' }}</span>
      </nav>

      <!-- Loading -->
      <div v-if="loading && !template" class="loading-state">
        <div class="spinner" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <NuxtLink to="/templates" class="back-link">{{ $t('templates.detail.back') }}</NuxtLink>
      </div>

      <!-- Content -->
      <div v-else-if="template" class="detail-content">
        <!-- Preview -->
        <div class="detail-preview">
          <svg
            v-if="preview"
            :viewBox="`0 0 ${preview.width} ${preview.height}`"
            class="preview-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <rect
              v-for="(shape, i) in preview.shapes"
              :key="i"
              :x="shape.x"
              :y="shape.y"
              :width="shape.width"
              :height="shape.height"
              :fill="shape.color"
              :stroke="shape.borderColor || 'transparent'"
              :stroke-width="0.5"
              :rx="shape.borderRadius || 4"
            />
            <text
              v-for="(shape, i) in preview.shapes.filter(s => s.label)"
              :key="'t' + i"
              :x="shape.x + shape.width / 2"
              :y="shape.y + shape.height / 2 + (shape.fontSize || 10) * 0.35"
              :font-size="shape.fontSize || 10"
              text-anchor="middle"
              font-family="Inter, system-ui, sans-serif"
              font-weight="600"
            >
              {{ shape.label }}
            </text>
          </svg>

          <span v-if="template.aiEnhanced" class="ai-badge">{{ $t('templates.detail.ai_enhanced') }}</span>
        </div>

        <!-- Info Panel -->
        <div class="detail-info">
          <!-- Title + Badges -->
          <div class="info-header">
            <h1 class="info-title">{{ displayTitle }}</h1>
            <div class="info-badges">
              <span class="info-badge">
                {{ $t('templates.filter.' + template.category) }}
              </span>
              <span v-if="template.aiEnhanced" class="info-badge ai">{{ $t('templates.detail.ai_enhanced') }}</span>
            </div>
          </div>

          <!-- Description -->
          <p class="info-description">{{ displayDescription }}</p>

          <!-- Stats -->
          <div class="info-stats">
            <div class="stat">
              <span class="stat-value">{{ formattedUses }}</span>
              <span class="stat-label">{{ $t('templates.detail.uses') }}</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ template.nodeCount }}</span>
              <span class="stat-label">{{ $t('templates.detail.nodes') }}</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ template.levelCount }}</span>
              <span class="stat-label">{{ $t('templates.detail.levels') }}</span>
            </div>
          </div>

          <!-- Author -->
          <div class="info-author">
            <span class="author-avatar">{{ authorInitial }}</span>
            <div class="author-text">
              <span class="author-name">{{ authorName }}</span>
              <span class="author-date">{{ publishedDate }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="info-actions">
            <button class="action-btn primary" @click="handleUse">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {{ $t('templates.detail.use_template') }}
            </button>
            <button class="action-btn secondary" @click="showAdaptModal = true">
              <NcAiMark :size="16" />
              {{ $t('templates.detail.ai_adapt') }}
            </button>
          </div>

          <!-- Tags -->
          <div v-if="(template.tags?.length ?? 0) > 0" class="info-tags">
            <span v-for="tag in template.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </main>

    <!-- AI Adapt Modal -->
    <TemplatesAIAdaptModal
      :open="showAdaptModal"
      :template-title="template?.title || ''"
      :loading="adapting"
      :progress="adaptProgress"
      :error-message="adaptError"
      @close="handleAdaptModalClose"
      @generate="handleAdaptGenerate"
    />
  </div>
</template>

<style scoped>
.detail-layout {
  display: flex;
  min-height: 100vh;
  background: var(--nc-bg);
}

.detail-main {
  flex: 1;
  padding: 24px 40px;
  min-width: 0;
  overflow-y: auto;
  max-height: 100vh;
}

/* Breadcrumb — nav grammar: mono uppercase, secondary → text on hover */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}

.breadcrumb-link {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--nc-text-secondary);
  text-decoration: none;
  padding: 6px 12px;
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .breadcrumb-link:hover {
    color: var(--nc-text);
    border-color: var(--nc-border-active);
  }
}

.breadcrumb svg:not(.breadcrumb-link svg) {
  color: var(--nc-text-dim);
}

.breadcrumb-current {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}

/* Content */
.detail-content {
  display: flex;
  gap: 40px;
}

/* Preview — flat surface + hairline (REDESIGN.md §5) */
.detail-preview {
  flex: 1;
  min-height: 500px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.detail-preview .preview-svg {
  width: 70%;
  height: 70%;
}

.preview-svg text {
  fill: var(--nc-text);
}

/* Chip grammar: mono on flat fill, hairline, radius 0.4rem */
.ai-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 14px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-accent);
}

/* Info Panel */
.detail-info {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Page title = display 700 (REDESIGN.md §4) */
.info-title {
  font-family: var(--nc-font-display);
  font-size: calc(24px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-text);
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.info-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.info-badge {
  padding: 4px 12px;
  border-radius: 0.4rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  color: v-bind(categoryColor);
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.info-badge.ai {
  background: rgba(var(--nc-accent-rgb), 0.1);
  border-color: rgba(var(--nc-accent-rgb), 0.22);
  color: var(--nc-accent);
}

.info-description {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  line-height: 22px;
  color: var(--nc-text-secondary);
  margin: 0;
}

/* Stats — display numerals over mono micro-labels */
.info-stats {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--nc-border);
  border-bottom: 1px solid var(--nc-border);
  padding: 16px 0;
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-family: var(--nc-font-display);
  font-size: calc(20px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
}

.stat-label {
  font-family: var(--nc-font-mono);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

/* Author */
.info-author {
  display: flex;
  align-items: center;
  gap: 10px;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--nc-surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-text);
  flex-shrink: 0;
}

.author-text {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text);
}

.author-date {
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

/* Actions */
.info-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.action-btn:active {
  transform: scale(0.97);
}

.action-btn:focus-visible,
.breadcrumb-link:focus-visible,
.back-link:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Primary CTA = ink pill (REDESIGN.md §5) */
.action-btn.primary {
  background: var(--nc-text);
  border: none;
  color: var(--nc-bg);
}

/* AI-flavored CTA = accent pill (NcButton "ai" variant) */
.action-btn.secondary {
  background: var(--nc-accent);
  border: none;
  color: var(--nc-bg);
}

@media (hover: hover) and (pointer: fine) {
  .action-btn.primary:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }

  .action-btn.secondary:hover {
    background: var(--nc-accent-light);
    transform: translateY(-1px);
  }
}

/* Tags — chip grammar: mono on chip fill, hairline, radius 0.4rem */
.info-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  padding: 4px 12px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}

/* Loading / Error */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 80px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--nc-border);
  border-top-color: var(--nc-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-state {
  text-align: center;
  padding: 80px;
  font-family: var(--nc-font-body);
  color: var(--nc-text-secondary);
}

.back-link {
  color: var(--nc-accent);
  text-decoration: none;
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */

/* Laptop */
@media (max-width: 1366px) {
  .detail-main { padding: 24px 32px; }
  .detail-info { width: 300px; }
}

/* Mobile */
@media (max-width: 768px) {
  .detail-layout { flex-direction: column; }
  .detail-main { padding: 16px; max-height: none; }
  .detail-content { flex-direction: column; }
  .detail-info { width: 100%; }
  .detail-preview { min-height: 300px; }
}
</style>
