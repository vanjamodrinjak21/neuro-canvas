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

// Category info
const categoryColors: Record<string, string> = {
  'main-fact': '#00D2BE',
  description: '#60A5FA',
  evidence: '#4ADE80',
  question: '#FACC15',
  idea: '#FB923C',
  reference: '#A78BFA',
  default: '#00D2BE',
}

const categoryLabels: Record<string, string> = {
  'main-fact': 'Concept',
  description: 'Description',
  evidence: 'Evidence',
  question: 'Question',
  idea: 'Idea',
  reference: 'Reference',
  process: 'Process',
  default: 'Node',
}

const category = computed(() => {
  return (props.node?.metadata?.category as string) || 'default'
})

const categoryColor = computed(() => {
  return props.node?.style.borderColor || categoryColors[category.value] || categoryColors.default
})

const categoryLabel = computed(() => {
  return categoryLabels[category.value] || category.value.charAt(0).toUpperCase() + category.value.slice(1)
})

// Badge text color for contrast
const badgeTextColor = computed(() => {
  const color = categoryColor.value
  const lightBgColors = ['#FACC15', '#4ADE80', '#FB923C']
  if (lightBgColors.includes(color)) return '#0A0A0C'
  return '#FFFFFF'
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
    enter-active-class="transition-all duration-300 ease-out"
    leave-active-class="transition-all duration-200 ease-in"
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
            :style="{ background: categoryColor, color: badgeTextColor }"
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
            <span class="detail-panel__section-label">Description</span>
          </div>

          <template v-if="hasDescription">
            <p class="detail-panel__summary">{{ description!.summary }}</p>
            <p v-if="description!.details" class="detail-panel__details">{{ description!.details }}</p>
            <span v-if="description!.generatedAt" class="detail-panel__generated-at">
              Generated {{ formatDate(description!.generatedAt) }}
            </span>
          </template>
          <div v-else class="detail-panel__empty-desc">
            <p>No description yet.</p>
            <button class="detail-panel__generate-btn" @click="emit('generateDescription')">
              <span class="i-lucide-sparkles" />
              Generate with AI
            </button>
          </div>
        </section>

        <!-- Keywords -->
        <section v-if="description?.keywords?.length" class="detail-panel__section">
          <div class="detail-panel__section-header">
            <span class="i-lucide-tag detail-panel__section-icon" />
            <span class="detail-panel__section-label">Keywords</span>
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
            <span class="detail-panel__section-label">Notes</span>
          </div>
          <p class="detail-panel__notes">{{ notes }}</p>
        </section>

        <!-- AI Insights -->
        <section v-if="aiMeta?.inferredDomain || aiMeta?.prerequisites?.length" class="detail-panel__section">
          <div class="detail-panel__section-header">
            <span class="i-lucide-brain detail-panel__section-icon" />
            <span class="detail-panel__section-label">AI Insights</span>
          </div>
          <div v-if="aiMeta?.inferredDomain" class="detail-panel__insight-row">
            <span class="detail-panel__insight-label">Domain</span>
            <span class="detail-panel__insight-value">{{ aiMeta.inferredDomain }}</span>
          </div>
          <div v-if="aiMeta?.prerequisites?.length" class="detail-panel__insight-row">
            <span class="detail-panel__insight-label">Prerequisites</span>
            <div class="detail-panel__insight-list">
              <span v-for="p in aiMeta.prerequisites" :key="p" class="detail-panel__insight-tag">{{ p }}</span>
            </div>
          </div>
        </section>

        <!-- Connected Nodes -->
        <section v-if="totalConnections > 0" class="detail-panel__section">
          <div class="detail-panel__section-header">
            <span class="i-lucide-link detail-panel__section-icon" />
            <span class="detail-panel__section-label">Connections</span>
            <span class="detail-panel__section-count">{{ totalConnections }}</span>
          </div>

          <!-- Incoming -->
          <div v-if="connections.incoming.length" class="detail-panel__conn-group">
            <span class="detail-panel__conn-direction">
              <span class="i-lucide-corner-down-left" />
              Incoming
            </span>
            <button
              v-for="link in connections.incoming"
              :key="link.id"
              class="detail-panel__conn-item"
              @click="emit('navigate', link.id)"
            >
              <span
                class="detail-panel__conn-dot"
                :style="{ backgroundColor: getNodeColor(link) }"
              />
              <span class="detail-panel__conn-label">{{ link.content }}</span>
              <span class="i-lucide-arrow-right detail-panel__conn-arrow" />
            </button>
          </div>

          <!-- Outgoing -->
          <div v-if="connections.outgoing.length" class="detail-panel__conn-group">
            <span class="detail-panel__conn-direction">
              <span class="i-lucide-corner-right-up" />
              Outgoing
            </span>
            <button
              v-for="link in connections.outgoing"
              :key="link.id"
              class="detail-panel__conn-item"
              @click="emit('navigate', link.id)"
            >
              <span
                class="detail-panel__conn-dot"
                :style="{ backgroundColor: getNodeColor(link) }"
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
.detail-panel {
  position: fixed;
  right: 0;
  top: 56px;
  bottom: 0;
  width: 360px;
  z-index: 140;
  background: rgba(12, 12, 14, 0.96);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
}

/* Header */
.detail-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.detail-panel__header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-panel__badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.detail-panel__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #71717A;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.detail-panel__close:hover {
  color: #FAFAFA;
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
}

/* Scrollable body */
.detail-panel__body {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #27272A transparent;
}

.detail-panel__body::-webkit-scrollbar {
  width: 4px;
}

.detail-panel__body::-webkit-scrollbar-track {
  background: transparent;
}

.detail-panel__body::-webkit-scrollbar-thumb {
  background: #27272A;
  border-radius: 4px;
}

/* Title section */
.detail-panel__title-section {
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.detail-panel__title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #FAFAFA;
  line-height: 1.3;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  color: #52525B;
}

.detail-panel__meta-item--root {
  color: #00D2BE;
}

.detail-panel__meta-icon {
  font-size: 12px;
}

/* Sections */
.detail-panel__section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
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
  font-size: 13px;
  color: #52525B;
}

