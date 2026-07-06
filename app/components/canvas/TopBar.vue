<script setup lang="ts">
import type { NavigationBreadcrumb, MapRegion } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'
import { useAutoSave } from '~/composables/useAutoSave'

const props = defineProps<{
  isEditingTitle: boolean
  editedTitle: string
  isAILoading: boolean
  hasSelection: boolean
  breadcrumbs?: NavigationBreadcrumb[]
  regions?: MapRegion[]
  viewMode?: 'canvas' | 'graph' | 'editor'
}>()

const emit = defineEmits<{
  'start-editing': []
  'save-title': []
  'cancel-edit': []
  'title-input': [value: string]
  'smart-expand': []
  'save': []
  'open-shortcuts': []
  'undo': []
  'redo': []
  'share': []
  'version-history': []
  'comments': []
  'export-png': []
  'export-pdf': []
  'export-json': []
  'export-markdown': []
  'settings': []
  'navigate-breadcrumb': [crumb: NavigationBreadcrumb]
  'set-view': [mode: 'canvas' | 'graph' | 'editor']
}>()

const mapStore = useMapStore()
const autoSave = useAutoSave()
const { t } = useI18n()

const titleInputRef = ref<HTMLInputElement | null>(null)

function focusTitleInput() {
  nextTick(() => {
    const el = titleInputRef.value
    if (el) {
      el.focus()
      el.select()
    }
  })
}

// Relative save time
const now = ref(Date.now())
let saveTimeInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  saveTimeInterval = setInterval(() => {
    now.value = Date.now()
  }, 10000)
})

onUnmounted(() => {
  if (saveTimeInterval) clearInterval(saveTimeInterval)
})

const relativeSaveTime = computed(() => {
  const lastSaved = autoSave.lastSavedAt.value
  if (!lastSaved) return null
  const diff = Math.floor((now.value - lastSaved) / 1000)
  if (diff < 5) return t('canvas.topbar.save_status.just_saved')
  if (diff < 60) return t('canvas.topbar.save_status.saved_seconds_ago', { n: diff })
  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return t('canvas.topbar.save_status.saved_minutes_ago', { n: minutes })
  return t('canvas.topbar.save_status.saved_hours_ago', { n: Math.floor(minutes / 60) })
})

// Named breadcrumbs (map to nearest region label)
const namedBreadcrumbs = computed(() => {
  const crumbs = props.breadcrumbs ?? []
  const regions = props.regions ?? []
  // Last 5 breadcrumbs
  return crumbs.slice(-5).map(crumb => {
    const viewCenterX = -crumb.x / crumb.zoom + window.innerWidth / crumb.zoom / 2
    const viewCenterY = -crumb.y / crumb.zoom + window.innerHeight / crumb.zoom / 2

    let label: string | null = null
    let minDist = Infinity

    for (const region of regions) {
      const dx = viewCenterX - region.centerX
      const dy = viewCenterY - region.centerY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist && dist < 500) {
        minDist = dist
        label = region.label
      }
    }

    return {
      ...crumb,
      label: label || `${Math.round(crumb.zoom * 100)}%`
    }
  })
})

defineExpose({ focusTitleInput })
</script>

