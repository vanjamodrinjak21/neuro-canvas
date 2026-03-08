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
      <span
        class="sidebar-header__accent"
        :style="{ backgroundColor: accentColor }"
      />
      <span :class="[icon, 'sidebar-header__icon']" :style="{ color: accentColor }" />
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
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 0;
  position: relative;
}

.sidebar-header:hover {
  background: var(--nc-accent-glow);
}

.sidebar-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-header__accent {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.sidebar-header:hover .sidebar-header__accent {
  opacity: 1;
}

.sidebar-header__icon {
  font-size: 14px;
  transition: color 0.2s ease;
}

.sidebar-header__label {
  font-family: var(--nc-font-display);
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: color 0.2s ease;
}

.sidebar-header:hover .sidebar-header__label {
  color: var(--nc-ink);
}

.sidebar-header__badge {
  background: var(--nc-surface-3);
  color: var(--nc-ink-muted);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  min-width: 22px;
  text-align: center;
  font-family: var(--nc-font-mono);
  line-height: 1.4;
}

.sidebar-header__chevron {
  font-size: 12px;
  color: var(--nc-ink-faint);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-header:hover .sidebar-header__chevron {
  color: var(--nc-ink-soft);
}

.sidebar-header__chevron--collapsed {
  transform: rotate(-90deg);
}
</style>
