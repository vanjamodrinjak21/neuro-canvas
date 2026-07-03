<script setup lang="ts">
/**
 * NcLogo — Canonical NeuroCanvas logo mark
 * Three connected thought-nodes (monochrome white) — the smallest
 * possible mind map. Use this everywhere instead of inline SVGs.
 */
const props = withDefaults(defineProps<{
  /** Rendered width/height of the SVG in px */
  size?: number
  /** Whether to show the dark container box */
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
      viewBox="0 0 64 64"
      fill="none"
    >
      <path
        d="M19.5 42.5 42.5 21M20.5 46l24.5 1.6"
        stroke="rgba(244,244,248,0.55)"
        stroke-width="3.2"
        stroke-linecap="round"
      />
      <circle cx="14.5" cy="46.5" r="7" fill="#F4F4F8" />
      <circle cx="47.5" cy="16" r="8.4" fill="#F4F4F8" />
      <circle cx="49.5" cy="48" r="4.9" fill="#F4F4F8" />
    </svg>
  </div>
  <svg
    v-else
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    fill="none"
  >
    <path
      d="M19.5 42.5 42.5 21M20.5 46l24.5 1.6"
      stroke="currentColor"
      stroke-width="3.2"
      stroke-linecap="round"
      opacity="0.55"
    />
    <circle cx="14.5" cy="46.5" r="7" fill="currentColor" />
    <circle cx="47.5" cy="16" r="8.4" fill="currentColor" />
    <circle cx="49.5" cy="48" r="4.9" fill="currentColor" />
  </svg>
</template>

<style scoped>
.nc-logo-mark {
  background: #050508;
  border: 1px solid rgba(244, 244, 248, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 0;
}
</style>
