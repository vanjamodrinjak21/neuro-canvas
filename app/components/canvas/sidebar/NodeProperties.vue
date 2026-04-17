<script setup lang="ts">
import type { Node } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import { nodeCategories, nodeColors, getCategoryInfo } from '~/composables/useSidebarState'
import { SIDEBAR_DISPATCH_KEY } from '~/types/sidebar'

/**
 * NodeProperties — Property editor for the selected node
 * Redesigned with structured form fields, character count, and footer actions
 */
const props = defineProps<{
  selectedNode: Node | null
}>()

const emit = defineEmits<{
  deleteNode: []
}>()

const dispatch = inject(SIDEBAR_DISPATCH_KEY)!
const mapStore = useMapStore()

// Local editing state
const localContent = ref('')
const localNotes = ref('')
const localBorderColor = ref('#2A2A30')
const localCategory = ref<string | null>(null)

const labelMaxLength = 50

// Sync from prop
watch(() => props.selectedNode, (node) => {
  if (node) {
    localContent.value = node.content
    localNotes.value = (node.metadata?.notes as string) || ''
    localBorderColor.value = node.style.borderColor
    localCategory.value = (node.metadata?.category as string) || null
  }
}, { immediate: true })

function updateContent() {
  if (props.selectedNode && localContent.value !== props.selectedNode.content) {
    mapStore.updateNode(props.selectedNode.id, { content: localContent.value })
  }
}

function updateNotes() {
  if (props.selectedNode) {
    mapStore.updateNode(props.selectedNode.id, {
      metadata: { ...props.selectedNode.metadata, notes: localNotes.value },
    })
  }
}

function updateBorderColor(color: string) {
  localBorderColor.value = color
  if (props.selectedNode) {
    mapStore.updateNode(props.selectedNode.id, {
      style: { ...props.selectedNode.style, borderColor: color },
    })
  }
}

function updateCategory(categoryId: string) {
  localCategory.value = categoryId
  if (props.selectedNode) {
    const cat = getCategoryInfo(categoryId)
    mapStore.updateNode(props.selectedNode.id, {
      metadata: { ...props.selectedNode.metadata, category: categoryId },
      style: { ...props.selectedNode.style, borderColor: cat.color },
    })
  }
}

const connectionCount = computed(() => {
  if (!props.selectedNode) return 0
  return Array.from(mapStore.edges.values()).filter(
    e => e.source === props.selectedNode!.id || e.target === props.selectedNode!.id
  ).length
})

// Category chips for display
const categoryChips = computed(() => [
  { id: 'main-fact', label: 'Concept', color: '#00D2BE' },
  { id: 'description', label: 'Desc', color: '#60A5FA' },
  { id: 'evidence', label: 'Evidence', color: '#4ADE80' },
  { id: 'question', label: 'Question', color: '#FACC15' },
  { id: 'idea', label: 'Idea', color: '#FB923C' },
  { id: 'reference', label: 'Ref', color: '#A78BFA' },
])
</script>

<template>
  <div class="properties">
    <template v-if="selectedNode">
      <!-- Node header -->
      <div class="properties__header">
        <div
          class="properties__avatar"
          :style="{ background: `${selectedNode.style?.borderColor || '#00D2BE'}1F` }"
        >
          <span :style="{ color: selectedNode.style?.borderColor || '#00D2BE' }">
            {{ selectedNode.content.charAt(0).toUpperCase() }}
          </span>
        </div>
        <div class="properties__header-info">
          <span class="properties__header-name">{{ selectedNode.content }}</span>
          <span class="properties__header-meta">Root node · {{ connectionCount }} connections</span>
        </div>
        <button class="properties__edit-btn">
          <span class="i-lucide-pencil" />
        </button>
      </div>

      <!-- Form fields -->
      <div class="properties__fields">
        <!-- Category -->
        <div class="properties__field">
          <label class="properties__label">Category</label>
          <div class="properties__categories">
            <button
              v-for="chip in categoryChips"
              :key="chip.id"
              :class="['properties__cat-chip', localCategory === chip.id && 'properties__cat-chip--active']"
              :style="localCategory === chip.id ? {
                background: `${chip.color}1A`,
                borderColor: `${chip.color}40`,
                color: chip.color,
              } : {}"
              @click="updateCategory(chip.id)"
            >
              <span class="properties__cat-dot" :style="{ background: chip.color }" />
              <span>{{ chip.label }}</span>
            </button>
          </div>
        </div>

        <!-- Color -->
        <div class="properties__field">
          <label class="properties__label">Color</label>
          <div class="properties__colors">
            <button
              v-for="color in nodeColors"
              :key="color"
              :class="['properties__color-dot', localBorderColor === color && 'properties__color-dot--active']"
              :style="{ backgroundColor: color }"
              @click="updateBorderColor(color)"
            >
              <span
                v-if="localBorderColor === color"
                class="i-lucide-check properties__color-check"
              />
            </button>
          </div>
        </div>

        <!-- Shape -->
        <div class="properties__field">
          <label class="properties__label">Shape</label>
          <div class="properties__select">
            <span class="i-lucide-square properties__select-icon" />
            <span class="properties__select-value">Rounded</span>
            <span class="i-lucide-chevron-down properties__select-chevron" />
          </div>
        </div>

        <!-- Label -->
        <div class="properties__field">
          <div class="properties__label-row">
            <label class="properties__label">Label</label>
            <span class="properties__char-count">{{ localContent.length }}/{{ labelMaxLength }}</span>
          </div>
          <input
            v-model="localContent"
            type="text"
            placeholder="Node label..."
            class="properties__input"
            :maxlength="labelMaxLength"
            @blur="updateContent"
            @keydown.enter="updateContent"
          >
        </div>

        <!-- Notes -->
        <div class="properties__field">
          <label class="properties__label">Notes</label>
          <textarea
            v-model="localNotes"
            placeholder="Add notes about this node..."
            class="properties__textarea"
            rows="3"
            @blur="updateNotes"
          />
        </div>
      </div>

      <!-- Footer actions -->
      <div class="properties__footer">
        <button
          class="properties__footer-btn"
          @click="dispatch({ type: 'node:duplicate' })"
        >
          <span class="i-lucide-copy" />
          Duplicate
        </button>
        <button
          class="properties__footer-btn properties__footer-btn--danger"
          @click="emit('deleteNode')"
        >
          <span class="i-lucide-trash-2" />
          Delete
        </button>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else class="properties__empty">
      <span class="i-lucide-mouse-pointer-click properties__empty-icon" />
      <p>Select a node to edit</p>
    </div>
  </div>
