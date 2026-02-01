<script setup lang="ts">
import type { Node, Camera } from '~/types'

export interface NodeEditorProps {
  node: Node
  camera: Camera
}

const props = defineProps<NodeEditorProps>()

const emit = defineEmits<{
  save: [content: string]
  cancel: []
}>()

// Local content state
const content = ref(props.node.content)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// Calculate position based on camera transform
const style = computed(() => {
  const { x, y } = props.node.position
  const { width, height } = props.node.size
  const { zoom } = props.camera

  // Apply camera transform to get screen position
  const screenX = x * zoom + props.camera.x
  const screenY = y * zoom + props.camera.y
  const screenWidth = width * zoom
  const screenHeight = height * zoom

  return {
    position: 'absolute' as const,
    left: `${screenX}px`,
    top: `${screenY}px`,
    width: `${screenWidth}px`,
    height: `${screenHeight}px`,
    fontSize: `${props.node.style.fontSize * zoom}px`,
    fontWeight: props.node.style.fontWeight,
    color: props.node.style.textColor,
    backgroundColor: props.node.style.fillColor,
    borderColor: props.node.style.borderColor,
    borderWidth: `${props.node.style.borderWidth}px`,
    borderStyle: 'solid' as const,
    borderRadius: props.node.style.shape === 'circle' ? '50%' : '12px',
    padding: `${8 * zoom}px`,
    boxSizing: 'border-box' as const,
    resize: 'none' as const,
    outline: 'none' as const,
    overflow: 'hidden' as const,
    textAlign: 'center' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 1000,
    boxShadow: '0 0 0 3px rgba(0, 210, 190, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4)'
  }
})

// Focus on mount
onMounted(() => {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      textareaRef.value.select()
    }
  })
})

// Update content when node changes
watch(() => props.node.content, (newContent) => {
  content.value = newContent
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('save', content.value)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  }
}

function handleBlur() {
  // Save on blur unless the content hasn't changed
  if (content.value !== props.node.content) {
    emit('save', content.value)
  } else {
    emit('cancel')
  }
}
</script>

<template>
  <textarea
    ref="textareaRef"
    v-model="content"
    :style="style"
    class="node-editor font-sans pointer-events-auto"
    @keydown="handleKeydown"
    @blur="handleBlur"
  />
</template>

<style scoped>
.node-editor {
  font-family: 'Inter', system-ui, sans-serif;
  line-height: 1.4;
}

.node-editor::placeholder {
  color: currentColor;
  opacity: 0.5;
}
</style>
