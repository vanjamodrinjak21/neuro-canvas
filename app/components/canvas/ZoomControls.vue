<script setup lang="ts">
const props = defineProps<{
  zoom: number
}>()

const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  'zoom-change': [value: number]
  'zoom-set': [value: number]
  'reset-zoom': []
  'fit-to-content': []
}>()

const showZoomPresets = ref(false)

function handleSlider(event: Event) {
  const target = event.target as HTMLInputElement
  emit('zoom-change', Number.parseFloat(target.value))
}

function setZoom(value: number) {
  emit('zoom-set', value)
  showZoomPresets.value = false
}

// Close presets on click outside
function handleClickOutside() {
  showZoomPresets.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="nc-zoom-control">
    <button
      class="nc-zoom-btn"
      title="Zoom out (-)"
      aria-label="Zoom out"
      @click="emit('zoom-out')"
    >
      <span class="i-lucide-minus text-sm" />
    </button>

    <div class="nc-zoom-slider-wrapper">
      <input
        type="range"
        min="0.15"
        max="3"
        step="0.05"
        :value="zoom"
        class="nc-zoom-slider"
        aria-label="Zoom level"
        @input="handleSlider"
        @dblclick="emit('reset-zoom')"
      >
      <!-- Tick mark at 100% -->
      <div class="nc-zoom-tick" :style="{ left: `${((1 - 0.15) / (3 - 0.15)) * 100}%` }" />
    </div>

    <button
      class="nc-zoom-btn"
      title="Zoom in (+)"
      aria-label="Zoom in"
      @click="emit('zoom-in')"
    >
      <span class="i-lucide-plus text-sm" />
    </button>

    <div class="relative">
      <button
        class="nc-zoom-percentage"
        title="Zoom presets"
        aria-label="Zoom presets menu"
        @click.stop="showZoomPresets = !showZoomPresets"
      >
        {{ Math.round(zoom * 100) }}%
      </button>

      <Transition
        enter-active-class="nc-zoom-presets-enter"
        leave-active-class="nc-zoom-presets-leave"
        enter-from-class="opacity-0 translate-y-2"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="showZoomPresets"
          class="nc-zoom-presets"
          @click.stop
        >
          <div class="nc-zoom-presets-header">Zoom Level</div>
          <button :class="{ active: Math.round(zoom * 100) === 25 }" @click="setZoom(0.25)">25%</button>
          <button :class="{ active: Math.round(zoom * 100) === 50 }" @click="setZoom(0.5)">50%</button>
          <button :class="{ active: Math.round(zoom * 100) === 75 }" @click="setZoom(0.75)">75%</button>
          <button :class="{ active: Math.round(zoom * 100) === 100 }" @click="setZoom(1)">
            100%
            <span class="nc-zoom-preset-shortcut">1</span>
          </button>
          <button :class="{ active: Math.round(zoom * 100) === 150 }" @click="setZoom(1.5)">150%</button>
          <button :class="{ active: Math.round(zoom * 100) === 200 }" @click="setZoom(2)">200%</button>
          <div class="nc-zoom-presets-divider" />
          <button @click="emit('fit-to-content'); showZoomPresets = false">
            <span class="i-lucide-maximize-2 text-xs mr-1.5" />
            Fit to content
            <span class="nc-zoom-preset-shortcut">0</span>
          </button>
          <button @click="emit('reset-zoom'); showZoomPresets = false">
            <span class="i-lucide-rotate-ccw text-xs mr-1.5" />
            Reset zoom
            <span class="nc-zoom-preset-shortcut">1</span>
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.nc-zoom-slider-wrapper {
  position: relative;
}

.nc-zoom-tick {
  position: absolute;
  top: 50%;
  width: 1px;
  height: 8px;
  background: rgba(255, 255, 255, 0.15);
  transform: translateX(-50%) translateY(-50%);
  pointer-events: none;
}

.nc-zoom-presets-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nc-ink-soft);
  padding: 4px 8px 2px;
}

.nc-zoom-presets button.active {
  color: var(--nc-accent, #00D2BE);
  background: rgba(0, 210, 190, 0.08);
}

.nc-zoom-preset-shortcut {
  margin-left: auto;
  font-size: 11px;
  color: var(--nc-ink-soft);
  font-family: "SF Mono", "Fira Code", monospace;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 4px;
  border-radius: 3px;
}

.nc-zoom-presets button {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Presets panel: 150ms enter ease-out, 80ms exit */
.nc-zoom-presets-enter {
  transition: opacity 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              transform 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}

.nc-zoom-presets-leave {
  transition: opacity 80ms cubic-bezier(0.4, 0, 1, 1),
              transform 80ms cubic-bezier(0.4, 0, 1, 1);
}
</style>
