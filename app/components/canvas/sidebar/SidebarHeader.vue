<script setup lang="ts">
/**
 * SidebarHeader — Reusable collapsible section header
 * Used across all sidebar sections for consistent visual hierarchy
 */
export interface SidebarHeaderProps {
  icon: string
  label: string
  collapsed?: boolean
  badge?: string | number
  accentColor?: string
}

const props = withDefaults(defineProps<SidebarHeaderProps>(), {
  collapsed: false,
  accentColor: 'var(--nc-accent)',
})

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <button
    class="sidebar-header"
    :aria-expanded="!collapsed"
    @click="emit('toggle')"
  >
    <span class="sidebar-header__left">
      <span class="sidebar-header__accent" />
      <span :class="[icon, 'sidebar-header__icon']" />
      <span class="sidebar-header__label">{{ label }}</span>
      <span v-if="badge !== undefined" class="sidebar-header__badge">
        {{ badge }}
      </span>
    </span>
    <span
      :class="[
        'i-lucide-chevron-down sidebar-header__chevron',
        collapsed && 'sidebar-header__chevron--collapsed',
      ]"
    />
  </button>
</template>

<style scoped>
.sidebar-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 200ms var(--nc-ease);
  border-radius: 0;
  position: relative;
}

@media (hover: hover) and (pointer: fine) {
  .sidebar-header:hover {
    background: var(--nc-chip-bg);
  }
}

.sidebar-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* accentColor prop drives the marker + icon via v-bind (no inline :style) */
.sidebar-header__accent {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background-color: v-bind(accentColor);
  opacity: 0.7;
  transition: opacity 200ms var(--nc-ease);
}

.sidebar-header:hover .sidebar-header__accent {
  opacity: 1;
}

.sidebar-header__icon {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: v-bind(accentColor);
  transition: color 200ms var(--nc-ease);
}

/* Mono uppercase micro-label — panel section header grammar (REDESIGN.md §4) */
.sidebar-header__label {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  transition: color 200ms var(--nc-ease);
}

.sidebar-header:hover .sidebar-header__label {
  color: var(--nc-ink);
}

.sidebar-header__badge {
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  color: var(--nc-ink-muted);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 0.4rem;
  min-width: 22px;
  text-align: center;
  font-family: var(--nc-font-mono);
  line-height: 1.4;
}

.sidebar-header__chevron {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-ink-faint);
  transition: color 200ms var(--nc-ease), transform 250ms var(--nc-ease);
}

.sidebar-header:hover .sidebar-header__chevron {
  color: var(--nc-ink-soft);
}

.sidebar-header__chevron--collapsed {
  transform: rotate(-90deg);
}
</style>
