<script setup lang="ts">
import type { Node } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'

const props = defineProps<{
  visible: boolean
  node: Node | null
}>()

const emit = defineEmits<{
  close: []
  navigate: [nodeId: string]
  generateDescription: []
}>()

const mapStore = useMapStore()
const { t } = useI18n()

// Category info — chrome-side category accents resolve to the --nc-* tokens
// (consumed as CSS custom-property values, so var() strings are valid)
const categoryColors: Record<string, string> = {
  'main-fact': 'var(--nc-accent)',
  description: 'var(--nc-node-blue)',
  evidence: 'var(--nc-node-green)',
  question: 'var(--nc-node-yellow)',
  idea: 'var(--nc-node-orange)',
  reference: 'var(--nc-node-purple)',
  default: 'var(--nc-accent)',
}

const categoryLabelKey: Record<string, string> = {
  'main-fact': 'canvas.node_props_form.cat_concept',
  description: 'canvas.node_props_form.cat_desc',
  evidence: 'canvas.node_props_form.cat_evidence',
  question: 'canvas.node_props_form.cat_question',
  idea: 'canvas.node_props_form.cat_idea',
  reference: 'canvas.node_props_form.cat_ref',
  process: 'canvas.node_props_form.cat_process',
  default: 'canvas.node_props_form.cat_node',
}

const category = computed(() => {
  return (props.node?.metadata?.category as string) || 'default'
})

const categoryColor = computed(() => {
  return props.node?.style.borderColor || categoryColors[category.value] || categoryColors.default
})

const categoryLabel = computed(() => {
  const key = categoryLabelKey[category.value]
  if (key) return t(key)
  return category.value.charAt(0).toUpperCase() + category.value.slice(1)
})

// Description
const description = computed(() => {
  return props.node?.metadata?.description as { summary?: string; details?: string; keywords?: string[]; generatedAt?: number } | undefined
})

const hasDescription = computed(() => !!description.value?.summary)

// Notes
const notes = computed(() => (props.node?.metadata?.notes as string) || '')

// AI metadata
const aiMeta = computed(() => props.node?.metadata?.ai as {
  inferredDomain?: string
  complexity?: 'simple' | 'moderate' | 'complex'
  prerequisites?: string[]
  dependents?: string[]
} | undefined)

// Connections
const connections = computed(() => {
  if (!props.node) return { incoming: [], outgoing: [] }
  const incoming: Node[] = []
  const outgoing: Node[] = []
  for (const edge of mapStore.edges.values()) {
    if (edge.sourceId === props.node.id) {
      const target = mapStore.nodes.get(edge.targetId)
      if (target) outgoing.push(target)
    }
    if (edge.targetId === props.node.id) {
      const source = mapStore.nodes.get(edge.sourceId)
      if (source) incoming.push(source)
    }
  }
  return { incoming, outgoing }
})

const totalConnections = computed(() => connections.value.incoming.length + connections.value.outgoing.length)

// Format generated date
function formatDate(timestamp?: number): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getNodeColor(node: Node): string {
  return node.style.borderColor || 'var(--nc-accent)'
}
</script>

