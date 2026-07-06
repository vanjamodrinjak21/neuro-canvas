<script setup lang="ts">
/**
 * NcAiMark — the ONE AI glyph (AER-76).
 *
 * Every AI-related action in the app (generate, expand, suggestions, adapt,
 * agent, AI status) renders this mark: the brand connected-nodes glyph from
 * NcLogo — two dots + one dot connected, "the smallest possible mind map".
 *
 * Drawn entirely in currentColor so it follows the surrounding text tier
 * (accent on AI CTAs, secondary in chrome) in both themes. Decorative by
 * default (`aria-hidden="true"`) — the accompanying label/tooltip carries
 * the accessible name.
 *
 * For icon sites that bind icon CLASS STRINGS (command palette items,
 * context-menu configs, status maps), use the `.i-nc-ai-mark` utility in
 * app/assets/css/components.css — it encodes the SAME geometry as a CSS
 * mask and must stay in sync with this file.
 */
withDefaults(defineProps<{
  /** Rendered width/height of the SVG in px */
  size?: number
}>(), {
  size: 18,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
    class="nc-ai-mark"
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
.nc-ai-mark {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: -0.125em;
}
</style>
