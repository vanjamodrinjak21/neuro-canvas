<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

interface ShortcutItem {
  description: string
  keys: string[]
}

interface ShortcutGroup {
  label: string
  items: ShortcutItem[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Navigation',
    items: [
      { description: 'Pan canvas', keys: ['Space', '+ Drag'] },
      { description: 'Zoom in', keys: ['⌘', '+'] },
      { description: 'Zoom out', keys: ['⌘', '−'] },
      { description: 'Fit to screen', keys: ['F'] },
      { description: 'Arrow keys to pan', keys: ['←', '→', '↑', '↓'] },
      { description: 'Reset zoom', keys: ['1'] },
    ]
  },
  {
    label: 'Tools',
    items: [
      { description: 'Select tool', keys: ['V'] },
      { description: 'Pan tool', keys: ['H'] },
      { description: 'Add node tool', keys: ['N'] },
      { description: 'Connect tool', keys: ['C'] },
      { description: 'Templates', keys: ['T'] },
    ]
  },
  {
    label: 'Editing',
    items: [
      { description: 'Delete selected', keys: ['⌫'] },
      { description: 'Edit node text', keys: ['Double-click'] },
      { description: 'Duplicate', keys: ['⌘', 'D'] },
      { description: 'Select all', keys: ['⌘', 'A'] },
      { description: 'Undo', keys: ['⌘', 'Z'] },
      { description: 'Redo', keys: ['⌘', '⇧', 'Z'] },
    ]
  },
  {
    label: 'Graph & Links',
    items: [
      { description: 'Open Graph View', keys: ['⌘', 'G'] },
      { description: 'Toggle Backlinks Panel', keys: ['⌘', 'B'] },
      { description: 'Toggle Semantic Field', keys: ['S'] },
    ]
  },
  {
    label: 'AI Features',
    items: [
      { description: 'AI Expand', keys: ['⌘', 'E'] },
      { description: 'Accept suggestion', keys: ['⌘', '↵'] },
    ]
  }
]
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
            <h2 class="font-display font-bold text-lg text-nc-ink">Keyboard Shortcuts</h2>
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