<template>
  <Transition
    enter-active-class="detail-panel-enter"
    leave-active-class="detail-panel-leave"
    enter-from-class="translate-x-full opacity-0"
    leave-to-class="translate-x-full opacity-0"
  >
    <aside
      v-if="visible && node"
      class="detail-panel"
    >
      <!-- Header -->
      <header class="detail-panel__header">
        <div class="detail-panel__header-left">
          <span
            class="detail-panel__badge"
            :style="{ '--badge-color': categoryColor }"
          >
            {{ categoryLabel }}
          </span>
        </div>
        <button
          class="detail-panel__close"
          @click="emit('close')"
        >
          <span class="i-lucide-x" />
        </button>
      </header>

      <!-- Scrollable content -->
      <div class="detail-panel__body">
        <!-- Title -->
        <div class="detail-panel__title-section">
          <h2 class="detail-panel__title">{{ node.content }}</h2>
          <div class="detail-panel__meta">
            <span class="detail-panel__meta-item">
              <span class="i-lucide-git-branch detail-panel__meta-icon" />
              {{ totalConnections }} connection{{ totalConnections !== 1 ? 's' : '' }}
            </span>
            <span v-if="node.isRoot" class="detail-panel__meta-item detail-panel__meta-item--root">
              <span class="i-lucide-crown detail-panel__meta-icon" />
              Root
            </span>
            <span v-if="aiMeta?.complexity" class="detail-panel__meta-item">
              <span class="i-lucide-gauge detail-panel__meta-icon" />
              {{ aiMeta.complexity }}
            </span>
          </div>
        </div>

        <!-- Description -->
        <section class="detail-panel__section">
          <div class="detail-panel__section-header">
            <span class="i-lucide-file-text detail-panel__section-icon" />
            <span class="detail-panel__section-label">{{ $t('canvas.node_properties.description') }}</span>
          </div>

          <template v-if="hasDescription">
            <p class="detail-panel__summary">{{ description!.summary }}</p>
            <p v-if="description!.details" class="detail-panel__details">{{ description!.details }}</p>
            <span v-if="description!.generatedAt" class="detail-panel__generated-at">
              {{ $t('canvas.node_properties.generated_at', { time: formatDate(description!.generatedAt) }) }}
            </span>
          </template>
          <div v-else class="detail-panel__empty-desc">
            <p>{{ $t('canvas.node_properties.no_description') }}</p>
            <button class="detail-panel__generate-btn" @click="emit('generateDescription')">
              <span class="i-lucide-pen-line" />
              {{ $t('canvas.empty_guide.generate_with_ai') }}
            </button>
          </div>
        </section>

        <!-- Keywords -->
        <section v-if="description?.keywords?.length" class="detail-panel__section">
          <div class="detail-panel__section-header">
            <span class="i-lucide-tag detail-panel__section-icon" />
            <span class="detail-panel__section-label">{{ $t('canvas.node_properties.keywords') }}</span>
          </div>
          <div class="detail-panel__keywords">
            <span
              v-for="keyword in description.keywords"
              :key="keyword"
              class="detail-panel__keyword"
            >
              {{ keyword }}
            </span>
          </div>
        </section>

        <!-- Notes -->
        <section v-if="notes" class="detail-panel__section">
          <div class="detail-panel__section-header">
            <span class="i-lucide-notebook-pen detail-panel__section-icon" />
            <span class="detail-panel__section-label">{{ $t('canvas.node_properties.notes') }}</span>
          </div>
          <p class="detail-panel__notes">{{ notes }}</p>
        </section>

        <!-- AI Insights -->
        <section v-if="aiMeta?.inferredDomain || aiMeta?.prerequisites?.length" class="detail-panel__section">
          <div class="detail-panel__section-header">
            <span class="i-lucide-brain detail-panel__section-icon" />
            <span class="detail-panel__section-label">{{ $t('canvas.node_properties.ai_insights') }}</span>
          </div>
          <div v-if="aiMeta?.inferredDomain" class="detail-panel__insight-row">
            <span class="detail-panel__insight-label">{{ $t('canvas.node_properties.domain') }}</span>
            <span class="detail-panel__insight-value">{{ aiMeta.inferredDomain }}</span>
          </div>
          <div v-if="aiMeta?.prerequisites?.length" class="detail-panel__insight-row">
            <span class="detail-panel__insight-label">{{ $t('canvas.node_properties.prerequisites') }}</span>
            <div class="detail-panel__insight-list">
              <span v-for="p in aiMeta.prerequisites" :key="p" class="detail-panel__insight-tag">{{ p }}</span>
            </div>
          </div>
        </section>

        <!-- Connected Nodes -->
        <section v-if="totalConnections > 0" class="detail-panel__section">
          <div class="detail-panel__section-header">
            <span class="i-lucide-link detail-panel__section-icon" />
            <span class="detail-panel__section-label">{{ $t('canvas.node_properties.connections') }}</span>
            <span class="detail-panel__section-count">{{ totalConnections }}</span>
          </div>

          <!-- Incoming -->
          <div v-if="connections.incoming.length" class="detail-panel__conn-group">
            <span class="detail-panel__conn-direction">
              <span class="i-lucide-corner-down-left" />
              {{ $t('canvas.node_properties.incoming') }}
            </span>
            <button
              v-for="link in connections.incoming"
              :key="link.id"
              class="detail-panel__conn-item"
              @click="emit('navigate', link.id)"
            >
              <span
                class="detail-panel__conn-dot"
                :style="{ '--dot': getNodeColor(link) }"
              />
              <span class="detail-panel__conn-label">{{ link.content }}</span>
              <span class="i-lucide-arrow-right detail-panel__conn-arrow" />
            </button>
          </div>

          <!-- Outgoing -->
          <div v-if="connections.outgoing.length" class="detail-panel__conn-group">
            <span class="detail-panel__conn-direction">
              <span class="i-lucide-corner-right-up" />
              {{ $t('canvas.node_properties.outgoing') }}
            </span>
            <button
              v-for="link in connections.outgoing"
              :key="link.id"
              class="detail-panel__conn-item"
              @click="emit('navigate', link.id)"
            >
              <span
                class="detail-panel__conn-dot"
                :style="{ '--dot': getNodeColor(link) }"
              />
              <span class="detail-panel__conn-label">{{ link.content }}</span>
              <span class="i-lucide-arrow-right detail-panel__conn-arrow" />
            </button>
          </div>
        </section>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
