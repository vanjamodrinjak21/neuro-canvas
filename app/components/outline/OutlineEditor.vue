<script setup lang="ts">
import { nanoid } from 'nanoid'
import { useMapStore } from '~/stores/mapStore'
import { useOutlineSync, type OutlineItem } from '~/composables/useOutlineSync'
import { useOutlineGhost } from '~/composables/useOutlineGhost'
import { useMapRender } from '~/composables/useMapRender'

const mapStore = useMapStore()
const outlineSync = useOutlineSync()
const ghost = useOutlineGhost()
const mapRender = useMapRender()
const router = useRouter()

// State
const items = ref<OutlineItem[]>([])
const focusedIndex = ref(-1)
const aiEnabled = ref(false)
const showExport = ref(false)
const pngDataUrl = ref<string | null>(null)
const shareLink = ref<string | null>(null)
const isGeneratingPng = ref(false)

// Content ref for focusing
const contentRef = ref<{ focusItem: (index: number) => void } | null>(null)

// Initialize from store
onMounted(() => {
  syncFromStore()

  // If map is empty, create a root item
  if (items.value.length === 0) {
    const rootId = nanoid()
    items.value = [{ id: rootId, content: '', depth: 0 }]
    focusedIndex.value = 0
    nextTick(() => contentRef.value?.focusItem(0))
  }
})

// Sync from store when nodes change externally (e.g. undo/redo)
watch(() => mapStore.nodesVersion, () => {
  syncFromStore()
})

function syncFromStore() {
  const rendered = outlineSync.render()
  if (rendered.length > 0) {
    items.value = rendered
  }
}

function syncToStore() {
  outlineSync.debouncedApply(items.value)
}

// ── Item operations ────────────────────────────────────────────────

function handleUpdateItem(index: number, content: string) {
  items.value[index] = { ...items.value[index], content }
  syncToStore()

  // Trigger ghost suggestions if AI is enabled
  if (aiEnabled.value) {
    ghost.onTyping(items.value[index], items.value)
  }
}

function handleEnter(index: number) {
  const currentItem = items.value[index]
  const newItem: OutlineItem = {
    id: nanoid(),
    content: '',
    depth: currentItem.depth,
  }

  items.value.splice(index + 1, 0, newItem)
  focusedIndex.value = index + 1
  nextTick(() => contentRef.value?.focusItem(index + 1))
  syncToStore()
}

function handleDelete(index: number) {
  if (items.value.length <= 1) return // Keep at least one item

  items.value.splice(index, 1)
  const newFocus = Math.max(0, index - 1)
  focusedIndex.value = newFocus
  nextTick(() => contentRef.value?.focusItem(newFocus))
  syncToStore()
}

function handleIndent(index: number) {
  if (index === 0) return // Can't indent root
  const prevDepth = items.value[index - 1]?.depth ?? 0
  const currentDepth = items.value[index].depth

  // Can only indent one level deeper than the previous sibling
  if (currentDepth <= prevDepth) {
    items.value[index] = { ...items.value[index], depth: currentDepth + 1 }

    // Also indent children that were at same or deeper level
    for (let i = index + 1; i < items.value.length; i++) {
      if (items.value[i].depth > currentDepth) {
        items.value[i] = { ...items.value[i], depth: items.value[i].depth + 1 }
      } else {
        break
      }
    }

    syncToStore()
  }
}

function handleOutdent(index: number) {
  const currentDepth = items.value[index].depth
  if (currentDepth <= 0) return // Can't outdent root level

  items.value[index] = { ...items.value[index], depth: currentDepth - 1 }

  // Also outdent children
  for (let i = index + 1; i < items.value.length; i++) {
    if (items.value[i].depth > currentDepth) {
      items.value[i] = { ...items.value[i], depth: items.value[i].depth - 1 }
    } else {
      break
    }
  }

  syncToStore()
}

function handleFocus(index: number) {
  focusedIndex.value = index
  ghost.dismiss()
}

