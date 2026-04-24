<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

interface ShortcutItem {
  description: string
  keys: string[]
}

interface ShortcutGroup {
  label: string
  items: ShortcutItem[]
}

const SHORTCUT_GROUPS = computed<ShortcutGroup[]>(() => [
  {
    label: t('canvas.shortcuts.navigation'),
    items: [
      { description: t('canvas.shortcuts.pan_canvas'), keys: ['Space', '+ Drag'] },
      { description: t('canvas.shortcuts.zoom_in'), keys: ['⌘', '+'] },
      { description: t('canvas.shortcuts.zoom_out'), keys: ['⌘', '−'] },
      { description: t('canvas.shortcuts.fit_to_screen'), keys: ['F'] },
      { description: t('canvas.shortcuts.arrow_pan'), keys: ['←', '→', '↑', '↓'] },
      { description: t('canvas.shortcuts.reset_zoom'), keys: ['1'] },
    ]
  },
  {
    label: t('canvas.shortcuts.tools'),
    items: [
      { description: t('canvas.shortcuts.select_tool_desc'), keys: ['V'] },
      { description: t('canvas.shortcuts.pan_tool_desc'), keys: ['H'] },
      { description: t('canvas.shortcuts.add_node_desc'), keys: ['N'] },
      { description: t('canvas.shortcuts.connect_desc'), keys: ['C'] },
      { description: t('canvas.shortcuts.templates_desc'), keys: ['T'] },
    ]
  },
  {
    label: t('canvas.shortcuts.editing'),
    items: [
      { description: t('canvas.shortcuts.delete'), keys: ['⌫'] },
      { description: t('canvas.shortcuts.edit_node'), keys: ['Double-click'] },
      { description: t('canvas.shortcuts.duplicate'), keys: ['⌘', 'D'] },
      { description: t('canvas.shortcuts.select_all'), keys: ['⌘', 'A'] },
      { description: t('canvas.overflow_menu.undo'), keys: ['⌘', 'Z'] },
      { description: t('canvas.overflow_menu.redo'), keys: ['⌘', '⇧', 'Z'] },
    ]
  },
  {
    label: t('canvas.shortcuts.graph_links'),
    items: [
      { description: t('canvas.shortcuts.open_graph'), keys: ['⌘', 'G'] },
      { description: t('canvas.shortcuts.toggle_backlinks'), keys: ['⌘', 'B'] },
      { description: t('canvas.shortcuts.toggle_semantic'), keys: ['S'] },
    ]
  },
  {
    label: t('canvas.shortcuts.ai_features'),
    items: [
      { description: t('canvas.shortcuts.ai_expand_desc'), keys: ['⌘', 'E'] },
      { description: t('canvas.shortcuts.accept_suggestion'), keys: ['⌘', '↵'] },
    ]
  }
])
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-modal bg-nc-bg/90 backdrop-blur-xl nc-center"
        @click="emit('close')"
      >
        <div
          class="nc-glass-elevated rounded-nc-2xl w-[560px] max-h-[80vh] overflow-hidden"
          @click.stop
        >
          <div class="px-6 py-5 border-b border-nc-border nc-between">
            <h2 class="font-display font-bold text-lg text-nc-ink">{{ $t('canvas.shortcuts.title') }}</h2>
            <button
              class="w-8 h-8 rounded-nc-md nc-center text-nc-ink-muted hover:text-nc-ink hover:bg-nc-surface-2 transition-colors"
              @click="emit('close')"
            >
              <span class="i-lucide-x text-lg" />
            </button>
          </div>
          <div class="p-6 max-h-[60vh] overflow-y-auto">
            <div
              v-for="(group, groupIndex) in SHORTCUT_GROUPS"
              :key="group.label"
              :class="groupIndex < SHORTCUT_GROUPS.length - 1 ? 'mb-6' : ''"
            >
              <div class="text-xs font-semibold uppercase tracking-wide text-nc-accent mb-3">
                {{ group.label }}
              </div>
              <div class="flex flex-col gap-2">
                <div
                  v-for="item in group.items"
                  :key="item.description"
                  class="nc-between py-1"
                >
                  <span class="text-sm text-nc-ink-soft">{{ item.description }}</span>
                  <div class="nc-row gap-1">
                    <span
                      v-for="(key, keyIndex) in item.keys"
                      :key="keyIndex"
                      class="nc-shortcut-key"
                    >{{ key }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
