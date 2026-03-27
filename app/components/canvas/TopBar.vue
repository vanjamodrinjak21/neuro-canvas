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
  'export-png': []
  'export-json': []
  'export-markdown': []
  'settings': []
  'navigate-breadcrumb': [crumb: NavigationBreadcrumb]
}>()

const mapStore = useMapStore()
const autoSave = useAutoSave()

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
  if (diff < 5) return 'Just saved'
  if (diff < 60) return `Saved ${diff}s ago`
  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return `Saved ${minutes}m ago`
  return `Saved ${Math.floor(minutes / 60)}h ago`
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
          aria-label="Back to dashboard"
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
          />
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
            :title="`Navigate to ${crumb.label}`"
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
            <span>{{ relativeSaveTime || 'Saved' }}</span>
          </template>
          <template v-else>
            <span class="text-nc-ink-soft">Unsaved</span>
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
          AI Expand
        </button>

        <CanvasThemeToggle class="mobile-hide" />

        <CanvasOverflowMenu
          :can-undo="mapStore.canUndo()"
          :can-redo="mapStore.canRedo()"
          :is-dirty="mapStore.isDirty"
          @undo="emit('undo')"
          @redo="emit('redo')"
          @save="emit('save')"
          @share="emit('share')"
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
  transition: color 0.15s ease;
}

.topbar-icon-btn:hover {
  color: var(--nc-ink);
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
  transition: color 0.15s ease;
}

.topbar-title-btn:hover {
  color: var(--nc-accent);
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
  transition: all 0.15s ease;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-crumb:hover {
  color: var(--nc-accent, #00D2BE);
  border-color: rgba(0, 210, 190, 0.3);
  background: rgba(0, 210, 190, 0.06);
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
</style>
