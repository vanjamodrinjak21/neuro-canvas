<script setup lang="ts">
/**
 * NcCardSchematic — the ONE map-card preview device (AER-76).
 *
 * Every map-like card (maps grid, dashboard recent maps, template gallery)
 * renders this calm schematic instead of a live render of the actual graph:
 * uniform neutral pill rows with exactly one accent hub pill — the same
 * stylized layout on every card — plus a mono uppercase node-count readout
 * pinned to the bottom-right corner of the preview frame.
 *
 * The component absolutely fills its frame, so the parent supplies the
 * preview box (fixed height, `background: var(--nc-surface)`,
 * `position: relative`). Decorative by design (`aria-hidden="true"`) — the
 * card's meta line carries the node count for assistive tech.
 */
defineProps<{
  /** Node count shown in the corner readout */
  count: number
}>()

const { t } = useI18n()
</script>

<template>
  <div class="nc-schematic" aria-hidden="true">
    <div class="nc-schematic-rows">
      <div class="nc-schematic-row">
        <span class="nc-schematic-pill accent nc-w48" />
        <span class="nc-schematic-pill nc-w56" />
      </div>
      <div class="nc-schematic-row nc-schematic-row--mid">
        <span class="nc-schematic-pill dim nc-w40" />
        <span class="nc-schematic-pill hub nc-hub" />
        <span class="nc-schematic-pill dim nc-w44" />
      </div>
      <div class="nc-schematic-row">
        <span class="nc-schematic-pill accent nc-w44" />
        <span class="nc-schematic-pill dim nc-w50" />
      </div>
    </div>
    <span class="nc-schematic-count">{{ t('maps.nodes_count', { n: count }) }}</span>
  </div>
</template>

<style scoped>
/* Fills the parent preview frame (parent: position:relative + fixed height) */
.nc-schematic {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.nc-schematic-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.nc-schematic-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nc-schematic-row--mid { gap: 12px; }

/* Neutral pill rows + exactly ONE solid accent hub (maps canonical) */
.nc-schematic-pill {
  height: 16px;
  border-radius: 0.35rem;
  background: var(--nc-border);
  flex-shrink: 0;
}

.nc-schematic-pill.dim { background: var(--nc-border-subtle); }
.nc-schematic-pill.accent { background: rgba(var(--nc-accent-rgb), 0.32); }
.nc-schematic-pill.hub { background: rgba(var(--nc-accent-rgb), 0.85); }

/* Static pill widths (no inline styles — REDESIGN.md §9) */
.nc-w40 { width: 40px; }
.nc-w44 { width: 44px; }
.nc-w48 { width: 48px; }
.nc-w50 { width: 50px; }
.nc-w56 { width: 56px; }
.nc-hub { width: 52px; height: 22px; }

/* Node-count readout — mono uppercase micro-label, frame corner */
.nc-schematic-count {
  position: absolute;
  right: 12px;
  bottom: 10px;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-muted);
}
</style>
