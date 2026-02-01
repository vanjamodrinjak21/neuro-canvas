<script setup lang="ts">
import type { GraphViewOptions } from '~/types/canvas'

const props = defineProps<{
  options: GraphViewOptions
  nodeCount: number
  edgeCount: number
}>()

const emit = defineEmits<{
  'update:options': [options: Partial<GraphViewOptions>]
  resetZoom: []
  fitToView: []
}>()

// Local state for sliders (debounced updates)
const localPhysics = reactive({
  linkDistance: props.options.physics.linkDistance,
  repulsionStrength: props.options.physics.repulsionStrength,
  centerForce: props.options.physics.centerForce,
  collisionRadius: props.options.physics.collisionRadius
})

const localDepth = ref(props.options.depth)
const searchQuery = ref(props.options.filters.searchQuery || '')

// Sync local state when props change
watch(() => props.options.physics, (newPhysics) => {
  Object.assign(localPhysics, newPhysics)
}, { deep: true })

watch(() => props.options.depth, (newDepth) => {
  localDepth.value = newDepth
})

// Debounced update for physics
const debouncedPhysicsUpdate = useDebounceFn(() => {
  emit('update:options', {
    physics: { ...localPhysics }
  })
}, 100)

// Watch local physics changes
watch(localPhysics, () => {
  debouncedPhysicsUpdate()
}, { deep: true })

// Update mode
function setMode(mode: 'local' | 'global') {
  emit('update:options', { mode })
}

// Update depth
function updateDepth() {
  emit('update:options', { depth: localDepth.value })
}

// Update search
const debouncedSearchUpdate = useDebounceFn(() => {
  emit('update:options', {
    filters: { ...props.options.filters, searchQuery: searchQuery.value }
  })
}, 300)

watch(searchQuery, () => {
  debouncedSearchUpdate()
})

// Section collapse state
const showPhysics = ref(false)
</script>

