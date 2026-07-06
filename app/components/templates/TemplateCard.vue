<script setup lang="ts">
import type { Template, TemplatePreviewData } from '~/types'

const props = defineProps<{
  template: Template
}>()

const emit = defineEmits<{
  (e: 'click', template: Template): void
}>()

// Category hues come from the token palette only (REDESIGN.md §9 — never
// re-hardcode a palette in a component). Consumed via v-bind() in scoped CSS.
const categoryColors: Record<string, string> = {
  education: 'var(--nc-node-blue)',
  business: 'var(--nc-accent)',
  creative: 'var(--nc-node-orange)',
  planning: 'var(--nc-node-purple)',
  research: 'var(--nc-node-pink)',
}

const categoryColor = computed(() => categoryColors[props.template.category] || 'var(--nc-text-muted)')

const preview = computed(() => props.template.previewData as TemplatePreviewData | null)

const authorInitial = computed(() => {
  const name = props.template.author?.name || 'N'
  return name.charAt(0).toUpperCase()
})

const authorName = computed(() => {
  return props.template.author?.name || 'NeuroCanvas'
})

const formattedUses = computed(() => {
  const count = props.template.usageCount
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k uses`
  return `${count} uses`
})

// Localized text for built-in templates (DB stores English only).
const builtin = useBuiltinTemplateText()
const displayTitle = computed(() => builtin.title(props.template))
const displayDescription = computed(() => builtin.description(props.template))
const displayCategory = computed(() => builtin.category(props.template.category))
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
        <line
          v-for="(ln, i) in preview.lines || []"
          :key="'l' + i"
          :x1="ln.x1"
          :y1="ln.y1"
          :x2="ln.x2"
          :y2="ln.y2"
          stroke-width="1"
        />
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
        <span class="card-title">{{ displayTitle }}</span>
        <span class="category-badge">
          {{ displayCategory }}
        </span>
      </div>

      <p class="card-description">{{ displayDescription }}</p>

      <div class="card-footer">
        <div class="card-author">
          <span class="author-avatar">{{ authorInitial }}</span>
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
/* Card grammar (REDESIGN.md §5): flat surface-2 + 1px hairline, radius 8px.
   Hover = border-color shift ONLY — no lift, no shadow growth, no glow. */
.template-card {
  display: flex;
  flex-direction: column;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
  text-align: left;
  padding: 0;
  width: 100%;
}

@media (hover: hover) and (pointer: fine) {
  .template-card:hover {
    border-color: var(--nc-border-active);
  }
}

.template-card:active {
  transform: scale(0.97);
}

.template-card:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Preview */
.card-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 270 / 140;
  background: var(--nc-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-svg {
  width: 80%;
  height: 80%;
}

.preview-svg line {
  stroke: var(--nc-border);
}

.preview-svg text {
  fill: var(--nc-text);
}

/* Chip grammar (REDESIGN.md §5): mono on chip fill, hairline, radius 0.4rem */
.ai-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px 10px;
  background: rgba(var(--nc-accent-rgb), 0.1);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.22);
  color: var(--nc-accent);
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  border-radius: 0.4rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
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

/* Card title = display voice (REDESIGN.md §4) */
.card-title {
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-badge {
  padding: 2px 8px;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  color: v-bind(categoryColor);
  border-radius: 0.4rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.card-description {
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--nc-text-secondary);
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
  font-family: var(--nc-font-body);
  font-size: calc(9px * var(--nc-text-scale, 1));
  font-weight: 700;
  background: v-bind(categoryColor);
  color: var(--nc-bg);
  flex-shrink: 0;
}

.author-name {
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--nc-text-muted);
}

.card-uses {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--nc-text-muted);
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */
</style>
