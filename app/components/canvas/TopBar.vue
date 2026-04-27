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
  <header class="absolute top-4 left-4 right-4 z-200 pointer-events-none">
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
          :disabled="!hasSelection || isAILoading"
          @click="emit('smart-expand')"
        >
          <span class="i-lucide-sparkles" :class="isAILoading ? 'animate-spin' : ''" />
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
.topbar-container {
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--nc-border, #1A1A1E);
  border-radius: 8px;
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
  transition: color var(--nc-duration-fast) var(--nc-ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .topbar-icon-btn:hover {
    color: var(--nc-ink);
  }
}

.topbar-logo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  opacity: 0.85;
  transition: opacity var(--nc-duration-fast) var(--nc-ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .topbar-logo-btn:hover {
    opacity: 1;
  }
}

.topbar-title-edit {
  width: 160px;
  max-width: 200px;
  background: var(--nc-surface-3);
  color: var(--nc-ink);
  font-family: var(--nc-font-body);
  font-weight: 500;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--nc-accent);
  outline: none;
  caret-color: var(--nc-accent);
}

.topbar-title-btn {
  color: var(--nc-ink);
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.01em;
  background: none;
  border: none;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease-out);
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
  font-size: 10px;
  font-weight: 500;
  color: var(--nc-ink-soft);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 2px 8px;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease-out),
              border-color var(--nc-duration-fast) var(--nc-ease-out),
              background var(--nc-duration-fast) var(--nc-ease-out);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (hover: hover) and (pointer: fine) {
  .topbar-crumb:hover {
    color: var(--nc-accent, #00D2BE);
    border-color: rgba(0, 210, 190, 0.3);
    background: rgba(0, 210, 190, 0.06);
  }
}

.topbar-crumb-current {
  color: var(--nc-ink-soft);
  border-color: rgba(255, 255, 255, 0.1);
}

.topbar-save-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--nc-ink-muted);
}

.topbar-saved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-accent);
}

.topbar-divider {
  width: 1px;
  height: 20px;
  background: var(--nc-border, #1A1A1E);
  flex-shrink: 0;
}

/* Light theme */
:root.light .topbar-container {
  background: rgba(250, 250, 249, 0.85);
  border-color: #E8E8E6;
}

:root.light .topbar-crumb {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.06);
}

:root.light .topbar-crumb-current {
  border-color: rgba(0, 0, 0, 0.1);
}

:root.light .topbar-divider {
  background: #E8E8E6;
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
    background: rgba(10, 10, 12, 0.9);
  }

  :root.light .topbar-container {
    background: rgba(250, 250, 249, 0.92);
  }

  .topbar-title-btn {
    font-size: 16px;
    font-weight: 600;
  }

  .topbar-title-edit {
    font-size: 16px;
    width: 140px;
  }

  /* Save status: simplify to just text */
  .topbar-save-status {
    font-size: 12px;
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

/* View tabs (Canvas / Graph / Editor) */
.topbar-view-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 8px;
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
  color: var(--nc-ink-faint, #52525B);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: color 150ms var(--nc-ease-out, ease), background 150ms var(--nc-ease-out, ease);
}

.topbar-view-tab:hover {
  color: var(--nc-ink-muted, #A1A1AA);
}

.topbar-view-tab.active {
  background: rgba(0, 210, 190, 0.08);
  border-color: rgba(0, 210, 190, 0.2);
  color: var(--nc-accent, #00D2BE);
}

.topbar-view-tab:active {
  transform: scale(0.97);
}

.topbar-view-label {
  line-height: 1;
}
</style>
