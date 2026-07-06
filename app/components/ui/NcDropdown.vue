<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from 'radix-vue'

export interface DropdownItem {
  label: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  action?: () => void
}

export interface DropdownGroup {
  label?: string
  items: DropdownItem[]
}

export interface NcDropdownProps {
  items?: DropdownItem[]
  groups?: DropdownGroup[]
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

const props = withDefaults(defineProps<NcDropdownProps>(), {
  items: () => [],
  groups: () => [],
  side: 'bottom',
  align: 'start',
  sideOffset: 8
})

const emit = defineEmits<{
  select: [item: DropdownItem]
}>()

function handleSelect(item: DropdownItem) {
  if (item.disabled) return
  emit('select', item)
  item.action?.()
}

const hasItems = computed(() => props.items.length > 0 || props.groups.length > 0)

// Items: hover = surface-3 bg + text brighten; danger = coral (REDESIGN.md §5)
function itemClass(item: DropdownItem) {
  return [
    'relative flex items-center gap-2 px-2.5 py-2 rounded-[0.4rem] cursor-pointer select-none outline-none nc-anim active:scale-98',
    item.disabled
      ? 'opacity-45 cursor-not-allowed'
      : item.danger
        ? 'text-nc-coral focus:bg-nc-coral/10 data-[highlighted]:bg-nc-coral/10'
        : 'text-nc-text-secondary focus:bg-nc-surface-3 focus:text-nc-text data-[highlighted]:bg-nc-surface-3 data-[highlighted]:text-nc-text'
  ]
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <!-- Flat surface-2 + hairline; origin at trigger, enter 150ms / exit 100ms -->
      <DropdownMenuContent
        v-if="hasItems"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        class="nc-menu-pop z-dropdown min-w-[180px] nc-glass-elevated rounded-nc-md p-1.5"
      >
        <!-- Simple items list -->
        <template v-if="items.length > 0">
          <DropdownMenuItem
            v-for="(item, index) in items"
            :key="index"
            :disabled="item.disabled"
            :class="itemClass(item)"
            @select="handleSelect(item)"
          >
            <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
            <span class="flex-1">{{ item.label }}</span>
            <span v-if="item.shortcut" class="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-nc-text-muted">
              {{ item.shortcut }}
            </span>
          </DropdownMenuItem>
        </template>

        <!-- Grouped items -->
        <template v-if="groups.length > 0">
          <template v-for="(group, groupIndex) in groups" :key="groupIndex">
            <DropdownMenuSeparator
              v-if="groupIndex > 0"
              class="h-px my-1.5 bg-nc-border"
            />

            <DropdownMenuGroup>
              <DropdownMenuLabel
                v-if="group.label"
                class="px-2.5 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-nc-text-muted"
              >
                {{ group.label }}
              </DropdownMenuLabel>

              <DropdownMenuItem
                v-for="(item, itemIndex) in group.items"
                :key="itemIndex"
                :disabled="item.disabled"
                :class="itemClass(item)"
                @select="handleSelect(item)"
              >
                <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
                <span class="flex-1">{{ item.label }}</span>
                <span v-if="item.shortcut" class="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-nc-text-muted">
                  {{ item.shortcut }}
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </template>
        </template>

        <!-- Custom content slot -->
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
/* Popover motion (REDESIGN.md §5/§6): transform-origin at the trigger,
   scale(0.97)+opacity, enter 150ms / exit 100ms, single ease. */
.nc-menu-pop {
  transform-origin: var(--radix-dropdown-menu-content-transform-origin);
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