<template>
  <div class="nc-glass rounded-nc-xl overflow-hidden w-72">
    <!-- Header with stats -->
    <div class="px-4 py-3 border-b border-nc-border">
      <div class="nc-between mb-2">
        <span class="font-display font-semibold text-sm text-nc-ink">Graph Controls</span>
      </div>
      <div class="nc-row gap-4 text-xs text-nc-ink-muted">
        <span>{{ nodeCount }} nodes</span>
        <span>{{ edgeCount }} edges</span>
      </div>
    </div>

    <!-- Mode Toggle -->
    <div class="p-4 border-b border-nc-border">
      <div class="nc-label mb-2">View Mode</div>
      <div class="flex gap-2">
        <button
          :class="[
            'flex-1 py-2 px-3 rounded-nc-md text-sm font-medium transition-all duration-200',
            options.mode === 'global'
              ? 'bg-nc-accent/20 text-nc-accent border border-nc-accent'
              : 'bg-nc-surface-2 text-nc-ink-muted border border-nc-border hover:bg-nc-surface-3'
          ]"
          @click="setMode('global')"
        >
          <span class="i-lucide-globe mr-1.5" />
          Global
        </button>
        <button
          :class="[
            'flex-1 py-2 px-3 rounded-nc-md text-sm font-medium transition-all duration-200',
            options.mode === 'local'
              ? 'bg-nc-accent/20 text-nc-accent border border-nc-accent'
              : 'bg-nc-surface-2 text-nc-ink-muted border border-nc-border hover:bg-nc-surface-3'
          ]"
          @click="setMode('local')"
        >
          <span class="i-lucide-target mr-1.5" />
          Local
        </button>
      </div>
    </div>

    <!-- Depth Slider (only for local mode) -->
    <div v-if="options.mode === 'local'" class="p-4 border-b border-nc-border">
      <div class="nc-between mb-2">
        <span class="nc-label">Depth</span>
        <span class="text-sm text-nc-ink-soft">{{ localDepth }}</span>
      </div>
      <input
        v-model="localDepth"
        type="range"
        min="1"
        max="5"
        step="1"
        class="w-full nc-slider"
        @change="updateDepth"
      >
      <div class="nc-between text-xs text-nc-ink-faint mt-1">
        <span>1 hop</span>
        <span>5 hops</span>
      </div>
    </div>

    <!-- Search -->
    <div class="p-4 border-b border-nc-border">
      <div class="nc-label mb-2">Search</div>
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 i-lucide-search text-nc-ink-muted" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter nodes..."
          class="w-full pl-9 pr-3 py-2 bg-nc-surface-2 border border-nc-border rounded-nc-md text-sm text-nc-ink placeholder-nc-ink-faint focus:border-nc-accent focus:outline-none transition-colors"
        >
      </div>
    </div>

    <!-- Physics Controls (collapsible) -->
    <div class="border-b border-nc-border">
      <button
        class="w-full p-4 nc-between text-left hover:bg-nc-surface-2/50 transition-colors"
        @click="showPhysics = !showPhysics"
      >
        <span class="nc-label">Physics</span>
        <span
          :class="['i-lucide-chevron-down text-nc-ink-muted transition-transform', showPhysics && 'rotate-180']"
        />
      </button>

      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 max-h-0"
        leave-to-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-96"
        leave-from-class="opacity-100 max-h-96"
      >
        <div v-if="showPhysics" class="px-4 pb-4 flex flex-col gap-4 overflow-hidden">
          <!-- Link Distance -->
          <div>
            <div class="nc-between mb-1">
              <span class="text-xs text-nc-ink-muted">Link Distance</span>
              <span class="text-xs text-nc-ink-soft">{{ localPhysics.linkDistance }}</span>
            </div>
            <input
              v-model.number="localPhysics.linkDistance"
              type="range"
              min="50"
              max="300"
              step="10"
              class="w-full nc-slider"
            >
          </div>

          <!-- Repulsion Strength -->
          <div>
            <div class="nc-between mb-1">
              <span class="text-xs text-nc-ink-muted">Repulsion</span>
              <span class="text-xs text-nc-ink-soft">{{ Math.abs(localPhysics.repulsionStrength) }}</span>
            </div>
            <input
              v-model.number="localPhysics.repulsionStrength"
              type="range"
              min="-1000"
              max="-50"
              step="50"
              class="w-full nc-slider"
            >
          </div>

          <!-- Center Force -->
          <div>
            <div class="nc-between mb-1">
              <span class="text-xs text-nc-ink-muted">Center Force</span>
              <span class="text-xs text-nc-ink-soft">{{ localPhysics.centerForce.toFixed(2) }}</span>
            </div>
            <input
              v-model.number="localPhysics.centerForce"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="w-full nc-slider"
            >
          </div>

          <!-- Collision Radius -->
          <div>
            <div class="nc-between mb-1">
              <span class="text-xs text-nc-ink-muted">Collision Radius</span>
              <span class="text-xs text-nc-ink-soft">{{ localPhysics.collisionRadius }}</span>
            </div>
            <input
              v-model.number="localPhysics.collisionRadius"
              type="range"
              min="10"
              max="100"
              step="5"
              class="w-full nc-slider"
            >
          </div>
        </div>
      </Transition>
    </div>

    <!-- Actions -->
    <div class="p-4 flex gap-2">
      <button
        class="flex-1 py-2 px-3 rounded-nc-md bg-nc-surface-2 hover:bg-nc-surface-3 text-sm text-nc-ink-soft hover:text-nc-ink transition-all nc-center gap-1.5"
        @click="emit('resetZoom')"
      >
        <span class="i-lucide-rotate-ccw text-sm" />
        Reset
      </button>
      <button
        class="flex-1 py-2 px-3 rounded-nc-md bg-nc-surface-2 hover:bg-nc-surface-3 text-sm text-nc-ink-soft hover:text-nc-ink transition-all nc-center gap-1.5"
        @click="emit('fitToView')"
      >
        <span class="i-lucide-maximize text-sm" />
        Fit View
      </button>
    </div>
  </div>
</template>

<style scoped>
.nc-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--nc-surface-3);
  border-radius: 2px;
  outline: none;
}

.nc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--nc-accent);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.nc-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.nc-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--nc-accent);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}
</style>
