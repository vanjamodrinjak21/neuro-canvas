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

// Position/size/typography derive from the camera transform and the node's
// user-chosen style (data). Consumed via v-bind() in the scoped style block —
// no inline :style (REDESIGN.md §9).
const screenLeft = computed(() => `${props.node.position.x * props.camera.zoom + props.camera.x}px`)
const screenTop = computed(() => `${props.node.position.y * props.camera.zoom + props.camera.y}px`)
const screenWidth = computed(() => `${props.node.size.width * props.camera.zoom}px`)
const screenHeight = computed(() => `${props.node.size.height * props.camera.zoom}px`)
const editorFontSize = computed(() => `${props.node.style.fontSize * props.camera.zoom}px`)
const editorPadding = computed(() => `${8 * props.camera.zoom}px`)
const editorFontWeight = computed(() => String(props.node.style.fontWeight))
const editorTextColor = computed(() => props.node.style.textColor)
const editorFillColor = computed(() => props.node.style.fillColor)
const editorBorderColor = computed(() => props.node.style.borderColor)
const editorBorderWidth = computed(() => `${props.node.style.borderWidth}px`)
const editorRadius = computed(() => (props.node.style.shape === 'circle' ? '50%' : '0.5rem'))

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
    class="node-editor font-sans pointer-events-auto"
    @keydown="handleKeydown"
    @blur="handleBlur"
  />
</template>

<style scoped>
.node-editor {
  position: absolute;
  left: v-bind(screenLeft);
  top: v-bind(screenTop);
  width: v-bind(screenWidth);
  height: v-bind(screenHeight);
  z-index: 1000;
  font-family: var(--nc-font-body);
  font-size: v-bind(editorFontSize);
  font-weight: v-bind(editorFontWeight);
  line-height: 1.4;
  text-align: center;
  color: v-bind(editorTextColor);
  background-color: v-bind(editorFillColor);
  border: v-bind(editorBorderWidth) solid v-bind(editorBorderColor);
  border-radius: v-bind(editorRadius);
  padding: v-bind(editorPadding);
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Edit-mode marker: accent outline (REDESIGN.md §1 focus rule) + flat
     shadow — no accent glow ring in chrome (§6). */
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
  box-shadow: var(--nc-shadow-md);
}

.node-editor::placeholder {
  color: currentColor;
  opacity: 0.5;
}
</style>
