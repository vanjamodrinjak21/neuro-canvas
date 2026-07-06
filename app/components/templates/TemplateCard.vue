<script setup lang="ts">
import type { Template } from '~/types'
import NcCardSchematic from '~/components/ui/NcCardSchematic.vue'
import NcAiMark from '~/components/ui/NcAiMark.vue'

const props = defineProps<{
  template: Template
}>()

const emit = defineEmits<{
  (e: 'click', template: Template): void
}>()

const { t } = useI18n()

// Localized text for built-in templates (DB stores English only).
const builtin = useBuiltinTemplateText()
const displayTitle = computed(() => builtin.title(props.template))
const displayCategory = computed(() => builtin.category(props.template.category))

const authorName = computed(() => props.template.author?.name || 'NeuroCanvas')

// Compact uses figure ("1.2k"); the word rides i18n (en/hr).
const formattedUses = computed(() => {
  const count = props.template.usageCount
  const n = count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${count}`
  return t('templates.card.uses_count', { n })
})
</script>

<template>
  <!-- One card design for every map-like card (AER-76): schematic preview
       + title row + single mono meta line — same grammar as maps/index.vue. -->
  <button class="template-card" @click="emit('click', template)">
    <div class="card-preview">
      <NcCardSchematic :count="template.nodeCount" />
    </div>

    <div class="card-info">
      <div class="card-top">
        <span class="card-title">{{ displayTitle }}</span>
      </div>
      <div class="card-meta">
        <span>{{ displayCategory }}</span>
        <span class="meta-dot">&middot;</span>
        <span>{{ formattedUses }}</span>
        <span class="meta-dot">&middot;</span>
        <span class="meta-author">{{ authorName }}</span>
        <span
          v-if="template.aiEnhanced"
          class="meta-ai"
          role="img"
          :aria-label="t('templates.detail.ai_enhanced')"
          :title="t('templates.detail.ai_enhanced')"
        >
          <NcAiMark :size="12" />
        </span>
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

/* Preview frame — hosts the shared schematic device (NcCardSchematic) */
.card-preview {
  position: relative;
  width: 100%;
  height: 160px;
  background: var(--nc-surface);
  flex-shrink: 0;
  overflow: hidden;
}

/* Card info — maps-card layout: title row, then one mono meta line */
.card-info {
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 8px;
  flex: 1;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Card title — same type as maps card (body face, 500) */
.card-title {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text);
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ONE meta line — mono uppercase micro-label: category · uses · author.
   overflow:hidden clips the row at the card edge; the two variable-length
   texts (category, author) ellipsize while dots and the uses count hold. */
.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
  line-height: 16px;
  white-space: nowrap;
}

.card-meta > span {
  flex-shrink: 0;
}

.card-meta > span:first-child {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-dot {
  color: var(--nc-text-dim);
}

.meta-author {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* AI origin — the ONE AI glyph, inline at secondary tier (never a badge box) */
.meta-ai {
  display: inline-flex;
  align-items: center;
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */
</style>
