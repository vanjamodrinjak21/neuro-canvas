<script setup lang="ts">
import type { Node, NodeShape } from '~/types'
import { useMapStore } from '~/stores/mapStore'
// Node palette is user data — single source of truth in the sidebar state
import { nodeColors } from '~/composables/useSidebarState'

const props = defineProps<{
  node: Node | null
}>()

const emit = defineEmits<{
  close: []
}>()

const mapStore = useMapStore()
const { t } = useI18n()

// Local state for editing
const localContent = ref('')
const localNotes = ref('')
const localFontSize = ref([14])
const localFontWeight = ref('500')
const localShape = ref<NodeShape>('rounded')
const localFillColor = ref('#1A1A1E')
const localBorderColor = ref('#2A2A30')
const localTextColor = ref('#E8E8EC')

// Watch for node changes and update local state
watch(() => props.node, (newNode) => {
  if (newNode) {
    localContent.value = newNode.content
    localNotes.value = (newNode.metadata?.notes as string) || ''
    localFontSize.value = [newNode.style.fontSize]
    localFontWeight.value = String(newNode.style.fontWeight)
    localShape.value = newNode.style.shape
    localFillColor.value = newNode.style.fillColor
    localBorderColor.value = newNode.style.borderColor
    localTextColor.value = newNode.style.textColor
  }
}, { immediate: true })

// Shape options
const shapes = computed<{ value: NodeShape; icon: string; label: string }[]>(() => [
  { value: 'rounded',   icon: 'i-lucide-square',                label: t('canvas.node_props_form.shape_rounded') },
  { value: 'rectangle', icon: 'i-lucide-rectangle-horizontal',  label: t('canvas.node_props_form.shape_rectangle') },
  { value: 'circle',    icon: 'i-lucide-circle',                label: t('canvas.node_props_form.shape_circle') },
  { value: 'diamond',   icon: 'i-lucide-diamond',               label: t('canvas.node_props_form.shape_diamond') },
  { value: 'hexagon',   icon: 'i-lucide-hexagon',               label: t('canvas.node_props_form.shape_hexagon') },
  { value: 'star',      icon: 'i-lucide-star',                  label: t('canvas.node_props_form.shape_star') },
  { value: 'pill',      icon: 'i-lucide-pill',                  label: t('canvas.node_props_form.shape_pill') },
  { value: 'dot',       icon: 'i-lucide-minus',                 label: t('canvas.node_props_form.shape_dot') },
])