// ── Ghost text ─────────────────────────────────────────────────────

function handleAcceptGhost() {
  const suggestions = ghost.suggestions.value
  if (suggestions.length === 0) return

  const insertIndex = focusedIndex.value + 1
  const depth = items.value[focusedIndex.value]?.depth ?? 0

  const newItems = suggestions.map(s => ({
    id: nanoid(),
    content: s,
    depth,
  }))

  items.value.splice(insertIndex, 0, ...newItems)
  ghost.dismiss()
  focusedIndex.value = insertIndex + newItems.length - 1
  nextTick(() => contentRef.value?.focusItem(focusedIndex.value))
  syncToStore()
}

function handleToggleAI() {
  aiEnabled.value = !aiEnabled.value
  if (!aiEnabled.value) ghost.dismiss()
}

// ── Toolbar actions ────────────────────────────────────────────────

function handleUndo() {
  mapStore.undo()
}

function handleRedo() {
  mapStore.redo()
}

function handleToolbarIndent() {
  if (focusedIndex.value >= 0) handleIndent(focusedIndex.value)
}

function handleToolbarOutdent() {
  if (focusedIndex.value >= 0) handleOutdent(focusedIndex.value)
}

function handleBold() {
  // Insert **bold** markers at cursor position
  // For now, wrap current item content if focused
  if (focusedIndex.value >= 0) {
    const item = items.value[focusedIndex.value]
    if (item.content && !item.content.includes('**')) {
      handleUpdateItem(focusedIndex.value, `**${item.content}**`)
    }
  }
}

// ── Export ──────────────────────────────────────────────────────────

async function handleExport() {
  showExport.value = true
  isGeneratingPng.value = true

  try {
    const dataUrl = await mapRender.renderToDataUrl(
      mapStore.nodes,
      mapStore.edges,
      mapStore.rootNodeId
    )
    pngDataUrl.value = dataUrl
  } catch (e) {
    console.error('PNG generation failed:', e)
  } finally {
    isGeneratingPng.value = false
  }
}

function handleDownloadPng() {
  if (pngDataUrl.value) {
    const link = document.createElement('a')
    link.download = `${mapStore.title || 'mind-map'}.png`
    link.href = pngDataUrl.value
    link.click()
  }
}

// ── Global keyboard handler for Tab (ghost accept) ─────────────────

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab' && ghost.suggestions.value.length > 0 && aiEnabled.value) {
    e.preventDefault()
    handleAcceptGhost()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  outlineSync.cancelDebounce()
})
</script>

<template>
  <div class="nc-outline-editor">
    <OutlineTopBar @export="handleExport" />

    <OutlineContent
      ref="contentRef"
      :items="items"
      :focused-index="focusedIndex"
      :ghost-suggestions="ghost.suggestions.value"
      :ghost-depth="items[focusedIndex]?.depth ?? 0"
      :ai-enabled="aiEnabled"
      @update:item="handleUpdateItem"
      @enter="handleEnter"
      @delete="handleDelete"
      @indent="handleIndent"
      @outdent="handleOutdent"
      @focus="handleFocus"
      @accept-ghost="handleAcceptGhost"
    />

    <OutlineToolbar
      @undo="handleUndo"
      @redo="handleRedo"
      @indent="handleToolbarIndent"
      @outdent="handleToolbarOutdent"
      @bold="handleBold"
      @toggle-ai="handleToggleAI"
      @export="handleExport"
    />

    <OutlineExportSheet
      :open="showExport"
      :png-data-url="pngDataUrl"
      :share-link="shareLink"
      :is-generating="isGeneratingPng"
      @close="showExport = false"
      @download-png="handleDownloadPng"
      @copy-link="() => {}"
      @share="() => {}"
    />
  </div>
</template>

<style scoped>
.nc-outline-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--nc-bg, #09090B);
  overflow: hidden;
}
</style>
