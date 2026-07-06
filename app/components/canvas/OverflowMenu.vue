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
  'export-pdf': []
  'export-json': []
  'export-markdown': []
  help: []
  settings: []
}>()

const { t } = useI18n()

const exportFormats = computed(() => [
  { key: 'png' as const, icon: 'i-lucide-image', label: t('canvas.overflow_menu.export_png'), hint: t('canvas.overflow_menu.export_png_hint') },
  { key: 'pdf' as const, icon: 'i-lucide-printer', label: t('canvas.overflow_menu.export_pdf'), hint: t('canvas.overflow_menu.export_pdf_hint') },
  { key: 'json' as const, icon: 'i-lucide-braces', label: t('canvas.overflow_menu.export_json'), hint: t('canvas.overflow_menu.export_json_hint') },
  { key: 'markdown' as const, icon: 'i-lucide-file-text', label: t('canvas.overflow_menu.export_markdown'), hint: t('canvas.overflow_menu.export_markdown_hint') }
])

function handleExport(format: 'png' | 'pdf' | 'json' | 'markdown') {
  if (format === 'png') emit('export-png')
  else if (format === 'pdf') emit('export-pdf')
  else if (format === 'json') emit('export-json')
  else emit('export-markdown')
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
  color: var(--nc-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              background var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}
@media (hover: hover) and (pointer: fine) {
  .overflow-trigger:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}
.overflow-trigger:active {
  transform: scale(0.97);
}

/* NOTE: .overflow-panel and .export-panel chrome (background, border,
   shadow, sizing, z-index) live in app/assets/css/components.css as
   GLOBAL rules. They cannot be scoped because radix-vue's
   <DropdownMenuPortal> teleports the panels through multiple component
   wrappers, and the scoped data-v-* attribute does not survive that
   chain (canvas content was bleeding through — see AER-7). Their
   open/close motion lives in the unscoped style block below for the
   same reason. */

/* ── Shared item style ───────────────────── */
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  min-height: 36px;
  border-radius: var(--nc-radius-md);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 450;
  color: var(--nc-text);
  cursor: pointer;
  outline: none;
  user-select: none;
  transition: background var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease);
}
.menu-item[data-disabled] {
  opacity: 0.35;
  cursor: not-allowed;
}
.menu-item[data-highlighted] {
  background: var(--nc-surface-3);
  color: var(--nc-text);
}
.menu-item:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: -2px;
}
.menu-icon {
  font-size: calc(16px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  flex-shrink: 0;
}
.menu-item[data-highlighted] .menu-icon {
  color: var(--nc-text);
}
/* kbd hint — mono micro-label grammar (REDESIGN.md §4) */
.menu-shortcut {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  font-family: var(--nc-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
/* Group titles — mono uppercase micro-label (REDESIGN.md §4) */
.menu-label {
  padding: 8px 12px 4px;
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}
.menu-sep {
  height: 1px;
  margin: 4px 8px;
  background: var(--nc-border);
}

/* ── Sub-trigger chevron ─────────────────── */
.sub-trigger[data-state="open"] {
  background: var(--nc-surface-3);
}

/* ── Export fly-out panel ────────────────── */
/* (Panel chrome lives in app/assets/css/components.css — see AER-7 note above.) */
.export-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--nc-radius-md);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 450;
  color: var(--nc-text);
  cursor: pointer;
  outline: none;
  user-select: none;
  transition: background var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease);
}
.export-item[data-highlighted] {
  background: var(--nc-surface-3);
  color: var(--nc-text);
}
.export-item:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: -2px;
}
.export-item[data-highlighted] .export-icon {
  color: var(--nc-accent-text);
}
.export-icon {
  font-size: calc(16px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  flex-shrink: 0;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}
.export-hint {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}
</style>

<style>
/* Popover motion (REDESIGN.md §5/§6): transform-origin at the trigger,
   enter scale(0.97)+opacity 150ms, exit 100ms, single ease. Unscoped for
   the same portal reason as the panel chrome (AER-7 note above). */
.overflow-panel,
.export-panel {
  transform-origin: var(--radix-dropdown-menu-content-transform-origin);
}
.overflow-panel[data-state='open'],
.export-panel[data-state='open'] {
  animation: nc-overflow-menu-in 150ms var(--nc-ease);
}
.overflow-panel[data-state='closed'],
.export-panel[data-state='closed'] {
  animation: nc-overflow-menu-out 100ms var(--nc-ease) forwards;
}
@keyframes nc-overflow-menu-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
@keyframes nc-overflow-menu-out {
  to {
    opacity: 0;
    transform: scale(0.97);
  }
}
@media (prefers-reduced-motion: reduce) {
  .overflow-panel,
  .export-panel {
    animation-duration: 1ms !important;
  }
}
</style>
