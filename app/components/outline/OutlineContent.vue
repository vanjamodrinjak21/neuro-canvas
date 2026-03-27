<script setup lang="ts">
import type { OutlineItem } from '~/composables/useOutlineSync'

const props = defineProps<{
  items: OutlineItem[]
  focusedIndex: number
  ghostSuggestions: string[]
  ghostDepth: number
  aiEnabled: boolean
}>()

const emit = defineEmits<{
  'update:item': [index: number, content: string]
  'enter': [index: number]
  'delete': [index: number]
  'indent': [index: number]
  'outdent': [index: number]
  'focus': [index: number]
  'accept-ghost': []
}>()

const itemRefs = ref<Array<{ focusInput: () => void; el: HTMLDivElement | null }>>([])

function focusItem(index: number) {
  nextTick(() => {
    itemRefs.value[index]?.focusInput()
  })
}

defineExpose({ focusItem })
</script>

<template>
  <div class="nc-outline-content-list">
    <!-- Empty state -->
    <div v-if="items.length === 0" class="nc-outline-empty">
      <div class="nc-outline-empty-icon">
        <span class="i-lucide-list-tree" />
      </div>
      <p class="nc-outline-empty-title">Start your outline</p>
      <p class="nc-outline-empty-desc">
        Type your first idea to begin building your mind map
      </p>
    </div>

    <!-- Outline items -->
    <template v-for="(item, index) in items" :key="item.id">
      <OutlineItem
        :ref="(el: any) => { if (el) itemRefs[index] = el }"
        :item="item"
        :is-focused="focusedIndex === index"
        @update:content="(content) => $emit('update:item', index, content)"
        @enter="$emit('enter', index)"
        @delete="$emit('delete', index)"
        @indent="$emit('indent', index)"
        @outdent="$emit('outdent', index)"
        @focus="$emit('focus', index)"
        @focus-prev="focusedIndex > 0 && $emit('focus', index - 1)"
        @focus-next="index < items.length - 1 && $emit('focus', index + 1)"
      />

      <!-- Ghost suggestion after focused item -->
      <OutlineGhostSuggestion
        v-if="aiEnabled && focusedIndex === index && ghostSuggestions.length > 0"
        :suggestions="ghostSuggestions"
        :depth="item.depth"
        @accept="$emit('accept-ghost')"
      />
    </template>
  </div>
</template>

<style scoped>
.nc-outline-content-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 8px 0;
}

.nc-outline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
  text-align: center;
}

.nc-outline-empty-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--nc-radius-xl, 16px);
  background: var(--nc-surface-3, #18181B);
  border: 1px solid var(--nc-border, #1A1A1E);
  font-size: 24px;
  color: var(--nc-text-muted, #52525B);
  margin-bottom: 16px;
}

.nc-outline-empty-title {
  font-family: var(--nc-font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--nc-text, #FAFAFA);
  margin-bottom: 6px;
}

.nc-outline-empty-desc {
  font-size: 14px;
  color: var(--nc-text-muted, #52525B);
  max-width: 240px;
  line-height: 1.5;
}
</style>