/* Panel slide — transform/opacity only, single ease (REDESIGN.md §6) */
.detail-panel-enter {
  transition: transform 300ms var(--nc-ease), opacity 300ms var(--nc-ease);
}

.detail-panel-leave {
  transition: transform 200ms var(--nc-ease), opacity 200ms var(--nc-ease);
}

.detail-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  /* No top offset: when this panel is open the top toolbar physically narrows
     to the panel's left edge (see map/[id].vue body:has(.detail-panel)
     .topbar-root), so the panel owns the full-height right column. */
  width: 360px;
  z-index: 140;
  background: var(--nc-surface);
  border-left: 1px solid var(--nc-border);
  display: flex;
  flex-direction: column;
  box-shadow: var(--nc-shadow-md);
}

/* Header */
.detail-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--nc-border);
  flex-shrink: 0;
}

.detail-panel__header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Category badge: neutral chip + 3px colored left strip + colored text —
   identifiable at a glance, doesn’t shout. The category color arrives via
   the --badge-color custom property (node data). */
.detail-panel__badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 4px 12px 4px 14px;
  border-radius: 6px;
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: var(--nc-chip-bg);
  color: var(--badge-color, var(--nc-text));
  border: 1px solid var(--nc-border);
  overflow: hidden;
}

.detail-panel__badge::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--badge-color, var(--nc-accent));
  border-radius: 6px 0 0 6px;
}

.detail-panel__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  color: var(--nc-text-muted);
  font-size: calc(14px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

.detail-panel__close:hover {
  color: var(--nc-text);
  border-color: var(--nc-border-active);
  background: var(--nc-surface-3);
}

.detail-panel__close:active {
  transform: scale(0.97);
}

/* Scrollable body */
.detail-panel__body {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
}

.detail-panel__body::-webkit-scrollbar {
  width: 4px;
}

.detail-panel__body::-webkit-scrollbar-track {
  background: transparent;
}

.detail-panel__body::-webkit-scrollbar-thumb {
  background: var(--nc-surface-3);
  border-radius: 4px;
}

/* Title section */
.detail-panel__title-section {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--nc-border-subtle);
}

