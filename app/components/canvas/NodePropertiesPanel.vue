<script setup lang="ts">
import type { Node, NodeShape } from '~/types'
import { useMapStore } from '~/stores/mapStore'

const props = defineProps<{
  node: Node | null
}>()

const emit = defineEmits<{
  close: []
}>()

const mapStore = useMapStore()

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
const shapes: { value: NodeShape; icon: string; label: string }[] = [
  { value: 'rounded',   icon: 'i-lucide-square',                label: 'Rounded' },
  { value: 'rectangle', icon: 'i-lucide-rectangle-horizontal',  label: 'Rectangle' },
  { value: 'circle',    icon: 'i-lucide-circle',                label: 'Circle' },
  { value: 'diamond',   icon: 'i-lucide-diamond',               label: 'Diamond' },
  { value: 'hexagon',   icon: 'i-lucide-hexagon',               label: 'Hexagon' },
  { value: 'star',      icon: 'i-lucide-star',                  label: 'Star' },
  { value: 'pill',      icon: 'i-lucide-pill',                  label: 'Pill' },
  { value: 'dot',       icon: 'i-lucide-minus',                 label: 'Dot' },
]

// Font weight options
const fontWeights = [
  { value: '400', label: 'Normal' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' }
]

// Color presets
const colorPresets = [
  '#1A1A1E', '#2A2A30', '#3A3A42',
  '#00D2BE', '#00A89A', '#22C55E',
  '#EAB308', '#EF4444', '#3B82F6'
]

// Node colors for minimal panel (border colors)
const nodeColors = [
  '#00D2BE', // Teal
  '#A78BFA', // Purple
  '#F472B6', // Pink
  '#60A5FA', // Blue
  '#4ADE80', // Green
  '#FB923C', // Orange
  '#FACC15'  // Yellow
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
      class="absolute right-4 top-20 w-60 z-toolbar bg-[#111114] border border-[#1E1E22] rounded-xl p-4"
    >
      <h3 class="text-xs font-semibold text-[#888890] mb-4">Properties</h3>

      <!-- Color dots - 20px, no labels -->
      <div class="flex gap-2 mb-4">
        <button
          v-for="color in nodeColors"
          :key="color"
          class="nc-color-dot"
          :class="localBorderColor === color ? 'ring-2 ring-[#FAFAFA] ring-offset-2 ring-offset-[#111114]' : ''"
          :style="{ backgroundColor: color }"
          @click="updateBorderColor(color)"
        />
      </div>

      <!-- Shape -->
      <div class="flex flex-wrap gap-1.5 mb-3">
        <button
          v-for="shape in shapes"
          :key="shape.value"
          :title="shape.label"
          class="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
          :class="localShape === shape.value
            ? 'bg-teal-500/20 ring-1 ring-teal-500'
            : 'hover:bg-white/5'"
          @click="updateShape(shape.value)"
        >
          <UIcon :name="shape.icon" class="w-4 h-4 opacity-70" />
        </button>
      </div>

      <!-- Label input - clean, no label above -->
      <input
        v-model="localContent"
        type="text"
        class="w-full bg-[#1A1A1E] border border-[#1E1E22] rounded-lg px-3 py-2 text-sm text-[#FAFAFA] placeholder-[#555558] focus:border-[#00D2BE] focus:outline-none mb-3"
        placeholder="Label..."
        @blur="updateContent"
        @keydown.enter="updateContent"
      >

      <!-- Notes - placeholder only, expands on focus -->
      <textarea
        v-model="localNotes"
        placeholder="Notes..."
        class="w-full bg-[#1A1A1E] border border-[#1E1E22] rounded-lg px-3 py-2 text-sm text-[#FAFAFA] placeholder-[#555558] focus:border-[#00D2BE] focus:outline-none resize-none"
        rows="2"
        @blur="updateNotes"
      />
    </aside>
  </Transition>
</template>

<style scoped>
/* Panel slide: 200ms ease-out enter, 120ms exit */
.nc-panel-enter {
  transition: transform 200ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}

.nc-panel-leave {
  transition: transform 120ms cubic-bezier(0.4, 0, 1, 1);
}

/* Color dots */
.nc-color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: transform var(--nc-duration-fast, 150ms) var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}

@media (hover: hover) and (pointer: fine) {
  .nc-color-dot:hover {
    transform: scale(1.15);
  }
}
</style>
