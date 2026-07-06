<script setup lang="ts">
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from 'radix-vue'

export interface ContextMenuItem {
  type?: 'item' | 'separator' | 'label'
  label?: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  action?: () => void
  children?: ContextMenuItem[]
}

export interface NcContextMenuProps {
  items: ContextMenuItem[]
}

defineProps<NcContextMenuProps>()

const emit = defineEmits<{
  select: [item: ContextMenuItem]
}>()

function handleSelect(item: ContextMenuItem) {
  if (item.disabled || item.type === 'separator' || item.type === 'label') return
  emit('select', item)
  item.action?.()
}

// Items: hover = surface-3 bg + text brighten; danger = coral (REDESIGN.md §5)
function itemClass(item: ContextMenuItem) {
  return [
    'relative flex items-center gap-2 px-2.5 py-2 rounded-[0.4rem] cursor-pointer select-none outline-none nc-anim',
    item.disabled
      ? 'opacity-45 cursor-not-allowed'
      : item.danger
        ? 'text-nc-coral focus:bg-nc-coral/10 data-[highlighted]:bg-nc-coral/10'
        : 'text-nc-text-secondary focus:bg-nc-surface-3 focus:text-nc-text data-[highlighted]:bg-nc-surface-3 data-[highlighted]:text-nc-text'
  ]
}
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <ContextMenuContent
        class="nc-menu-pop z-dropdown min-w-[180px] nc-glass-elevated rounded-nc-md p-1.5"
      >
        <template v-for="(item, index) in items" :key="index">
          <!-- Separator -->
          <ContextMenuSeparator
            v-if="item.type === 'separator'"
            class="h-px my-1.5 bg-nc-border"
          />

          <!-- Label — mono micro-label (REDESIGN.md §4) -->
          <ContextMenuLabel
            v-else-if="item.type === 'label'"
            class="px-2.5 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-nc-text-muted"
          >
            {{ item.label }}
          </ContextMenuLabel>

          <!-- Submenu -->
          <ContextMenuSub v-else-if="item.children && item.children.length > 0">
            <ContextMenuSubTrigger
              :disabled="item.disabled"
              :class="itemClass(item)"
            >
              <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
              <span class="flex-1">{{ item.label }}</span>
              <span class="i-lucide-chevron-right text-lg text-nc-text-muted" />
            </ContextMenuSubTrigger>

            <ContextMenuPortal>
              <ContextMenuSubContent
                :side-offset="2"
                :align-offset="-5"
                class="nc-menu-pop z-dropdown min-w-[180px] nc-glass-elevated rounded-nc-md p-1.5"
              >
                <template v-for="(child, childIndex) in item.children" :key="childIndex">
                  <ContextMenuSeparator
                    v-if="child.type === 'separator'"
                    class="h-px my-1.5 bg-nc-border"
                  />

                  <ContextMenuItem
                    v-else
                    :disabled="child.disabled"
                    :class="itemClass(child)"
                    @select="handleSelect(child)"
                  >
                    <span v-if="child.icon" :class="[child.icon, 'text-lg']" />
                    <span class="flex-1">{{ child.label }}</span>
                    <span v-if="child.shortcut" class="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-nc-text-muted">
                      {{ child.shortcut }}
                    </span>
                  </ContextMenuItem>
                </template>
              </ContextMenuSubContent>
            </ContextMenuPortal>
          </ContextMenuSub>

          <!-- Regular item -->
          <ContextMenuItem
            v-else
            :disabled="item.disabled"
            :class="itemClass(item)"
            @select="handleSelect(item)"
          >
            <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
            <span class="flex-1">{{ item.label }}</span>
            <span v-if="item.shortcut" class="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-nc-text-muted">
              {{ item.shortcut }}
            </span>
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<style scoped>
/* Popover motion (REDESIGN.md §5/§6): transform-origin at the pointer/trigger,
   scale(0.97)+opacity, enter 150ms / exit 100ms, single ease. */
.nc-menu-pop {
  transform-origin: var(--radix-context-menu-content-transform-origin);
}
.nc-menu-pop[data-state='open'] {
  animation: nc-menu-in 150ms var(--nc-ease);
}
.nc-menu-pop[data-state='closed'] {
  animation: nc-menu-out 100ms var(--nc-ease) forwards;
}

@keyframes nc-menu-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
@keyframes nc-menu-out {
  to {
    opacity: 0;
    transform: scale(0.97);
  }
}
</style>
