<script setup lang="ts">
/**
 * NcLogo — Canonical NeuroCanvas logo mark
 * 6-spoke neural network icon from the Paper brand identity sheet.
 * Use this everywhere instead of inline SVGs.
 */
const props = withDefaults(defineProps<{
  /** Rendered width/height of the SVG in px */
  size?: number
  /** Whether to show the teal container box */
  container?: boolean
  /** Container size override (defaults to size + padding) */
  containerSize?: number
  /** Container border-radius in px */
  radius?: number
}>(), {
  size: 18,
  container: true,
  radius: 8,
})

const boxSize = computed(() => props.containerSize ?? Math.round(props.size * 1.8))
</script>

<template>
  <div
    v-if="container"
    class="nc-logo-mark"
    :style="{
      width: `${boxSize}px`,
      height: `${boxSize}px`,
      borderRadius: `${radius}px`,
    }"
  >
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 72 72"
      fill="none"
    >
      <!-- Outer ring connections (thinner) -->
      <line x1="36" y1="14" x2="55" y2="24" stroke="#09090B" stroke-width="1.5" opacity="0.3" />
      <line x1="55" y1="24" x2="55" y2="48" stroke="#09090B" stroke-width="1.5" opacity="0.3" />
      <line x1="55" y1="48" x2="36" y2="58" stroke="#09090B" stroke-width="1.5" opacity="0.3" />
      <line x1="36" y1="58" x2="17" y2="48" stroke="#09090B" stroke-width="1.5" opacity="0.3" />
      <line x1="17" y1="48" x2="17" y2="24" stroke="#09090B" stroke-width="1.5" opacity="0.3" />
      <line x1="17" y1="24" x2="36" y2="14" stroke="#09090B" stroke-width="1.5" opacity="0.3" />
      <!-- Center-to-outer spokes -->
      <line x1="36" y1="28" x2="36" y2="19" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
      <line x1="43" y1="32" x2="50" y2="27" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
      <line x1="43" y1="40" x2="50" y2="45" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
      <line x1="36" y1="44" x2="36" y2="53" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
      <line x1="29" y1="40" x2="22" y2="45" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
      <line x1="29" y1="32" x2="22" y2="27" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
      <!-- Nodes -->
      <circle cx="36" cy="14" r="5" fill="#09090B" opacity="0.7" />
      <circle cx="55" cy="24" r="5" fill="#09090B" opacity="0.7" />
      <circle cx="55" cy="48" r="5" fill="#09090B" opacity="0.7" />
      <circle cx="36" cy="58" r="5" fill="#09090B" opacity="0.7" />
      <circle cx="17" cy="48" r="5" fill="#09090B" opacity="0.7" />
      <circle cx="17" cy="24" r="5" fill="#09090B" opacity="0.7" />
      <circle cx="36" cy="36" r="8" fill="#09090B" />
    </svg>
  </div>
  <svg
    v-else
    :width="size"
    :height="size"
    viewBox="0 0 72 72"
    fill="none"
  >
    <!-- Outer ring connections (thinner) -->
    <line x1="36" y1="14" x2="55" y2="24" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
    <line x1="55" y1="24" x2="55" y2="48" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
    <line x1="55" y1="48" x2="36" y2="58" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
    <line x1="36" y1="58" x2="17" y2="48" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
    <line x1="17" y1="48" x2="17" y2="24" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
    <line x1="17" y1="24" x2="36" y2="14" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
    <!-- Center-to-outer spokes -->
    <line x1="36" y1="28" x2="36" y2="19" stroke="currentColor" stroke-width="2.5" opacity="0.5" />
    <line x1="43" y1="32" x2="50" y2="27" stroke="currentColor" stroke-width="2.5" opacity="0.5" />
    <line x1="43" y1="40" x2="50" y2="45" stroke="currentColor" stroke-width="2.5" opacity="0.5" />
    <line x1="36" y1="44" x2="36" y2="53" stroke="currentColor" stroke-width="2.5" opacity="0.5" />
    <line x1="29" y1="40" x2="22" y2="45" stroke="currentColor" stroke-width="2.5" opacity="0.5" />
    <line x1="29" y1="32" x2="22" y2="27" stroke="currentColor" stroke-width="2.5" opacity="0.5" />
    <!-- Nodes -->
    <circle cx="36" cy="14" r="5" fill="currentColor" opacity="0.7" />
    <circle cx="55" cy="24" r="5" fill="currentColor" opacity="0.7" />
    <circle cx="55" cy="48" r="5" fill="currentColor" opacity="0.7" />
    <circle cx="36" cy="58" r="5" fill="currentColor" opacity="0.7" />
    <circle cx="17" cy="48" r="5" fill="currentColor" opacity="0.7" />
    <circle cx="17" cy="24" r="5" fill="currentColor" opacity="0.7" />
    <circle cx="36" cy="36" r="8" fill="currentColor" />
  </svg>
</template>

<style scoped>
.nc-logo-mark {
  background: var(--nc-accent, #00D2BE);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
