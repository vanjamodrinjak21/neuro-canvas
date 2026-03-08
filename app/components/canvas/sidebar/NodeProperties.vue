<script setup lang="ts">
import type { Node } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import { nodeCategories, nodeColors, getCategoryInfo } from '~/composables/useSidebarState'

/**
 * NodeProperties — Property editor for the selected node
 * Uses Nc* UI primitives for consistency
 */
const props = defineProps<{
  selectedNode: Node | null
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
  deleteNode: []
}>()

const mapStore = useMapStore()

// Local editing state
const localContent = ref('')
const localNotes = ref('')
const localBorderColor = ref('#2A2A30')
const localCategory = ref<string | null>(null)

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
</script>

<template>
  <div class="properties">
    <CanvasSidebarSidebarHeader
      icon="i-lucide-sliders-horizontal"
      label="Properties"
      :collapsed="collapsed"
      accent-color="#60A5FA"
      @toggle="emit('toggle')"
    />

    <div :class="['properties__body', collapsed && 'properties__body--collapsed']">
      <template v-if="selectedNode">
        <!-- Category chips -->
        <div class="properties__field">
          <label class="properties__label">
            <span class="i-lucide-tag properties__label-icon" />
            Category
          </label>
          <div class="properties__categories">
            <button
              v-for="cat in nodeCategories"
              :key="cat.id"
              :class="['properties__cat-chip', localCategory === cat.id && 'properties__cat-chip--active']"
              :style="{
                '--chip-color': cat.color,
                ...(localCategory === cat.id ? {
                  borderColor: cat.color,
                  background: `${cat.color}12`,
                } : {}),
              }"
              @click="updateCategory(cat.id)"
            >
              <span :class="cat.icon" class="properties__cat-icon" />
              <span>{{ cat.label }}</span>
            </button>
          </div>
        </div>

        <!-- Color palette -->
        <div class="properties__field">
          <label class="properties__label">
            <span class="i-lucide-palette properties__label-icon" />
            Color
          </label>
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

        <!-- Label -->
        <div class="properties__field">
          <label class="properties__label">
            <span class="i-lucide-type properties__label-icon" />
            Label
          </label>
          <NcInput
            v-model="localContent"
            size="sm"
            placeholder="Node label..."
            @blur="updateContent"
            @keydown.enter="updateContent"
          />
        </div>

        <!-- Notes -->
        <div class="properties__field">
          <label class="properties__label">
            <span class="i-lucide-file-edit properties__label-icon" />
            Notes
          </label>
          <textarea
            v-model="localNotes"
            placeholder="Add notes..."
            class="properties__textarea"
            rows="3"
            @blur="updateNotes"
          />
        </div>

        <!-- Delete -->
        <NcButton
          variant="danger"
          size="sm"
          class="properties__delete"
          @click="emit('deleteNode')"
        >
          <span class="i-lucide-trash-2" />
          Delete Node
        </NcButton>
      </template>

      <!-- Empty state -->
      <div v-else class="properties__empty">
        <span class="i-lucide-mouse-pointer-click properties__empty-icon" />
        <p>Select a node to edit</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.properties {
}

.properties__body {
  padding: 0 14px 14px;
  overflow: hidden;
  max-height: 600px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.properties__body--collapsed {
  max-height: 0;
  padding-bottom: 0;
  opacity: 0;
}

/* Fields */
.properties__field {
  margin-bottom: 14px;
}

.properties__label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  color: var(--nc-ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 7px;
}

.properties__label-icon {
  font-size: 11px;
  opacity: 0.7;
}

/* Category chips */
.properties__categories {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.properties__cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  background: transparent;
  border: 1px solid var(--nc-border-active);
  border-radius: 6px;
  color: var(--nc-ink-soft);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.properties__cat-chip:hover {
  background: var(--nc-surface-3);
  color: var(--nc-ink);
  border-color: var(--chip-color);
}

.properties__cat-chip--active {
  color: var(--nc-ink);
  font-weight: 600;
}

.properties__cat-icon {
  font-size: 11px;
  color: var(--chip-color);
}

/* Colors */
.properties__colors {
  display: flex;
  gap: 6px;
}

.properties__color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.properties__color-dot:hover {
  transform: scale(1.15);
  box-shadow: 0 0 12px currentColor;
}

.properties__color-dot--active {
  border-color: var(--nc-ink);
  transform: scale(1.1);
}

.properties__color-check {
  font-size: 12px;
  color: var(--nc-bg);
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
}

/* Textarea */
.properties__textarea {
  width: 100%;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  font-family: var(--nc-font-body);
  color: var(--nc-ink);
  resize: none;
  min-height: 64px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.properties__textarea::placeholder {
  color: var(--nc-ink-faint);
}

.properties__textarea:focus {
  outline: none;
  border-color: var(--nc-accent);
  box-shadow: 0 0 0 3px var(--nc-accent-glow);
}

/* Delete */
.properties__delete {
  width: 100%;
  margin-top: 4px;
}

/* Empty */
.properties__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 0;
  color: var(--nc-ink-faint);
  font-size: 11px;
}

.properties__empty-icon {
  font-size: 22px;
  opacity: 0.4;
}
</style>
