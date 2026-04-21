<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore'
import { useMarkdownSync } from '~/composables/useMarkdownSync'
import type { Node } from '~/types/canvas'

const mapStore = useMapStore()
const mdSync = useMarkdownSync()

// ── State ───────────────────────────────────────────────────────────────────

const text = ref('')
const editorRef = ref<HTMLDivElement | null>(null)
const isUpdatingFromStore = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// ── Node tree ───────────────────────────────────────────────────────────────

interface TreeNode {
  id: string
  content: string
  depth: number
  children: TreeNode[]
  color: string
}

const nodeTree = computed<TreeNode[]>(() => {
  const rootId = mapStore.rootNodeId
  if (!rootId) return []
  const childMap = new Map<string, string[]>()
  for (const edge of mapStore.edges.values()) {
    const list = childMap.get(edge.sourceId) || []
    list.push(edge.targetId)
    childMap.set(edge.sourceId, list)
  }
  const visited = new Set<string>()
  function build(nodeId: string, depth: number): TreeNode | null {
    if (visited.has(nodeId)) return null
    visited.add(nodeId)
    const node = mapStore.nodes.get(nodeId)
    if (!node) return null
    return {
      id: node.id, content: node.content, depth,
      children: (childMap.get(nodeId) || []).map(id => build(id, depth + 1)).filter((n): n is TreeNode => n !== null),
      color: node.style?.borderColor || '#52525B',
    }
  }
  const root = build(rootId, 0)
  return root ? [root] : []
})

// ── Rendered content (Paper-accurate) ───────────────────────────────────────

interface RenderedSection {
  nodeId: string
  heading: string
  headingLevel: number
  description: string
  connections: { id: string; content: string }[]
}

const renderedSections = computed<RenderedSection[]>(() => {
  const rootId = mapStore.rootNodeId
  if (!rootId) return []
  const childMap = new Map<string, string[]>()
  for (const edge of mapStore.edges.values()) {
    const list = childMap.get(edge.sourceId) || []
    list.push(edge.targetId)
    childMap.set(edge.sourceId, list)
  }
  const sections: RenderedSection[] = []
  const visited = new Set<string>()

  function walk(nodeId: string, depth: number) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = mapStore.nodes.get(nodeId)
    if (!node) return

    const connections: { id: string; content: string }[] = []
    for (const edge of mapStore.edges.values()) {
      if (edge.sourceId === nodeId) {
        const t = mapStore.nodes.get(edge.targetId)
        if (t && !childMap.get(nodeId)?.includes(t.id)) {
          connections.push({ id: t.id, content: t.content })
        }
      }
      if (edge.targetId === nodeId) {
        const s = mapStore.nodes.get(edge.sourceId)
        if (s) connections.push({ id: s.id, content: s.content })
      }
    }

    sections.push({
      nodeId: node.id,
      heading: node.content,
      headingLevel: Math.min(depth, 5),
      description: (node.metadata?.description as any)?.summary || '',
      connections,
    })

    for (const childId of (childMap.get(nodeId) || [])) {
      walk(childId, depth + 1)
    }
  }
  walk(rootId, 0)
  return sections
})

// ── Selection ───────────────────────────────────────────────────────────────

const selectedNode = computed<Node | null>(() => {
  if (mapStore.selection.nodeIds.size === 1) {
    const id = Array.from(mapStore.selection.nodeIds)[0]
    return id ? mapStore.nodes.get(id) ?? null : null
  }
  return null
})

const connectedNodes = computed(() => {
  const node = selectedNode.value
  if (!node) return []
  const result: { id: string; content: string }[] = []
  for (const edge of mapStore.edges.values()) {
    if (edge.sourceId === node.id) {
      const t = mapStore.nodes.get(edge.targetId)
      if (t) result.push({ id: t.id, content: t.content })
    }
    if (edge.targetId === node.id) {
      const s = mapStore.nodes.get(edge.sourceId)
      if (s) result.push({ id: s.id, content: s.content })
    }
  }
  return result
})

function selectNode(nodeId: string) {
  mapStore.select([nodeId])
}

// ── Sync ────────────────────────────────────────────────────────────────────

// ── Styled line rendering ────────────────────────────────────────────────────

interface StyledLine {
  raw: string
  type: 'h1' | 'h2' | 'h3' | 'body' | 'empty' | 'hr'
}

