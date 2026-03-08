<script setup lang="ts">
import type { ContextMenuItem } from '~/components/ui/NcContextMenu.vue'

defineProps<{
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  close: []
  select: [item: ContextMenuItem]
}>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-100"
      leave-active-class="transition-opacity duration-75"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-dropdown"
        @click="emit('close')"
        @contextmenu.prevent="emit('close')"
      >
        <div
          class="nc-context-menu"
          :style="{ left: `${position.x}px`, top: `${position.y}px` }"
          @click.stop
        >
          <template v-for="(item, index) in items" :key="index">
            <div v-if="item.type === 'separator'" class="nc-context-divider" />
            <div v-else-if="item.children" class="relative group">
              <button class="nc-context-item">
                <span v-if="item.icon" :class="[item.icon, 'text-base']" />
                <span class="flex-1 text-left">{{ item.label }}</span>
                <span class="i-lucide-chevron-right text-base opacity-50" />
              </button>
              <div class="nc-context-submenu">
                <button
                  v-for="(child, childIndex) in item.children"
                  :key="childIndex"
                  class="nc-context-item"
                  @click="child.action?.(); emit('close')"
                >
                  <span
                    v-if="child.icon"
                    :class="[child.icon, 'text-base']"
                    :style="{
                      color: child.label === 'Teal' ? '#00D2BE' :
                             child.label === 'Purple' ? '#A78BFA' :
                             child.label === 'Pink' ? '#F472B6' :
                             child.label === 'Blue' ? '#60A5FA' :
                             child.label === 'Green' ? '#4ADE80' : undefined
                    }"
                  />
                  <span>{{ child.label }}</span>
                </button>
              </div>
            </div>
            <button
              v-else
              :disabled="item.disabled"
              :class="[
                'nc-context-item',
                item.disabled && 'nc-context-item-disabled',
                item.danger && 'nc-context-item-danger'
              ]"
              @click="item.action?.(); emit('close')"
            >
              <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
              <span class="flex-1 text-left">{{ item.label }}</span>
              <span v-if="item.shortcut" class="text-xs text-nc-ink-muted">{{ item.shortcut }}</span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