<template>
  <header class="topbar-root absolute top-4 left-4 right-4 z-200 pointer-events-none">
    <div class="topbar-container nc-between">
      <!-- Left: Back + Title + Breadcrumbs + Save -->
      <div class="flex items-center gap-4">
        <NuxtLink
          to="/dashboard"
          class="topbar-icon-btn"
          :aria-label="$t('canvas.topbar.back')"
        >
          <span class="i-lucide-arrow-left text-lg" />
        </NuxtLink>

        <div class="topbar-divider" />

        <Transition name="nc-crossfade" mode="out-in" @after-enter="isEditingTitle && focusTitleInput()">
          <input
            v-if="isEditingTitle"
            key="edit"
            ref="titleInputRef"
            :value="editedTitle"
            class="topbar-title-edit"
            @keydown.enter.prevent="emit('save-title')"
            @keydown.escape="emit('cancel-edit')"
            @blur="emit('save-title')"
            @input="emit('title-input', ($event.target as HTMLInputElement).value)"
          >
          <button
            v-else
            key="display"
            class="topbar-title-btn"
            @click="emit('start-editing')"
          >
            {{ mapStore.title }}
          </button>
        </Transition>

        <!-- Breadcrumb trail -->
        <div v-if="namedBreadcrumbs.length > 1" class="topbar-breadcrumbs">
          <button
            v-for="(crumb, i) in namedBreadcrumbs"
            :key="crumb.timestamp"
            class="topbar-crumb"
            :class="{ 'topbar-crumb-current': i === namedBreadcrumbs.length - 1 }"
            :title="$t('canvas.topbar.breadcrumb_navigate', { label: crumb.label })"
            :aria-current="i === namedBreadcrumbs.length - 1 ? 'page' : undefined"
            @click="emit('navigate-breadcrumb', crumb)"
          >
            {{ crumb.label }}
          </button>
        </div>

        <!-- Inline save status -->
        <span class="topbar-save-status">
          <template v-if="autoSave.isSaving.value">
            <span class="i-lucide-loader-2 animate-spin text-nc-ink-soft" />
          </template>
          <template v-else-if="!mapStore.isDirty">
            <span class="topbar-saved-dot" />
            <span>{{ relativeSaveTime || $t('canvas.topbar.save_status.saved') }}</span>
          </template>
          <template v-else>
            <span class="topbar-unsaved-dot" />
            <span class="text-nc-ink-soft">{{ $t('canvas.topbar.save_status.unsaved') }}</span>
          </template>
        </span>

        <SyncSyncStatusIndicator class="mobile-hide" />
      </div>

      <!-- Right: AI Status + AI Expand + Theme Toggle + Overflow Menu -->
      <div class="flex items-center gap-3">
        <CanvasAIStatusIndicator class="mobile-hide" />

        <button
          class="nc-ai-btn mobile-hide"
          :disabled="isAILoading"
          :title="hasSelection ? '' : $t('canvas.ai.expand_whole_map')"
          @click="emit('smart-expand')"
        >
          <span class="i-nc-ai-mark" :class="isAILoading ? 'opacity-60' : ''" />
          {{ $t('canvas.topbar.ai_expand') }}
        </button>

        <!-- View toggle: Canvas / Graph / Editor -->
        <div class="topbar-view-tabs mobile-hide">
          <button
            :class="['topbar-view-tab', { active: viewMode === 'canvas' }]"
            :title="$t('canvas.topbar.canvas_view')"
            @click="emit('set-view', 'canvas')"
          >
            <span class="i-lucide-layout-dashboard" />
            <span class="topbar-view-label">{{ $t('canvas.topbar.canvas_label') }}</span>
          </button>
          <button
            :class="['topbar-view-tab', { active: viewMode === 'graph' }]"
            :title="$t('canvas.topbar.graph_view')"
            @click="emit('set-view', 'graph')"
          >
            <span class="i-lucide-git-fork" />
            <span class="topbar-view-label">{{ $t('canvas.topbar.graph_label') }}</span>
          </button>
          <button
            :class="['topbar-view-tab', { active: viewMode === 'editor' }]"
            :title="$t('canvas.topbar.editor_view')"
            @click="emit('set-view', 'editor')"
          >
            <span class="i-lucide-file-text" />
            <span class="topbar-view-label">{{ $t('canvas.topbar.editor_label') }}</span>
          </button>
        </div>

        <CanvasThemeToggle class="mobile-hide" />

        <CanvasOverflowMenu
          :can-undo="mapStore.canUndo()"
          :can-redo="mapStore.canRedo()"
          :is-dirty="mapStore.isDirty"
          @undo="emit('undo')"
          @redo="emit('redo')"
          @save="emit('save')"
          @share="emit('share')"
          @version-history="emit('version-history')"
          @comments="emit('comments')"
          @export-png="emit('export-png')"
          @export-pdf="emit('export-pdf')"
          @export-json="emit('export-json')"
          @export-markdown="emit('export-markdown')"
          @help="emit('open-shortcuts')"
          @settings="emit('settings')"
        />
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar-root {
  transition: right 220ms var(--nc-ease);
}

.topbar-container {
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  padding: 10px 16px;
  pointer-events: auto;
}

