<script setup lang="ts">
import type { Template, TemplatePreviewData } from '~/types'

const props = defineProps<{
  template: Template
}>()

const emit = defineEmits<{
  (e: 'click', template: Template): void
}>()

const categoryColors: Record<string, string> = {
  education: '#3B82F6',
  business: '#00D2BE',
  creative: '#F59E0B',
  planning: '#8B5CF6',
  research: '#EF4444',
}

const categoryColor = computed(() => categoryColors[props.template.category] || '#71717A')

const preview = computed(() => props.template.previewData as TemplatePreviewData | null)

const authorInitial = computed(() => {
  const name = props.template.author?.name || 'N'
  return name[0].toUpperCase()
})

const authorName = computed(() => {
  return props.template.author?.name || 'NeuroCanvas'
})

const formattedUses = computed(() => {
  const count = props.template.usageCount
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k uses`
  return `${count} uses`
})
</script>

<template>
  <button class="template-card" @click="emit('click', template)">
    <!-- Preview Area -->
    <div class="card-preview">
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
          :y="shape.y + shape.height / 2 + (shape.fontSize || 7) * 0.35"
          :font-size="shape.fontSize || 7"
          fill="#E8E8EC"
          text-anchor="middle"
          font-family="Inter, system-ui, sans-serif"
          font-weight="600"
        >
          {{ shape.label }}
        </text>
      </svg>

      <!-- AI Badge -->
      <span v-if="template.aiEnhanced" class="ai-badge">AI</span>
    </div>

    <!-- Card Info -->
    <div class="card-info">
      <div class="card-header">
        <span class="card-title">{{ template.title }}</span>
        <span
          class="category-badge"
          :style="{ background: categoryColor + '18', color: categoryColor }"
        >
          {{ template.category.charAt(0).toUpperCase() + template.category.slice(1) }}
        </span>
      </div>

      <p class="card-description">{{ template.description }}</p>

      <div class="card-footer">
        <div class="card-author">
          <span class="author-avatar" :style="{ background: categoryColor }">{{ authorInitial }}</span>
          <span class="author-name">{{ authorName }}</span>
        </div>
        <div class="card-uses">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{{ formattedUses }}</span>
        </div>
      </div>
    </div>
  </button>
</template>

<style scoped>
.template-card {
  display: flex;
  flex-direction: column;
  background: var(--tc-bg, #111113);
  border: 1px solid var(--tc-border, #1A1A1E);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
  text-align: left;
  padding: 0;
  width: 100%;
}

.template-card:hover {
  border-color: var(--tc-border-hover, #2A2A30);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
}

.template-card:active {
  transform: translateY(0);
}

/* Preview */
.card-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 270 / 140;
  background: var(--tc-preview-bg, #0D0D0F);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-svg {
  width: 80%;
  height: 80%;
}

.ai-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px 10px;
  background: rgba(0, 210, 190, 0.12);
  color: #00D2BE;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  letter-spacing: 0.02em;
}

/* Info */
.card-info {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--tc-text, #E8E8EC);
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-badge {
  padding: 2px 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.card-description {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--tc-muted, #71717A);
  line-height: 18px;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
}

.card-author {
  display: flex;
  align-items: center;
  gap: 6px;
}

.author-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 9px;
  font-weight: 700;
  color: #09090B;
  flex-shrink: 0;
}

.author-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 400;
  color: var(--tc-muted, #71717A);
}

.card-uses {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 400;
  color: var(--tc-muted, #71717A);
}

/* Light theme */
:root.light .template-card {
  --tc-bg: #FFFFFF;
  --tc-border: #E8E8E6;
  --tc-border-hover: #D4D4D2;
  --tc-preview-bg: #F5F5F3;
  --tc-text: #111111;
  --tc-muted: #71717A;
}

:root.light .ai-badge {
  background: rgba(0, 210, 190, 0.08);
}

:root.light .template-card:hover {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}
</style>
