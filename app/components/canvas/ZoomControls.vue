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
  emit('zoom-change', parseFloat(target.value))
}

function setZoom(value: number) {
  emit('zoom-set', value)
  showZoomPresets.value = false
}
</script>

<template>
  <div class="nc-zoom-control">
    <button
      class="nc-zoom-btn"
      title="Zoom out"
      @click="emit('zoom-out')"
    >
      <span class="i-lucide-minus text-sm" />
    </button>

    <div class="nc-zoom-slider-wrapper">
      <input
        type="range"
        min="0.25"
        max="2"
        step="0.05"
        :value="zoom"
        class="nc-zoom-slider"
        @input="handleSlider"
        @dblclick="emit('reset-zoom')"
      >
    </div>

    <button
      class="nc-zoom-btn"
      title="Zoom in"
      @click="emit('zoom-in')"
    >
      <span class="i-lucide-plus text-sm" />
    </button>

    <div class="relative">
      <button
        class="nc-zoom-percentage"
        @click.stop="showZoomPresets = !showZoomPresets"
      >
        {{ Math.round(zoom * 100) }}%
      </button>

      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        leave-active-class="transition-all duration-100 ease-in"
        enter-from-class="opacity-0 translate-y-2"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="showZoomPresets"
          class="nc-zoom-presets"
          @click.stop
        >
          <button @click="setZoom(0.25)">25%</button>
          <button @click="setZoom(0.5)">50%</button>
          <button @click="setZoom(0.75)">75%</button>
          <button @click="setZoom(1)">100%</button>
          <button @click="setZoom(1.5)">150%</button>
          <button @click="setZoom(2)">200%</button>
          <div class="nc-zoom-presets-divider" />
          <button @click="emit('fit-to-content'); showZoomPresets = false">Fit to content</button>
        </div>
      </Transition>
    </div>
  </div>
</template>