.topbar-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-ink-soft);
  cursor: pointer;
  transition:
    color var(--nc-duration-fast) var(--nc-ease),
    background-color var(--nc-duration-fast) var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .topbar-icon-btn:hover {
    color: var(--nc-ink);
    background: var(--nc-surface-3);
  }
}

.topbar-icon-btn:active {
  transform: scale(0.97);
}

.topbar-title-edit {
  width: 160px;
  max-width: 200px;
  background: var(--nc-chip-bg);
  color: var(--nc-ink);
  font-family: var(--nc-font-body);
  font-weight: 500;
  font-size: calc(14px * var(--nc-text-scale, 1));
  padding: 4px 8px;
  border-radius: 0.4rem;
  border: 1px solid var(--nc-accent);
  outline: none;
  caret-color: var(--nc-accent);
}

.topbar-title-btn {
  color: var(--nc-ink);
  font-family: var(--nc-font-body);
  font-weight: 600;
  font-size: calc(14px * var(--nc-text-scale, 1));
  letter-spacing: -0.01em;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
  text-align: left;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .topbar-title-btn:hover {
    color: var(--nc-accent);
  }
}

.topbar-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topbar-crumb {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--nc-ink-soft);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  border-radius: 0.4rem;
  padding: 2px 8px;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              background var(--nc-duration-fast) var(--nc-ease);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (hover: hover) and (pointer: fine) {
  .topbar-crumb:hover {
    color: var(--nc-accent);
    border-color: rgba(var(--nc-accent-rgb), 0.3);
    background: rgba(var(--nc-accent-rgb), 0.06);
  }
}

.topbar-crumb-current {
  color: var(--nc-ink-soft);
  border-color: var(--nc-border);
}

.topbar-save-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted);
}

.topbar-saved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-accent);
}

/* Unsaved = live marker → coral (REDESIGN.md §1 accent discipline) */
.topbar-unsaved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-coral);
}

.topbar-divider {
  width: 1px;
  height: 20px;
  background: var(--nc-border);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  /* Mobile top bar: simplified — back + title/save left, actions right */
  header {
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
  }

  .topbar-container {
    border-radius: 0;
    padding: 48px 16px 10px;
    background: var(--nc-surface);
  }

  .topbar-title-btn {
    font-size: calc(16px * var(--nc-text-scale, 1));
    font-weight: 600;
  }

  .topbar-title-edit {
    font-size: calc(16px * var(--nc-text-scale, 1));
    width: 140px;
  }

  /* Save status: simplify to just text */
  .topbar-save-status {
    font-size: calc(12px * var(--nc-text-scale, 1));
  }

  /* Hide non-essential elements on mobile */
  .topbar-breadcrumbs,
  .mobile-hide {
    display: none !important;
  }

  .topbar-divider {
    height: 24px;
  }
}

/* View tabs (Canvas / Graph / Editor) — flat chip strip, theme-aware tokens */
.topbar-view-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
}

.topbar-view-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  /* Interactive rest ≥ the 0.62 tier (WCAG 1.4.11 — AER-76 icon visibility) */
  color: var(--nc-ink-soft);
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    padding 220ms var(--nc-ease),
    gap 220ms var(--nc-ease),
    transform 160ms var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .topbar-view-tab:hover {
    color: var(--nc-ink);
    background: var(--nc-surface-3);
  }
}

/* Active view = accent text + filled marker (never color alone) */
.topbar-view-tab.active {
  background: rgba(var(--nc-accent-rgb), 0.08);
  border-color: rgba(var(--nc-accent-rgb), 0.25);
  color: var(--nc-accent-text);
}

.topbar-view-tab:active {
  transform: scale(0.97);
}

.topbar-view-label {
  line-height: 1;
  display: inline-block;
  overflow: hidden;
  max-width: 80px;
  opacity: 1;
  transform: translateX(0);
  transition:
    max-width 220ms var(--nc-ease),
    opacity 160ms var(--nc-ease),
    transform 220ms var(--nc-ease);
  will-change: max-width, opacity, transform;
}

@media (prefers-reduced-motion: reduce) {
  .topbar-view-tab,
  .topbar-view-label {
    transition: none;
  }
}
</style>
