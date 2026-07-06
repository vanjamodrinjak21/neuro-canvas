<script setup lang="ts">
/**
 * NcLogo — Canonical NeuroCanvas logo mark
 * Three connected thought-nodes — the smallest possible mind map.
 * Theme-aware: drawn entirely in currentColor (stroke dimmed via
 * opacity). The container variant sets color: var(--nc-text) so the
 * mark renders correctly on both #050508 and #FAFAF9; the bare
 * variant inherits color from its parent (e.g. the landing brand).
 * Use this everywhere instead of inline SVGs.
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

// Dynamic sizing flows through v-bind() custom properties in the scoped
// style block — no inline :style (REDESIGN.md §9).
const boxSizePx = computed(() => `${props.containerSize ?? Math.round(props.size * 1.8)}px`)
const radiusPx = computed(() => `${props.radius}px`)
</script>

<template>
  <div
    v-if="container"
    class="nc-logo-mark"
  >
    <svg
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
  width: v-bind(boxSizePx);
  height: v-bind(boxSizePx);
  border-radius: v-bind(radiusPx);
  background: var(--nc-bg);
  border: 1px solid var(--nc-border);
  color: var(--nc-text);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 0;
}
</style>
