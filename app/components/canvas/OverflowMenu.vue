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
  'version-history': []
  'comments': []
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

          <DropdownMenuItem
            class="menu-item"
            @select="emit('version-history')"
          >
            <span class="i-lucide-history menu-icon" />
            <span class="flex-1">{{ $t('canvas.version_history.title') }}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            class="menu-item"
            @select="emit('comments')"
          >
            <span class="i-lucide-message-square menu-icon" />
            <span class="flex-1">{{ $t('canvas.comments.title') }}</span>
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

/* NOTE: .overflow-panel and .export-panel chrome (background, border,
   shadow, sizing, z-index) live in app/assets/css/components.css as
   GLOBAL rules. They cannot be scoped because radix-vue's
   <DropdownMenuPortal> teleports the panels through multiple component
   wrappers, and the scoped data-v-* attribute does not survive that
   chain (canvas content was bleeding through — see AER-7). */

/* ── Shared item style ───────────────────── */
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  min-height: 36px;
  border-radius: var(--nc-radius-md);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 450;
  color: #E4E4E7;
  cursor: pointer;
  outline: none;
  user-select: none;
  transition: background var(--nc-duration-fast) var(--nc-ease-smooth),
              color var(--nc-duration-fast) var(--nc-ease-smooth);
}
.menu-item[data-disabled] {
  opacity: 0.35;
  cursor: not-allowed;
}
.menu-item[data-highlighted] {
  background: rgba(255, 255, 255, 0.07);
  color: #FAFAFA;
}
.menu-item:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: -2px;
}
.menu-icon {
  font-size: calc(16px * var(--nc-text-scale, 1));
  color: #A1A1AA;
  flex-shrink: 0;
}
.menu-item[data-highlighted] .menu-icon {
  color: #D4D4D8;
}
.menu-shortcut {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: #52525B;
  font-family: var(--nc-font-mono);
  letter-spacing: 0.02em;
}
.menu-label {
  padding: 8px 12px 4px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-ink-soft);
}
.menu-sep {
  height: 1px;
  margin: 4px 8px;
  background: rgba(255, 255, 255, 0.06);
}

/* ── Sub-trigger chevron ─────────────────── */
.sub-trigger[data-state="open"] {
  background: rgba(255, 255, 255, 0.07);
}

/* ── Export fly-out panel ────────────────── */
/* (Panel chrome lives in app/assets/css/components.css — see AER-7 note above.) */
.export-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--nc-radius-md);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 450;
  color: #E4E4E7;
  cursor: pointer;
  outline: none;
  user-select: none;
  transition: background var(--nc-duration-fast) var(--nc-ease-smooth),
              color var(--nc-duration-fast) var(--nc-ease-smooth);
}
.export-item[data-highlighted] {
  background: rgba(255, 255, 255, 0.07);
  color: #FAFAFA;
}
.export-item:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: -2px;
}
.export-item[data-highlighted] .export-icon {
  color: var(--nc-accent);
}
.export-icon {
  font-size: calc(16px * var(--nc-text-scale, 1));
  color: #A1A1AA;
  flex-shrink: 0;
  transition: color var(--nc-duration-fast) var(--nc-ease-smooth);
}
.export-hint {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: #52525B;
}

/* ── Light theme ────────────────────────── */
/* (Panel chrome light-mode overrides live in components.css — see AER-7.) */
:root.light .menu-item {
  color: #3F3F46;
}
:root.light .menu-item[data-highlighted] {
  background: rgba(0, 0, 0, 0.04);
  color: #18181B;
}
:root.light .menu-icon {
  color: #71717A;
}
:root.light .menu-item[data-highlighted] .menu-icon {
  color: #3F3F46;
}
:root.light .menu-shortcut {
  color: #A1A1AA;
}
:root.light .menu-label {
  color: #A1A1AA;
}
:root.light .menu-sep {
  background: rgba(0, 0, 0, 0.06);
}
:root.light .sub-trigger[data-state="open"] {
  background: rgba(0, 0, 0, 0.04);
}
:root.light .export-item {
  color: #3F3F46;
}
:root.light .export-item[data-highlighted] {
  background: rgba(0, 0, 0, 0.04);
  color: #18181B;
}
:root.light .export-icon {
  color: #71717A;
}
:root.light .export-hint {
  color: #A1A1AA;
}

</style>