.detail-panel__section-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #52525B;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detail-panel__section-count {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #3F3F46;
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 6px;
  border-radius: 4px;
}

/* Description */
.detail-panel__summary {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.6;
  color: #D4D4D8;
  margin: 0 0 8px;
}

.detail-panel__details {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.6;
  color: #A1A1AA;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.detail-panel__generated-at {
  display: block;
  margin-top: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  color: #3F3F46;
}

/* Empty description */
.detail-panel__empty-desc {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.detail-panel__empty-desc p {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: #52525B;
  font-style: italic;
  margin: 0;
}

.detail-panel__generate-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 6px;
  color: #00D2BE;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.detail-panel__generate-btn:hover {
  background: rgba(0, 210, 190, 0.12);
  border-color: rgba(0, 210, 190, 0.3);
}

.detail-panel__generate-btn span {
  font-size: 12px;
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
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  color: #A1A1AA;
}

/* Notes */
.detail-panel__notes {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.6;
  color: #A1A1AA;
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: #52525B;
}

.detail-panel__insight-value {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: #D4D4D8;
}

.detail-panel__insight-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-panel__insight-tag {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(167, 139, 250, 0.08);
  border: 1px solid rgba(167, 139, 250, 0.15);
  border-radius: 4px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  color: #A78BFA;
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  font-weight: 500;
  color: #3F3F46;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.detail-panel__conn-direction span:first-child {
  font-size: 11px;
}

.detail-panel__conn-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 4px;
}

.detail-panel__conn-item:last-child {
  margin-bottom: 0;
}

.detail-panel__conn-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}

.detail-panel__conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.detail-panel__conn-label {
  flex: 1;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: #A1A1AA;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-panel__conn-item:hover .detail-panel__conn-label {
  color: #FAFAFA;
}

.detail-panel__conn-arrow {
  font-size: 12px;
  color: #3F3F46;
  opacity: 0;
  transition: opacity 0.15s;
}

.detail-panel__conn-item:hover .detail-panel__conn-arrow {
  opacity: 1;
}

/* Light theme */
:root.light .detail-panel {
  background: rgba(255, 255, 255, 0.96);
  border-left-color: #E4E4E7;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.08);
}

:root.light .detail-panel__header {
  border-bottom-color: #E4E4E7;
}

:root.light .detail-panel__close {
  border-color: #E4E4E7;
  color: #A1A1AA;
}

:root.light .detail-panel__close:hover {
  color: #18181B;
  border-color: #D4D4D8;
  background: #F4F4F5;
}

:root.light .detail-panel__title {
  color: #18181B;
}

:root.light .detail-panel__title-section {
  border-bottom-color: #E4E4E7;
}

:root.light .detail-panel__section {
  border-bottom-color: #E4E4E7;
}

:root.light .detail-panel__summary {
  color: #3F3F46;
}

:root.light .detail-panel__details {
  color: #52525B;
  border-top-color: #E4E4E7;
}

:root.light .detail-panel__keyword {
  background: #F4F4F5;
  border-color: #E4E4E7;
  color: #52525B;
}

:root.light .detail-panel__notes {
  color: #52525B;
}

:root.light .detail-panel__conn-item {
  background: #FAFAFA;
  border-color: #E4E4E7;
}

:root.light .detail-panel__conn-item:hover {
  background: #F4F4F5;
  border-color: #D4D4D8;
}

:root.light .detail-panel__conn-label {
  color: #52525B;
}

:root.light .detail-panel__conn-item:hover .detail-panel__conn-label {
  color: #18181B;
}

:root.light .detail-panel__empty-desc p {
  color: #A1A1AA;
}
</style>
