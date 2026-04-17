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
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <!-- Enter 150ms ease-out, exit 100ms — asymmetric timing. Scale min 0.97. -->
      <DropdownMenuContent
        v-if="hasItems"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        class="z-dropdown min-w-[180px] nc-glass-elevated rounded-nc-lg p-1.5 shadow-nc-xl
               animate-in fade-in-0 zoom-in-97 duration-[150ms]
               data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-97 data-[state=closed]:duration-[100ms]
               data-[side=bottom]:slide-in-from-top-2
               data-[side=left]:slide-in-from-right-2
               data-[side=right]:slide-in-from-left-2
               data-[side=top]:slide-in-from-bottom-2"
      >
        <!-- Simple items list -->
        <template v-if="items.length > 0">
          <DropdownMenuItem
            v-for="(item, index) in items"
            :key="index"
            :disabled="item.disabled"
            :class="[
              'relative flex items-center gap-2 px-2.5 py-2 rounded-nc-md cursor-pointer select-none outline-none transition-[color,background-color] duration-100 active:scale-98',
              item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : item.danger
                  ? 'text-nc-error focus:bg-nc-error/20 data-[highlighted]:bg-nc-error/20'
                  : 'text-nc-text focus:bg-nc-surface-hover data-[highlighted]:bg-nc-surface-hover'
            ]"
            @select="handleSelect(item)"
          >
            <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
            <span class="flex-1">{{ item.label }}</span>
            <span v-if="item.shortcut" class="text-xs text-nc-text-muted">
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
                class="px-2.5 py-1.5 text-xs font-medium text-nc-text-muted"
              >
                {{ group.label }}
              </DropdownMenuLabel>

              <DropdownMenuItem
                v-for="(item, itemIndex) in group.items"
                :key="itemIndex"
                :disabled="item.disabled"
                :class="[
                  'relative flex items-center gap-2 px-2.5 py-2 rounded-nc-md cursor-pointer select-none outline-none transition-[color,background-color] duration-100 active:scale-98',
                  item.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : item.danger
                      ? 'text-nc-error focus:bg-nc-error/20 data-[highlighted]:bg-nc-error/20'
                      : 'text-nc-text focus:bg-nc-surface-hover data-[highlighted]:bg-nc-surface-hover'
                ]"
                @select="handleSelect(item)"
              >
                <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
                <span class="flex-1">{{ item.label }}</span>
                <span v-if="item.shortcut" class="text-xs text-nc-text-muted">
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