</template>

<style scoped>
.properties {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Header */
.properties__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #1A1A1E;
  flex-shrink: 0;
}

.properties__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 700;
}

.properties__header-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.properties__header-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #FAFAFA;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.properties__header-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  color: #52525B;
}

.properties__edit-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 6px;
  color: #52525B;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.properties__edit-btn:hover {
  color: #A1A1AA;
  border-color: #27272A;
}

/* Fields */
.properties__fields {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

.properties__field {
  margin-bottom: 16px;
}

.properties__label {
  display: block;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: #52525B;
  letter-spacing: 0.02em;
  margin-bottom: 6px;
}

.properties__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.properties__label-row .properties__label {
  margin-bottom: 0;
}

.properties__char-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #27272A;
}

/* Category chips */
.properties__categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.properties__cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: transparent;
  border: 1px solid #27272A;
  border-radius: 6px;
  color: #71717A;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.properties__cat-chip:hover {
  border-color: #3F3F46;
  color: #A1A1AA;
}

.properties__cat-chip--active {
  font-weight: 600;
}

.properties__cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Colors */
.properties__colors {
  display: flex;
  gap: 8px;
}

.properties__color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.properties__color-dot:hover {
  transform: scale(1.15);
}

.properties__color-dot--active {
  box-shadow: 0 0 0 2px #09090B, 0 0 0 4px currentColor;
  transform: scale(1.05);
}

.properties__color-check {
  font-size: 12px;
  color: #09090B;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
}

/* Select (Shape dropdown) */
.properties__select {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.properties__select:hover {
  border-color: #27272A;
}

.properties__select-icon {
  font-size: 14px;
  color: #71717A;
}

.properties__select-value {
  flex: 1;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #D4D4D8;
}

.properties__select-chevron {
  font-size: 12px;
  color: #52525B;
}

/* Input */
.properties__input {
  width: 100%;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500;
  color: #FAFAFA;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.properties__input::placeholder {
  color: #3F3F46;
}

.properties__input:focus {
  outline: none;
  border-color: var(--nc-accent);
  box-shadow: 0 0 0 3px var(--nc-accent-glow);
}

/* Textarea */
.properties__textarea {
  width: 100%;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--nc-ink);
  resize: none;
  min-height: 80px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.properties__textarea::placeholder {
  color: #3F3F46;
}

.properties__textarea:focus {
  outline: none;
  border-color: var(--nc-accent);
  box-shadow: 0 0 0 3px var(--nc-accent-glow);
}

/* Footer actions */
.properties__footer {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid #1A1A1E;
  flex-shrink: 0;
}

.properties__footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 8px;
  color: #71717A;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.properties__footer-btn:hover {
  border-color: #27272A;
  color: #A1A1AA;
}

.properties__footer-btn--danger {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

.properties__footer-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
}

.properties__footer-btn span:first-child {
  font-size: 13px;
}

/* Empty */
.properties__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 40px 16px;
  color: var(--nc-ink-faint);
  font-size: 11px;
}

.properties__empty-icon {
  font-size: 18px;
  opacity: 0.4;
}

/* Light theme */
:root.light .properties__header {
  border-bottom-color: #E4E4E7;
}

:root.light .properties__header-name {
  color: #18181B;
}

:root.light .properties__avatar {
  background: rgba(0, 210, 190, 0.08);
}

:root.light .properties__edit-btn {
  background: #F4F4F5;
  border-color: #E4E4E7;
}

:root.light .properties__label {
  color: #71717A;
}

:root.light .properties__cat-chip {
  border-color: #E4E4E7;
  color: #71717A;
}

:root.light .properties__select,
:root.light .properties__input,
:root.light .properties__textarea {
  background: #F4F4F5;
  border-color: #E4E4E7;
  color: #18181B;
}

:root.light .properties__footer {
  border-top-color: #E4E4E7;
}

:root.light .properties__footer-btn {
  background: #F4F4F5;
  border-color: #E4E4E7;
  color: #71717A;
}
</style>
