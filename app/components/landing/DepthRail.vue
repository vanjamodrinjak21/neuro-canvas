<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Right-edge depth gauge: scrolling descends into the map of thinking.
 * The marker sinks with scroll; ticks jump to stations.
 */
const { t } = useI18n()
const scrollTo = inject<(target: string) => void>('journey-scroll', () => {})

const progress = ref(0)
let trigger: ScrollTrigger | null = null

const stations = computed(() => [
  { id: '#top', label: t('topo.hero.eyebrow'), at: 0 },
  { id: '#generate', label: t('topo.s1.eyebrow'), at: 0.18 },
  { id: '#connect', label: t('topo.s2.eyebrow'), at: 0.37 },
  { id: '#collaborate', label: t('topo.s3.eyebrow'), at: 0.56 },
  { id: '#everywhere', label: t('topo.s4.eyebrow'), at: 0.75 },
  { id: '#map', label: t('topo.finale.eyebrow'), at: 0.94 },
])

const depth = computed(() => String(Math.round(progress.value * 1200)).padStart(4, '0'))

onMounted(() => {
  gsap.registerPlugin(ScrollTrigger)
  trigger = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      progress.value = self.progress
    },
  })
})

onBeforeUnmount(() => trigger?.kill())
</script>

<template>
  <nav class="rail" aria-label="Sections">
    <div class="rail__track" aria-hidden="true">
      <div class="rail__fill" :style="{ transform: `scaleY(${progress})` }" />
    </div>
    <button
      v-for="s in stations"
      :key="s.id"
      class="rail__tick"
      :class="{ 'is-passed': progress >= s.at }"
      :style="{ top: `${s.at * 100}%` }"
      type="button"
      data-cursor="link"
      @click="scrollTo(s.id)"
    >
      <span class="rail__dot" aria-hidden="true" />
      <span class="rail__label">{{ s.label }}</span>
    </button>
    <div class="rail__readout" aria-hidden="true" :style="{ top: `${progress * 100}%` }">
      DPT {{ depth }}
    </div>
  </nav>
</template>
