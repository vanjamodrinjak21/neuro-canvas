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
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <ContextMenuContent
        class="z-dropdown min-w-[180px] nc-glass-elevated rounded-nc-lg p-1.5 shadow-nc-xl
               animate-in fade-in-0 zoom-in-95"
      >
        <template v-for="(item, index) in items" :key="index">
          <!-- Separator -->
          <ContextMenuSeparator
            v-if="item.type === 'separator'"
            class="h-px my-1.5 bg-nc-border"
          />

          <!-- Label -->
          <ContextMenuLabel
            v-else-if="item.type === 'label'"
            class="px-2.5 py-1.5 text-xs font-medium text-nc-text-muted"
          >
            {{ item.label }}
          </ContextMenuLabel>

          <!-- Submenu -->
          <ContextMenuSub v-else-if="item.children && item.children.length > 0">
            <ContextMenuSubTrigger
              :disabled="item.disabled"
              :class="[
                'relative flex items-center gap-2 px-2.5 py-2 rounded-nc-md cursor-pointer select-none outline-none transition-colors',
                item.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'text-nc-text focus:bg-nc-surface-hover data-[highlighted]:bg-nc-surface-hover'
              ]"
            >
              <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
              <span class="flex-1">{{ item.label }}</span>
              <span class="i-lucide-chevron-right text-lg text-nc-text-muted" />
            </ContextMenuSubTrigger>

            <ContextMenuPortal>
              <ContextMenuSubContent
                :side-offset="2"
                :align-offset="-5"
                class="z-dropdown min-w-[180px] nc-glass-elevated rounded-nc-lg p-1.5 shadow-nc-xl
                       animate-in fade-in-0 zoom-in-95"
              >
                <template v-for="(child, childIndex) in item.children" :key="childIndex">
                  <ContextMenuSeparator
                    v-if="child.type === 'separator'"
                    class="h-px my-1.5 bg-nc-border"
                  />

                  <ContextMenuItem
                    v-else
                    :disabled="child.disabled"
                    :class="[
                      'relative flex items-center gap-2 px-2.5 py-2 rounded-nc-md cursor-pointer select-none outline-none transition-colors',
                      child.disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : child.danger
                          ? 'text-nc-error focus:bg-nc-error/20 data-[highlighted]:bg-nc-error/20'
                          : 'text-nc-text focus:bg-nc-surface-hover data-[highlighted]:bg-nc-surface-hover'
                    ]"
                    @select="handleSelect(child)"
                  >
                    <span v-if="child.icon" :class="[child.icon, 'text-lg']" />
                    <span class="flex-1">{{ child.label }}</span>
                    <span v-if="child.shortcut" class="text-xs text-nc-text-muted">
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
            :class="[
              'relative flex items-center gap-2 px-2.5 py-2 rounded-nc-md cursor-pointer select-none outline-none transition-colors',
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
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