function classifyLine(raw: string): StyledLine {
  if (raw.trim() === '') return { raw, type: 'empty' }
  if (raw.trim() === '---') return { raw, type: 'hr' }
  if (raw.match(/^# /)) return { raw, type: 'h1' }
  if (raw.match(/^## /)) return { raw, type: 'h2' }
  if (raw.match(/^#{3,6} /)) return { raw, type: 'h3' }
  return { raw, type: 'body' }
}

// ── Build DOM safely (no innerHTML) ──────────────────────────────────────────

function buildLineElement(line: StyledLine): HTMLDivElement {
  const div = document.createElement('div')
  div.className = `mde-line mde-line--${line.type}`

  if (line.type === 'empty') {
    div.appendChild(document.createElement('br'))
    return div
  }

  const content = line.raw

  // For headings, dim the hash prefix
  if (line.type === 'h1' || line.type === 'h2' || line.type === 'h3') {
    const match = content.match(/^(#{1,6} )(.*)$/)
    if (match) {
      const hashSpan = document.createElement('span')
      hashSpan.className = 'mde-hash'
      hashSpan.textContent = match[1]
      div.appendChild(hashSpan)

      const textNode = document.createTextNode(match[2])
      div.appendChild(textNode)
      return div
    }
  }

  // For body text, highlight [[wikilinks]]
  if (line.type === 'body') {
    const parts = content.split(/(\[\[[^\]]+\]\])/)
    for (const part of parts) {
      if (part.match(/^\[\[.+\]\]$/)) {
        const span = document.createElement('span')
        span.className = 'mde-wikilink'
        span.textContent = part
        div.appendChild(span)
      } else {
        div.appendChild(document.createTextNode(part))
      }
    }
    return div
  }

  div.textContent = content
  return div
}

// ── Cursor save/restore for contenteditable ──────────────────────────────────

function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  const preRange = range.cloneRange()
  preRange.selectNodeContents(el)
  preRange.setEnd(range.startContainer, range.startOffset)
  return preRange.toString().length
}

function setCaretOffset(el: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let pos = 0
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const len = node.length
    if (pos + len >= offset) {
      const sel = window.getSelection()
      if (sel) {
        const range = document.createRange()
        range.setStart(node, Math.min(offset - pos, len))
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
      return
    }
    pos += len
  }
}

// ── Sync: contenteditable → text ref → store ─────────────────────────────────

function onEditorInput() {
  if (isUpdatingFromStore.value) return
  const el = editorRef.value
  if (!el) return

  // Extract plain text — each child div is one line
  const lines: string[] = []
  for (const child of el.children) {
    lines.push((child as HTMLElement).textContent || '')
  }
  text.value = lines.join('\n')

  // Debounce sync to store
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    mdSync.fromMarkdown(text.value)
  }, 800)
}

function renderEditor() {
  const el = editorRef.value
  if (!el) return

  const caretPos = document.activeElement === el ? getCaretOffset(el) : -1

  // Clear and rebuild with safe DOM methods
  const lines = text.value.split('\n').map(classifyLine)
  while (el.firstChild) el.removeChild(el.firstChild)
  for (const line of lines) {
    el.appendChild(buildLineElement(line))
  }

  // Restore caret if editor was focused
  if (caretPos >= 0) {
    setCaretOffset(el, caretPos)
  }
}

function loadFromStore() {
  isUpdatingFromStore.value = true
  if (debounceTimer !== null) { clearTimeout(debounceTimer); debounceTimer = null }
  text.value = mdSync.toMarkdown()
  nextTick(() => {
    renderEditor()
    isUpdatingFromStore.value = false
  })
}

// Re-render styling on text change (preserving cursor)
watch(text, () => {
  if (!isUpdatingFromStore.value) {
    nextTick(() => renderEditor())
  }
})

onMounted(() => {
  loadFromStore()
  nextTick(() => { editorRef.value?.focus() })
})
onUnmounted(() => { if (debounceTimer !== null) clearTimeout(debounceTimer) })

watch(
  () => [mapStore.nodes.size, mapStore.edges.size] as const,
  () => { if (!isUpdatingFromStore.value) loadFromStore() }
)

const mapTitle = computed(() => mapStore.title || 'Untitled Map')
const nodeCount = computed(() => mapStore.nodes.size)
const edgeCount = computed(() => mapStore.edges.size)
</script>

<template>
  <div class="mde">
    <!-- Left: Node Tree -->
    <aside class="mde-tree">
      <div class="mde-tree-hdr"><span class="mde-tree-lbl">NODES</span></div>
      <div class="mde-tree-scroll">
        <template v-for="root in nodeTree" :key="root.id">
          <MdeTreeItem :node="root" :selected-id="selectedNode?.id" @select="selectNode" />
        </template>
        <div v-if="nodeTree.length === 0" class="mde-tree-empty">No nodes yet</div>
      </div>
    </aside>

    <!-- Center: Rendered Content / Editor -->
    <main class="mde-center">
      <!-- Header bar -->
      <div class="mde-bar">
        <div class="mde-bar-l">
          <span v-if="selectedNode" class="mde-bar-dot" :style="{ background: selectedNode.style?.borderColor || '#FB923C' }" />
          <span class="mde-bar-name">{{ selectedNode?.content || mapTitle }}</span>
        </div>
        <span class="mde-bar-meta">{{ connectedNodes.length }} connections</span>
      </div>

      <!-- Live-preview contenteditable editor -->
      <div class="mde-edit-wrap">
        <div
          ref="editorRef"
          class="mde-live-editor"
          contenteditable="true"
          spellcheck="false"
          @input="onEditorInput"
        />
      </div>
    </main>

    <!-- Right: Graph Preview + Info -->
    <aside class="mde-right">
      <div class="mde-right-section">
        <span class="mde-right-lbl">GRAPH PREVIEW</span>
        <span class="mde-right-meta">{{ nodeCount }} nodes · {{ edgeCount }} edges</span>
      </div>

      <!-- Mini graph SVG -->
      <div class="mde-mini-graph">
        <svg viewBox="-200 -200 400 400" class="mde-mini-svg">
          <template v-for="edge in mapStore.edges.values()" :key="edge.id">
            <line
              v-if="mapStore.nodes.get(edge.sourceId) && mapStore.nodes.get(edge.targetId)"
              :x1="(mapStore.nodes.get(edge.sourceId)!.position.x || 0) * 0.12"
              :y1="(mapStore.nodes.get(edge.sourceId)!.position.y || 0) * 0.12"
              :x2="(mapStore.nodes.get(edge.targetId)!.position.x || 0) * 0.12"
              :y2="(mapStore.nodes.get(edge.targetId)!.position.y || 0) * 0.12"
              stroke="rgba(255,255,255,0.06)"
              stroke-width="0.5"
            />
          </template>
          <template v-for="node in mapStore.nodes.values()" :key="node.id">
            <circle
              :cx="(node.position.x || 0) * 0.12"
              :cy="(node.position.y || 0) * 0.12"
              :r="node.id === mapStore.rootNodeId ? 5 : 2.5"
              :fill="node.id === selectedNode?.id ? '#00D2BE' : node.style?.borderColor || 'rgba(255,255,255,0.3)'"
              class="mde-mini-dot"
              @click="selectNode(node.id)"
            />
          </template>
        </svg>
      </div>

      <!-- Outline -->
      <div v-if="selectedNode" class="mde-right-section">
        <span class="mde-right-lbl">SELECTED</span>
        <p class="mde-sel-name">{{ selectedNode.content }}</p>
      </div>

      <div v-if="connectedNodes.length > 0" class="mde-right-section">
        <span class="mde-right-lbl">CONNECTIONS</span>
        <div class="mde-conn-list">
          <button v-for="cn in connectedNodes" :key="cn.id" class="mde-conn-item" @click="selectNode(cn.id)">
            <span class="mde-conn-dot" />
            <span>{{ cn.content }}</span>
          </button>
        </div>
      </div>

      <!-- Outline from headings -->
      <div v-if="renderedSections.length > 0" class="mde-right-section">
        <span class="mde-right-lbl">OUTLINE</span>
        <div class="mde-outline">
          <button
            v-for="s in renderedSections.filter(s => s.headingLevel <= 1)"
            :key="s.nodeId"
            :class="['mde-outline-item', { 'mde-outline-item--root': s.headingLevel === 0 }]"
            @click="selectNode(s.nodeId)"
          >
            {{ s.heading }}
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<!-- Recursive tree item (inline component) -->
<script lang="ts">
/* eslint-disable import/first */
import { defineComponent, type PropType } from 'vue'
interface TN { id: string; content: string; depth: number; children: TN[]; color: string }

const MdeTreeItem = defineComponent({
  name: 'MdeTreeItem',
  props: {
    node: { type: Object as PropType<TN>, required: true },
    selectedId: { type: String, default: null },
  },
  emits: ['select'],
  setup(props) {
    const expanded = ref(true)
    const hasKids = computed(() => props.node.children.length > 0)
    const isSel = computed(() => props.node.id === props.selectedId)
    const isRoot = computed(() => props.node.depth === 0)
    return { expanded, hasKids, isSel, isRoot }
  },
  template: `
    <div>
      <button
        :class="['mde-tn', { 'mde-tn--sel': isSel, 'mde-tn--root': isRoot }]"
        :style="{ paddingLeft: (node.depth * 16 + 8) + 'px' }"
        @click="$emit('select', node.id)"
      >
        <span v-if="hasKids" :class="['mde-tn-chev', expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right']" @click.stop="expanded = !expanded" />
        <span v-else class="mde-tn-chev-sp" />
        <span class="mde-tn-dot" :style="{ background: node.color }" />
        <span class="mde-tn-txt">{{ node.content }}</span>
      </button>
      <div v-if="expanded && hasKids">
        <MdeTreeItem v-for="c in node.children" :key="c.id" :node="c" :selected-id="selectedId" @select="$emit('select', $event)" />
      </div>
    </div>
  `,
})
</script>

<style scoped>
/* ═══ LAYOUT — exact Paper values ═══ */
.mde { position: absolute; inset: 0; display: flex; background: var(--nc-bg, #09090B); overflow: hidden; }

/* ── Left: Tree (240px, #0A0A0C) ── */
.mde-tree { width: 240px; flex-shrink: 0; display: flex; flex-direction: column; background: #0A0A0C; border-right: 1px solid #1A1A1E; }
.mde-tree-hdr { padding: 14px 16px 8px; }
.mde-tree-lbl { font: 700 10px/14px 'Inter', sans-serif; color: #3F3F46; letter-spacing: 0.08em; }
.mde-tree-scroll { flex: 1; overflow-y: auto; padding: 0 8px 16px; }
.mde-tree-scroll::-webkit-scrollbar { width: 3px; }
.mde-tree-scroll::-webkit-scrollbar-thumb { background: #1A1A1E; border-radius: 2px; }
.mde-tree-empty { padding: 20px 16px; font: 400 12px 'Inter', sans-serif; color: #3F3F46; text-align: center; }

/* Tree nodes */
.mde-tn { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px; border-radius: 6px; background: none; border: none; color: #A1A1AA; font: 400 13px/16px 'Inter', sans-serif; cursor: pointer; text-align: left; transition: background 120ms ease; }
.mde-tn:hover { background: rgba(255,255,255,0.03); }
.mde-tn--sel { background: rgba(0,210,190,0.06); color: #FAFAFA; font-weight: 500; }
.mde-tn--root { font-weight: 600; color: #00D2BE; }
.mde-tn-chev { font-size: 10px; color: #3F3F46; flex-shrink: 0; width: 14px; }
.mde-tn-chev-sp { width: 14px; flex-shrink: 0; }
.mde-tn-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.mde-tn-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Center: Editor (#0D0D0F) ── */
.mde-center { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #0D0D0F; border-right: 1px solid #1A1A1E; }

/* Bar — 12px padding, border bottom */
.mde-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid #1A1A1E; flex-shrink: 0; }
.mde-bar-l { display: flex; align-items: center; gap: 8px; }
.mde-bar-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.mde-bar-name { font: 500 13px/16px 'Inter', sans-serif; color: #FAFAFA; }
.mde-bar-r { display: flex; align-items: center; gap: 12px; }
.mde-bar-meta { font: 400 11px/14px 'Inter', sans-serif; color: #3F3F46; }

/* ── Live-preview editor ── */
.mde-edit-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

.mde-live-editor {
  flex: 1;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 40px;
  outline: none;
  caret-color: #00D2BE;
  overflow-y: auto;
  box-sizing: border-box;
  cursor: text;
  /* Base text style for body lines */
  font: 400 14px/1.7 'Inter', sans-serif;
  color: #71717A;
}

.mde-live-editor::-webkit-scrollbar { width: 3px; }
.mde-live-editor::-webkit-scrollbar-track { background: transparent; }
.mde-live-editor::-webkit-scrollbar-thumb { background: #1A1A1E; border-radius: 2px; }

/* Empty state */
.mde-live-editor:empty::before {
  content: '# Start typing your topic...';
  color: #27272A;
  font-style: italic;
  pointer-events: none;
}

/* ── Line types — Paper-exact typography ── */
.mde-line { min-height: 1.2em; }

/* H1: 28px, weight 800, #FAFAFA, -0.03em tracking */
.mde-line--h1 {
  font: 800 28px/1.2 'Inter', sans-serif;
  color: #FAFAFA;
  letter-spacing: -0.03em;
  padding: 8px 0 4px;
}

/* H2: 18px, weight 700, #DEDEDE, -0.02em tracking */
.mde-line--h2 {
  font: 700 18px/1.3 'Inter', sans-serif;
  color: #DEDEDE;
  letter-spacing: -0.02em;
  padding: 20px 0 4px;
}

/* H3+: 15px, weight 600, #BEBEBE */
.mde-line--h3 {
  font: 600 15px/1.4 'Inter', sans-serif;
  color: #BEBEBE;
  letter-spacing: -0.01em;
  padding: 14px 0 2px;
}

/* Body: 14px, weight 400, #71717A, 170% line-height */
.mde-line--body {
  font: 400 14px/1.7 'Inter', sans-serif;
  color: #A1A1AA;
}

/* Empty line */
.mde-line--empty {
  height: 8px;
}

/* HR */
.mde-line--hr {
  font: 400 14px 'Inter', sans-serif;
  color: #27272A;
  padding: 8px 0;
}

/* Hash prefix dimmed */
.mde-hash {
  color: #27272A;
  font-weight: inherit;
}

/* [[wikilinks]] in teal */
.mde-wikilink {
  color: #00D2BE;
  font-weight: 500;
}

/* ── Right panel (320px, #09090B) ── */
.mde-right { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; background: #09090B; overflow-y: auto; }
.mde-right::-webkit-scrollbar { width: 3px; }
.mde-right::-webkit-scrollbar-thumb { background: #1A1A1E; border-radius: 2px; }

.mde-right-section { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.mde-right-lbl { font: 700 10px/14px 'Inter', sans-serif; color: #3F3F46; letter-spacing: 0.08em; display: block; margin-bottom: 8px; }
.mde-right-meta { font: 400 11px/14px 'Inter', sans-serif; color: #52525B; }

/* Mini graph */
.mde-mini-graph { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.mde-mini-svg { width: 100%; height: 200px; }
.mde-mini-dot { cursor: pointer; transition: fill 120ms ease; }

/* Selected */
.mde-sel-name { font: 600 14px/18px 'Inter', sans-serif; color: #FAFAFA; margin: 0; }

/* Connections */
.mde-conn-list { display: flex; flex-direction: column; gap: 2px; }
.mde-conn-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; background: none; border: none; color: #00D2BE; font: 400 13px 'Inter', sans-serif; cursor: pointer; text-align: left; transition: opacity 120ms ease; }
.mde-conn-item:hover { opacity: 0.7; }
.mde-conn-dot { width: 4px; height: 4px; border-radius: 50%; background: #3F3F46; flex-shrink: 0; }

/* Outline */
.mde-outline { display: flex; flex-direction: column; gap: 2px; }
.mde-outline-item { background: none; border: none; color: #71717A; font: 400 12px/16px 'Inter', sans-serif; cursor: pointer; text-align: left; padding: 3px 0 3px 12px; transition: color 120ms ease; }
.mde-outline-item:hover { color: #FAFAFA; }
.mde-outline-item--root { font-weight: 600; color: #FAFAFA; padding-left: 0; font-size: 13px; }

/* ── Light theme ── */
:root.light .mde-tree { background: #F5F5F3; }
:root.light .mde-center { background: #FAFAF9; }
:root.light .mde-right { background: #FAFAF9; }
:root.light .mde-tn { color: #71717A; }
:root.light .mde-tn--sel { color: #111; background: rgba(0,210,190,0.06); }
:root.light .mde-tn--root { color: #00A89A; }
:root.light .mde-live-editor { color: #71717A; }
:root.light .mde-line--h1 { color: #111; }
:root.light .mde-line--h2 { color: #222; }
:root.light .mde-line--h3 { color: #333; }
:root.light .mde-line--body { color: #52525B; }
:root.light .mde-hash { color: #D4D4D8; }
:root.light .mde-bar-name { color: #111; }

/* ── Responsive ── */
@media (max-width: 768px) { .mde-tree, .mde-right { display: none; } .mde-center { border-right: none; } }
@media (max-width: 1024px) { .mde-right { display: none; } }
</style>