/* Panel title — display face (REDESIGN.md §4) */
.detail-panel__title {
  font-family: var(--nc-font-display);
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-text);
  line-height: 1.3;
  margin: 0 0 8px;
  letter-spacing: -0.015em;
}

.detail-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.detail-panel__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.detail-panel__meta-item--root {
  color: var(--nc-accent-text);
}

.detail-panel__meta-icon {
  font-size: calc(12px * var(--nc-text-scale, 1));
}

/* Sections */
.detail-panel__section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--nc-border-subtle);
}

.detail-panel__section:last-child {
  border-bottom: none;
}

.detail-panel__section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.detail-panel__section-icon {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

/* Section eyebrow — mono uppercase micro-label (REDESIGN.md §4) */
.detail-panel__section-label {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.detail-panel__section-count {
  margin-left: auto;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  background: var(--nc-chip-bg);
  padding: 1px 6px;
  border-radius: 4px;
}

/* Description */
.detail-panel__summary {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 1.6;
  color: var(--nc-text);
  margin: 0 0 8px;
}

.detail-panel__details {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 1.6;
  color: var(--nc-text-secondary);
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--nc-border-subtle);
}

.detail-panel__generated-at {
  display: block;
  margin-top: 8px;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
}

/* Empty description */
.detail-panel__empty-desc {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.detail-panel__empty-desc p {
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  font-style: italic;
  margin: 0;
}

.detail-panel__generate-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: rgba(var(--nc-accent-rgb), 0.08);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.2);
  border-radius: 6px;
  color: var(--nc-accent-text);
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
  transition:
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

.detail-panel__generate-btn:hover {
  background: rgba(var(--nc-accent-rgb), 0.12);
  border-color: rgba(var(--nc-accent-rgb), 0.3);
}

.detail-panel__generate-btn:active {
  transform: scale(0.97);
}

.detail-panel__generate-btn span {
  font-size: calc(12px * var(--nc-text-scale, 1));
}

/* Keywords */
.detail-panel__keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-panel__keyword {
  display: inline-block;
  padding: 3px 10px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}

/* Notes */
.detail-panel__notes {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 1.6;
  color: var(--nc-text-secondary);
  margin: 0;
  white-space: pre-wrap;
}

/* AI Insights */
.detail-panel__insight-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.detail-panel__insight-row:last-child {
  margin-bottom: 0;
}

.detail-panel__insight-label {
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-muted);
}

.detail-panel__insight-value {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text);
}

.detail-panel__insight-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Prerequisite tags — neutral chip (accent discipline: no second hue) */
.detail-panel__insight-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 4px;
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}

/* Connected nodes */
.detail-panel__conn-group {
  margin-bottom: 12px;
}

.detail-panel__conn-group:last-child {
  margin-bottom: 0;
}

.detail-panel__conn-direction {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  margin-bottom: 6px;
}

.detail-panel__conn-direction span:first-child {
  font-size: calc(11px * var(--nc-text-scale, 1));
}

.detail-panel__conn-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  border-radius: 0.5rem;
  cursor: pointer;
  transition:
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
  margin-bottom: 4px;
}

.detail-panel__conn-item:last-child {
  margin-bottom: 0;
}

.detail-panel__conn-item:hover {
  background: var(--nc-surface-3);
  border-color: var(--nc-border);
}

.detail-panel__conn-item:active {
  transform: scale(0.97);
}

/* Node color is user data — arrives via the --dot custom property */
.detail-panel__conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dot, var(--nc-accent));
  flex-shrink: 0;
}

.detail-panel__conn-label {
  flex: 1;
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-panel__conn-item:hover .detail-panel__conn-label {
  color: var(--nc-text);
}

.detail-panel__conn-arrow {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
  opacity: 0;
  transition: opacity 150ms var(--nc-ease);
}

.detail-panel__conn-item:hover .detail-panel__conn-arrow {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .detail-panel-enter,
  .detail-panel-leave {
    transition: opacity 200ms var(--nc-ease);
  }
}
</style>
