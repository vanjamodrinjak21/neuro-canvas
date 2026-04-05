<script setup lang="ts">
import type { GenerationDepth, GenerationStyle, TemplatePreviewData } from '~/types'

definePageMeta({
  layout: false,
})

const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string

const {
  currentTemplate: template,
  loading,
  error,
  fetchTemplate,
  useTemplate,
} = useTemplates()

const showAdaptModal = ref(false)

const categoryColors: Record<string, string> = {
  education: '#3B82F6',
  business: '#00D2BE',
  creative: '#F59E0B',
  planning: '#8B5CF6',
  research: '#EF4444',
}

const preview = computed(() => template.value?.previewData as TemplatePreviewData | null)

const authorInitial = computed(() => {
  const name = template.value?.author?.name || 'N'
  return name[0].toUpperCase()
})

const authorName = computed(() => template.value?.author?.name || 'NeuroCanvas')

const publishedDate = computed(() => {
  if (!template.value) return ''
  const d = new Date(template.value.createdAt)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Published today'
  if (diff === 1) return 'Published yesterday'
  return `Published ${diff} days ago`
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

async function handleAdaptGenerate(payload: { topic: string; depth: GenerationDepth; style: GenerationStyle; domain?: string }) {
  showAdaptModal.value = false
  // For now, use template directly, AI adaptation TBD
  await handleUse()
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
          Templates
        </NuxtLink>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span class="breadcrumb-current">{{ template?.title || '...' }}</span>
      </nav>

      <!-- Loading -->
      <div v-if="loading && !template" class="loading-state">
        <div class="spinner" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <NuxtLink to="/templates" class="back-link">Back to templates</NuxtLink>
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
              fill="#E8E8EC"
              text-anchor="middle"
              font-family="Inter, system-ui, sans-serif"
              font-weight="600"
            >
              {{ shape.label }}
            </text>
          </svg>

          <span v-if="template.aiEnhanced" class="ai-badge">AI-Enhanced</span>
        </div>

        <!-- Info Panel -->
        <div class="detail-info">
          <!-- Title + Badges -->
          <div class="info-header">
            <h1 class="info-title">{{ template.title }}</h1>
            <div class="info-badges">
              <span
                class="info-badge"
                :style="{ background: (categoryColors[template.category] || '#71717A') + '18', color: categoryColors[template.category] || '#71717A' }"
              >
                {{ template.category.charAt(0).toUpperCase() + template.category.slice(1) }}
              </span>
              <span v-if="template.aiEnhanced" class="info-badge ai">AI-Enhanced</span>
            </div>
          </div>

          <!-- Description -->
          <p class="info-description">{{ template.description }}</p>

          <!-- Stats -->
          <div class="info-stats">
            <div class="stat">
              <span class="stat-value">{{ formattedUses }}</span>
              <span class="stat-label">Uses</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ template.nodeCount }}</span>
              <span class="stat-label">Nodes</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ template.levelCount }}</span>
              <span class="stat-label">Levels</span>
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
              Use This Template
            </button>
            <button class="action-btn secondary" @click="showAdaptModal = true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
              </svg>
              AI Adapt to My Topic
            </button>
          </div>

          <!-- Tags -->
          <div v-if="template.tags.length > 0" class="info-tags">
            <span v-for="tag in template.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </main>

    <!-- AI Adapt Modal -->
    <TemplatesAIAdaptModal
      :open="showAdaptModal"
      :template-title="template?.title || ''"
      @close="showAdaptModal = false"
      @generate="handleAdaptGenerate"
    />
  </div>
</template>

<style scoped>
.detail-layout {
  display: flex;
  min-height: 100vh;
  background: var(--tpl-bg, #0D0D0F);
}

.detail-main {
  flex: 1;
  padding: 24px 40px;
  min-width: 0;
  overflow-y: auto;
  max-height: 100vh;
}

/* Breadcrumb */
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--tpl-muted, #71717A);
  text-decoration: none;
  padding: 6px 12px;
  border: 1px solid var(--tpl-border, #1A1A1E);
  border-radius: 6px;
  transition: color 0.15s, border-color 0.15s;
}

.breadcrumb-link:hover {
  color: var(--tpl-text, #E8E8EC);
  border-color: var(--tpl-border-hover, #2A2A30);
}

.breadcrumb svg:not(.breadcrumb-link svg) {
  color: var(--tpl-muted, #52525B);
}

.breadcrumb-current {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--tpl-muted, #71717A);
}

/* Content */
.detail-content {
  display: flex;
  gap: 40px;
}

/* Preview */
.detail-preview {
  flex: 1;
  min-height: 500px;
  background: var(--tpl-surface, #111113);
  border: 1px solid var(--tpl-border, #1A1A1E);
  border-radius: 12px;
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

.ai-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 14px;
  background: var(--tpl-surface, #111113);
  border: 1px solid var(--tpl-border, #1A1A1E);
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--tpl-text, #E8E8EC);
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

.info-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--tpl-text, #E8E8EC);
  margin: 0;
  letter-spacing: -0.02em;
}

.info-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.info-badge {
  padding: 4px 12px;
  border-radius: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
}

.info-badge.ai {
  background: rgba(0, 210, 190, 0.12);
  color: #00D2BE;
}

.info-description {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  line-height: 22px;
  color: var(--tpl-muted, #71717A);
  margin: 0;
}

/* Stats */
.info-stats {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--tpl-border, #1A1A1E);
  border-bottom: 1px solid var(--tpl-border, #1A1A1E);
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--tpl-text, #E8E8EC);
}

.stat-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  color: var(--tpl-muted, #71717A);
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
  background: var(--tpl-border, #2A2A30);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: var(--tpl-text, #E8E8EC);
  flex-shrink: 0;
}

.author-text {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--tpl-text, #E8E8EC);
}

.author-date {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: var(--tpl-muted, #71717A);
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
  border-radius: 10px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
}

.action-btn.primary {
  background: #00D2BE;
  border: none;
  color: #09090B;
}

.action-btn.primary:hover { opacity: 0.9; }

.action-btn.secondary {
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.2);
  color: #00D2BE;
}

.action-btn.secondary:hover {
  background: rgba(0, 210, 190, 0.12);
}

/* Tags */
.info-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  padding: 4px 12px;
  background: var(--tpl-surface, #111113);
  border: 1px solid var(--tpl-border, #1A1A1E);
  border-radius: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: var(--tpl-muted, #71717A);
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
  border: 2px solid var(--tpl-border, #1A1A1E);
  border-top-color: #00D2BE;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-state {
  text-align: center;
  padding: 80px;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--tpl-muted, #71717A);
}

.back-link {
  color: #00D2BE;
  text-decoration: none;
}

/* Light theme */
:root.light .detail-layout {
  --tpl-bg: #F5F5F3;
  --tpl-surface: #FFFFFF;
  --tpl-border: #E8E8E6;
  --tpl-border-hover: #D4D4D2;
  --tpl-text: #111111;
  --tpl-muted: #71717A;
}

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