// Font weight options
const fontWeights = [
  { value: '400', label: 'Normal' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' }
]

// Update handlers with debounce
function updateContent() {
  if (props.node && localContent.value !== props.node.content) {
    mapStore.updateNode(props.node.id, { content: localContent.value })
  }
}

function updateNotes() {
  if (props.node) {
    mapStore.updateNode(props.node.id, {
      metadata: { ...props.node.metadata, notes: localNotes.value }
    })
  }
}

function updateShape(shape: NodeShape) {
  localShape.value = shape
  if (props.node) {
    mapStore.updateNode(props.node.id, {
      style: { ...props.node.style, shape }
    })
  }
}

function updateFontSize(value: number[]) {
  localFontSize.value = value
  if (props.node && value[0] !== undefined) {
    mapStore.updateNode(props.node.id, {
      style: { ...props.node.style, fontSize: value[0] }
    })
  }
}

function updateFontWeight(value: string) {
  localFontWeight.value = value
  if (props.node) {
    mapStore.updateNode(props.node.id, {
      style: { ...props.node.style, fontWeight: Number.parseInt(value) }
    })
  }
}

function updateFillColor(color: string) {
  localFillColor.value = color
  if (props.node) {
    mapStore.updateNode(props.node.id, {
      style: { ...props.node.style, fillColor: color }
    })
  }
}

function updateBorderColor(color: string) {
  localBorderColor.value = color
  if (props.node) {
    mapStore.updateNode(props.node.id, {
      style: { ...props.node.style, borderColor: color }
    })
  }
}

function updateTextColor(color: string) {
  localTextColor.value = color
  if (props.node) {
    mapStore.updateNode(props.node.id, {
      style: { ...props.node.style, textColor: color }
    })
  }
}

// Close on escape
onKeyStroke('Escape', () => {
  emit('close')
})
</script>

<template>
  <Transition
    enter-active-class="nc-panel-enter"
    leave-active-class="nc-panel-leave"
    enter-from-class="translate-x-full"
    leave-to-class="translate-x-full"
  >
    <aside
      v-if="node"
      class="props-panel absolute right-4 top-20 w-60 z-toolbar"
    >
      <h3 class="props-panel__title">{{ $t('canvas.node_properties.panel_title') }}</h3>

      <!-- Color dots - 20px, no labels; swatch is user node data (--swatch) -->
      <div class="flex gap-2 mb-4">
        <button
          v-for="color in nodeColors"
          :key="color"
          :class="['nc-color-dot', localBorderColor === color && 'nc-color-dot--active']"
          :style="{ '--swatch': color }"
          @click="updateBorderColor(color)"
        />
      </div>

      <!-- Shape -->
      <div class="flex flex-wrap gap-1.5 mb-3">
        <button
          v-for="shape in shapes"
          :key="shape.value"
          :title="shape.label"
          :class="['props-shape-btn', localShape === shape.value && 'props-shape-btn--active']"
          @click="updateShape(shape.value)"
        >
          <UIcon :name="shape.icon" class="w-4 h-4 opacity-70" />
        </button>
      </div>

      <!-- Label input - clean, no label above -->
      <input
        v-model="localContent"
        type="text"
        class="props-field mb-3"
        :placeholder="$t('canvas.node_panel.label_placeholder')"
        @blur="updateContent"
        @keydown.enter="updateContent"
      >

      <!-- Notes - placeholder only, expands on focus -->
      <textarea
        v-model="localNotes"
        :placeholder="$t('canvas.node_panel.notes_placeholder')"
        class="props-field props-field--area"
        rows="2"
        @blur="updateNotes"
      />
    </aside>
  </Transition>
</template>

<style scoped>
/* Panel slide: 200ms enter, 120ms exit — single ease (REDESIGN.md §6) */
.nc-panel-enter {
  transition: transform 200ms var(--nc-ease);
}

.nc-panel-leave {
  transition: transform 120ms var(--nc-ease);
}

/* Floating editor panel — flat surface + hairline, no glass (REDESIGN.md §5) */
.props-panel {
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  padding: 16px;
  box-shadow: var(--nc-shadow-md);
}

/* Mono uppercase micro-label (REDESIGN.md §4) */
.props-panel__title {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
  margin: 0 0 16px;
}

/* Color dots — swatch value is user node data via --swatch */
.nc-color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: var(--swatch);
  cursor: pointer;
  transition:
    transform var(--nc-duration-fast) var(--nc-ease),
    box-shadow var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .nc-color-dot:hover {
    transform: scale(1.15);
  }
}

.nc-color-dot:active {
  transform: scale(0.97);
}

/* Active swatch = offset ring (never color alone) */
.nc-color-dot--active {
  box-shadow: 0 0 0 2px var(--nc-surface-2), 0 0 0 4px var(--nc-text);
}

/* Shape buttons — active = accent tint + accent border (never color alone) */
.props-shape-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition:
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .props-shape-btn:hover {
    background: var(--nc-surface-3);
  }
}

.props-shape-btn:active {
  transform: scale(0.97);
}

.props-shape-btn--active {
  background: rgba(var(--nc-accent-rgb), 0.08);
  border-color: var(--nc-accent);
  color: var(--nc-accent-text);
}

/* Inputs — chip fill, hairline, accent focus border only (REDESIGN.md §5) */
.props-field {
  width: 100%;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: 0.5rem;
  padding: 8px 12px;
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  transition: border-color 150ms var(--nc-ease);
}

.props-field::placeholder {
  color: var(--nc-text-dim);
}

.props-field:focus {
  outline: none;
  border-color: var(--nc-accent);
}

.props-field--area {
  resize: none;
}
</style>
