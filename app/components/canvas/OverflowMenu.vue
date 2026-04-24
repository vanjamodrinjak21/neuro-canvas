<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from 'radix-vue'

const props = defineProps<{
  canUndo: boolean
  canRedo: boolean
  isDirty: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
  save: []
  share: []
  'export-png': []
  'export-json': []
  'export-markdown': []
  help: []
  settings: []
}>()

const { t } = useI18n()

const exportFormats = computed(() => [
  { key: 'png' as const, icon: 'i-lucide-image', label: t('canvas.overflow_menu.export_png'), hint: t('canvas.overflow_menu.export_png_hint') },
  { key: 'json' as const, icon: 'i-lucide-braces', label: t('canvas.overflow_menu.export_json'), hint: t('canvas.overflow_menu.export_json_hint') },
  { key: 'markdown' as const, icon: 'i-lucide-file-text', label: t('canvas.overflow_menu.export_markdown'), hint: t('canvas.overflow_menu.export_markdown_hint') }
])

function handleExport(format: 'png' | 'json' | 'markdown') {
  emit(`export-${format}`)
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <button
        class="overflow-trigger"
        :aria-label="$t('canvas.overflow_menu.more_actions')"
      >
        <span class="i-lucide-more-horizontal text-lg" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        side="bottom"
        align="end"
        :side-offset="12"
        class="overflow-panel"
      >
        <!-- History -->
        <DropdownMenuLabel class="menu-label">{{ $t('canvas.overflow_menu.history') }}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem
            :disabled="!canUndo"
            class="menu-item"
            @select="emit('undo')"
          >
            <span class="i-lucide-undo-2 menu-icon" />
            <span class="flex-1">{{ $t('canvas.overflow_menu.undo') }}</span>
            <span class="menu-shortcut">{{ $t('canvas.overflow_menu.undo_shortcut') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            :disabled="!canRedo"
            class="menu-item"
            @select="emit('redo')"
          >
            <span class="i-lucide-redo-2 menu-icon" />
            <span class="flex-1">{{ $t('canvas.overflow_menu.redo') }}</span>
            <span class="menu-shortcut">{{ $t('canvas.overflow_menu.redo_shortcut') }}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator class="menu-sep" />

        <!-- File -->
        <DropdownMenuLabel class="menu-label">{{ $t('canvas.overflow_menu.file') }}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem
            :disabled="!isDirty"
            class="menu-item"
            @select="emit('save')"
          >
            <span class="i-lucide-save menu-icon" />
            <span class="flex-1">{{ $t('canvas.overflow_menu.save') }}</span>
            <span class="menu-shortcut">{{ $t('canvas.overflow_menu.save_shortcut') }}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            class="menu-item"
            @select="emit('share')"
          >
            <span class="i-lucide-share-2 menu-icon" />
            <span class="flex-1">{{ $t('canvas.overflow_menu.share') }}</span>
          </DropdownMenuItem>

          <!-- Export sub-menu -->
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class="menu-item sub-trigger">
              <span class="i-lucide-download menu-icon" />
              <span class="flex-1">{{ $t('canvas.overflow_menu.export') }}</span>
              <span class="i-lucide-chevron-right text-xs text-nc-ink-muted" />
            </DropdownMenuSubTrigger>

            <DropdownMenuPortal>
              <DropdownMenuSubContent
                :side-offset="8"
                class="export-panel"
              >
                <DropdownMenuItem
                  v-for="fmt in exportFormats"
                  :key="fmt.key"
                  class="export-item"
                  @select="handleExport(fmt.key)"
                >
                  <span :class="[fmt.icon, 'export-icon']" />
                  <span class="flex-1">{{ fmt.label }}</span>
                  <span class="export-hint">{{ fmt.hint }}</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator class="menu-sep" />

        <!-- Meta -->
        <DropdownMenuGroup>
          <DropdownMenuItem
            class="menu-item"
            @select="emit('help')"
          >
            <span class="i-lucide-keyboard menu-icon" />
            <span class="flex-1">{{ $t('canvas.overflow_menu.keyboard_shortcuts') }}</span>
            <span class="menu-shortcut">{{ $t('canvas.overflow_menu.keyboard_shortcuts_shortcut') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="menu-item"
            @select="emit('settings')"
          >
            <span class="i-lucide-settings menu-icon" />
            <span class="flex-1">{{ $t('canvas.overflow_menu.settings') }}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
/* ── Trigger ─────────────────────────────── */
.overflow-trigger {
  width: 32px;
  height: 32px;
  border-radius: var(--nc-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-ink-soft);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease-smooth),
              background var(--nc-duration-fast) var(--nc-ease-smooth);
}
.overflow-trigger:hover {
  color: var(--nc-ink);
  background: var(--nc-surface-3);
}

/* ── Main panel ──────────────────────────── */
.overflow-panel {
  z-index: 200;
  min-width: 210px;
  padding: 6px;
  border-radius: var(--nc-radius-lg);
  background: var(--nc-glass-bg-elevated);
  backdrop-filter: blur(var(--nc-glass-blur-heavy)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--nc-glass-blur-heavy)) saturate(140%);
  border: 1px solid var(--nc-border);
  box-shadow: var(--nc-shadow-xl);

  animation: menuIn 0.15s var(--nc-ease);
}

/* ── Shared item style ───────────────────── */
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  min-height: 36px;
  border-radius: var(--nc-radius-md);
  font-size: 13px;
  color: var(--nc-ink);
  cursor: pointer;
  outline: none;
  user-select: none;
  transition: background var(--nc-duration-fast) var(--nc-ease-smooth);
}
.menu-item[data-disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}
.menu-item[data-highlighted] {
  background: rgba(255, 255, 255, 0.08);
}
.menu-item:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: -2px;
}
.menu-icon {
  font-size: 15px;
  color: var(--nc-ink-soft);
}
.menu-shortcut {
  font-size: 11px;
  color: var(--nc-ink-muted);
  font-family: var(--nc-font-mono);
}
.menu-label {
  padding: 6px 10px 2px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--nc-ink-muted);
}
.menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--nc-border);
}

/* ── Sub-trigger chevron ─────────────────── */
.sub-trigger[data-state="open"] {
  background: var(--nc-surface-3);
}

/* ── Export fly-out panel ────────────────── */
.export-panel {
  z-index: 201;
  min-width: 190px;
  padding: 6px;
  border-radius: var(--nc-radius-lg);
  background: var(--nc-glass-bg-elevated);
  backdrop-filter: blur(var(--nc-glass-blur-heavy)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--nc-glass-blur-heavy)) saturate(140%);
  border: 1px solid var(--nc-border);
  box-shadow: var(--nc-shadow-xl);

  animation: subIn 0.12s var(--nc-ease);
}
.export-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--nc-radius-md);
  font-size: 13px;
  color: var(--nc-ink);
  cursor: pointer;
  outline: none;
  user-select: none;
  transition: background var(--nc-duration-fast) var(--nc-ease-smooth);
}
.export-item[data-highlighted] {
  background: rgba(255, 255, 255, 0.08);
}
.export-item:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: -2px;
}
.export-item[data-highlighted] .export-icon {
  color: var(--nc-accent);
}
.export-icon {
  font-size: 15px;
  color: var(--nc-ink-soft);
  transition: color var(--nc-duration-fast) var(--nc-ease-smooth);
}
.export-hint {
  font-size: 11px;
  color: var(--nc-ink-muted);
}

/* ── Entrance animations ─────────────────── */
@keyframes menuIn {
  from { opacity: 0; transform: scale(0.97) translateY(-4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes subIn {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
</style>
