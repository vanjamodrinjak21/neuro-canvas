<script setup lang="ts">
import type { OutlineItem } from '~/composables/useOutlineSync'

const props = defineProps<{
  item: OutlineItem
  isFocused: boolean
}>()

const emit = defineEmits<{
  'update:content': [content: string]
  'enter': []
  'delete': []
  'indent': []
  'outdent': []
  'focus': []
  'blur': []
  'focus-prev': []
  'focus-next': []
}>()

const itemRef = ref<HTMLDivElement | null>(null)
const isEditing = ref(false)

// Inline markdown rendering (Phase 4)
const renderedContent = computed(() => {
  if (isEditing.value) return props.item.content
  return renderInlineMarkdown(props.item.content)
})

function renderInlineMarkdown(text: string): string {
  if (!text) return ''
  return text
    // Code (must be first to avoid conflicts)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

function focusInput() {
  nextTick(() => {
    itemRef.value?.focus()
  })
}

function handleInput(e: Event) {
  const target = e.target as HTMLDivElement
  const text = target.textContent || ''
  emit('update:content', text)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('enter')
  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault()
    emit('indent')
  } else if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault()
    emit('outdent')
  } else if (e.key === 'Backspace') {
    const sel = window.getSelection()
    if (sel && sel.anchorOffset === 0 && sel.isCollapsed) {
      e.preventDefault()
      if (props.item.depth > 0) {
        emit('outdent')
      } else if (!props.item.content) {
        emit('delete')
      }
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    emit('focus-prev')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    emit('focus-next')
  }
}

function handleFocus() {
  isEditing.value = true
  emit('focus')
}

function handleBlur() {
  isEditing.value = false
  emit('blur')
}

watch(() => props.isFocused, (focused) => {
  if (focused) focusInput()
})

defineExpose({ focusInput, el: itemRef })
</script>

<template>
  <div
    class="nc-outline-item"
    :class="{ 'is-focused': isFocused }"
    :style="{ paddingLeft: `${item.depth * 24 + 12}px` }"
    :data-node-id="item.id"
  >
    <span class="nc-outline-bullet" />
    <div
      ref="itemRef"
      class="nc-outline-content"
      :contenteditable="true"
      spellcheck="false"
      @input="handleInput"
      @keydown="handleKeydown"
      @focus="handleFocus"
      @blur="handleBlur"
      v-html="renderedContent"
    />
  </div>
</template>

<style scoped>
.nc-outline-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-right: 16px;
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: 32px;
  transition: background-color var(--nc-duration-fast) var(--nc-ease);
}

.nc-outline-item.is-focused {
  background: var(--nc-accent-glow, rgba(0, 210, 190, 0.06));
}

.nc-outline-bullet {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-text-muted, #52525B);
  margin-top: 10px;
  transition: background-color var(--nc-duration-fast) var(--nc-ease);
}

.nc-outline-item.is-focused .nc-outline-bullet {
  background: var(--nc-accent, #00D2BE);
}

.nc-outline-content {
  flex: 1;
  font-family: var(--nc-font-body);
  font-size: 15px;
  font-weight: 400;
  line-height: 24px;
  color: var(--nc-text, #FAFAFA);
  outline: none;
  word-break: break-word;
  caret-color: var(--nc-accent, #00D2BE);
}

.nc-outline-content:empty::before {
  content: 'Type something...';
  color: var(--nc-text-dim, #3F3F46);
  pointer-events: none;
}

.nc-outline-content :deep(strong) {
  font-weight: 700;
  color: var(--nc-text, #FAFAFA);
}

.nc-outline-content :deep(em) {
  font-style: italic;
  color: var(--nc-text-soft, #A1A1AA);
}

.nc-outline-content :deep(code) {
  font-family: var(--nc-font-mono);
  font-size: 13px;
  background: var(--nc-surface-3, #18181B);
  padding: 1px 5px;
  border-radius: 4px;
  color: var(--nc-accent, #00D2BE);
}

.nc-outline-content :deep(a) {
  color: var(--nc-accent, #00D2BE);
  text-decoration: underline;
  text-decoration-color: rgba(0, 210, 190, 0.3);
  text-underline-offset: 2px;
}
</style>
