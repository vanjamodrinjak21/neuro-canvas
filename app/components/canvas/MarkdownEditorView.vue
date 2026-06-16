<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore'
import { useMarkdownSync } from '~/composables/useMarkdownSync'
import { useAutoSave } from '~/composables/useAutoSave'
import type { Node } from '~/types/canvas'

const mapStore = useMapStore()
const mdSync = useMarkdownSync()
const autoSave = useAutoSave()
// Boot the periodic timer so the 30s safety net runs alongside the
// per-keystroke flush below — covers cases where the user hops away
// without triggering the debounce (selection moves, blur).
autoSave.start()

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

const isUserEditing = ref(false)
let editingIdleTimer: ReturnType<typeof setTimeout> | null = null

function onEditorInput() {
  if (isUpdatingFromStore.value) return
  const el = editorRef.value
  if (!el) return

  isUserEditing.value = true
  if (editingIdleTimer) clearTimeout(editingIdleTimer)
  editingIdleTimer = setTimeout(() => { isUserEditing.value = false }, 2000)

  // Track interaction so the periodic auto-save defers until the user pauses.
  autoSave.notifyInteraction()

  // Use innerText which correctly handles line breaks from contenteditable
  // regardless of how the browser structures the child elements.
  // This avoids the bug where backspace merges divs and el.children
  // iteration loses entire paragraphs.
  text.value = el.innerText || ''

  // Debounce sync to store — use a longer delay to avoid
  // partial text getting synced while user is mid-edit
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    mdSync.fromMarkdown(text.value)
    // Flush to local DB + cloud immediately after parsing the markdown.
    // Don't wait 30s for the periodic timer.
    autoSave.save().catch(err => console.error('[Editor] save failed', err))
  }, 1500)
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
// Skip re-render while user is actively typing — the DOM is already correct
// from their input. Only re-render when idle (debounce) to apply syntax highlighting.
let renderDebounce: ReturnType<typeof setTimeout> | null = null
watch(text, () => {
  if (!isUpdatingFromStore.value) {
    // On mobile, frequent DOM rebuilds cause cursor jumps.
    // Debounce the re-render so it only fires after the user pauses typing.
    if (renderDebounce) clearTimeout(renderDebounce)
    renderDebounce = setTimeout(() => {
      renderDebounce = null
      // Only re-render if editor is not focused (or if composition ended)
      const el = editorRef.value
      if (el && document.activeElement !== el) {
        nextTick(() => renderEditor())
      }
    }, 1000)
  }
})

onMounted(() => {
  loadFromStore()
  nextTick(() => { editorRef.value?.focus() })
})
onUnmounted(() => {
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  if (renderDebounce) clearTimeout(renderDebounce)
  if (editingIdleTimer) clearTimeout(editingIdleTimer)
})

watch(
  () => [mapStore.nodes.size, mapStore.edges.size] as const,
  () => {
    // Don't overwrite the editor while the user is actively typing.
    // Their edits will sync to the store via the debounced fromMarkdown call.
    if (!isUpdatingFromStore.value && !isUserEditing.value) loadFromStore()
  }
)

const mapTitle = computed(() => mapStore.title || 'Untitled Map')
const nodeCount = computed(() => mapStore.nodes.size)
const edgeCount = computed(() => mapStore.edges.size)
</script>

<template>
  <div class="mde">
    <!-- Left: Node Tree -->
    <aside class="mde-tree">
      <div class="mde-tree-hdr"><span class="mde-tree-lbl">{{ $t('canvas.markdown_editor.nodes_label') }}</span></div>
      <div class="mde-tree-scroll">
        <template v-for="root in nodeTree" :key="root.id">
          <MdeTreeItem :node="root" :selected-id="selectedNode?.id" @select="selectNode" />
        </template>
        <div v-if="nodeTree.length === 0" class="mde-tree-empty">{{ $t('canvas.markdown_editor.no_nodes') }}</div>
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
        <span class="mde-bar-meta">{{ $t('canvas.markdown_editor.connections_count', { n: connectedNodes.length }) }}</span>
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
        <span class="mde-right-lbl">{{ $t('canvas.markdown_editor.graph_preview') }}</span>
        <span class="mde-right-meta">{{ $t('maps.nodes_count', { n: nodeCount }) }} · {{ $t('canvas.graph_controls_panel.edges_count', { n: edgeCount }) }}</span>
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
              class="mde-mini-edge"
              stroke-width="0.5"
            />
          </template>
          <template v-for="node in mapStore.nodes.values()" :key="node.id">
            <circle
              :cx="(node.position.x || 0) * 0.12"
              :cy="(node.position.y || 0) * 0.12"
              :r="node.id === mapStore.rootNodeId ? 5 : 2.5"
              :fill="node.id === selectedNode?.id ? '#00D2BE' : node.style?.borderColor || '#71717A'"
              class="mde-mini-dot"
              @click="selectNode(node.id)"
            />
          </template>
        </svg>
      </div>

      <!-- Outline -->
      <div v-if="selectedNode" class="mde-right-section">
        <span class="mde-right-lbl">{{ $t('canvas.markdown_editor.selected') }}</span>
        <p class="mde-sel-name">{{ selectedNode.content }}</p>
      </div>

      <div v-if="connectedNodes.length > 0" class="mde-right-section">
        <span class="mde-right-lbl">{{ $t('canvas.markdown_editor.connections') }}</span>
        <div class="mde-conn-list">
          <button v-for="cn in connectedNodes" :key="cn.id" class="mde-conn-item" @click="selectNode(cn.id)">
            <span class="mde-conn-dot" />
            <span>{{ cn.content }}</span>
          </button>
        </div>
      </div>

      <!-- Outline from headings -->
      <div v-if="renderedSections.length > 0" class="mde-right-section">
        <span class="mde-right-lbl">{{ $t('canvas.markdown_editor.outline') }}</span>
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
/* ═══ Markdown / outline editor — NeuroCanvas design system ═══
   Token-driven surfaces + typography so both themes flip automatically;
   mono eyebrow labels and the teal accent stay in step with the canvas,
   side panels and nav. */
.mde { position: absolute; inset: 0; display: flex; background: var(--nc-bg); overflow: hidden; padding-top: 72px; font-family: var(--nc-font-display); }

/* ── Left: node tree ── */
.mde-tree { width: 248px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--nc-surface); border-right: 1px solid var(--nc-border); }
.mde-tree-hdr { padding: 16px 16px 10px; }
.mde-tree-lbl { font-family: var(--nc-font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--nc-text-dim); }
.mde-tree-scroll { flex: 1; overflow-y: auto; padding: 0 8px 16px; }
.mde-tree-scroll::-webkit-scrollbar { width: 6px; }
.mde-tree-scroll::-webkit-scrollbar-thumb { background: var(--nc-border-active); border-radius: 999px; }
.mde-tree-empty { padding: 20px 16px; font-size: 12px; color: var(--nc-text-dim); text-align: center; }

/* Tree nodes */
.mde-tn { display: flex; align-items: center; gap: 7px; width: 100%; padding: 6px 8px; border-radius: var(--nc-radius-sm); background: none; border: none; color: var(--nc-text-secondary); font: inherit; font-size: 13px; line-height: 16px; cursor: pointer; text-align: left; transition: background var(--nc-duration-fast) var(--nc-ease), color var(--nc-duration-fast) var(--nc-ease); }
.mde-tn:hover { background: var(--nc-surface-3); color: var(--nc-text); }
.mde-tn:active { transform: scale(0.99); }
.mde-tn--sel { background: var(--nc-accent-glow); color: var(--nc-text); font-weight: 500; }
.mde-tn--root { font-weight: 600; color: var(--nc-accent-text, var(--nc-accent)); }
.mde-tn-chev { font-size: 11px; color: var(--nc-text-dim); flex-shrink: 0; width: 14px; transition: color var(--nc-duration-fast) var(--nc-ease); }
.mde-tn-chev:hover { color: var(--nc-text-secondary); }
.mde-tn-chev-sp { width: 14px; flex-shrink: 0; }
.mde-tn-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.mde-tn-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Center: writing surface (sits on the canvas void) ── */
.mde-center { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--nc-bg); border-right: 1px solid var(--nc-border); }

/* Context bar */
.mde-bar { display: flex; align-items: center; justify-content: space-between; padding: 13px 24px; border-bottom: 1px solid var(--nc-border); flex-shrink: 0; }
.mde-bar-l { display: flex; align-items: center; gap: 8px; min-width: 0; }
.mde-bar-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.mde-bar-name { font-size: 13px; font-weight: 600; color: var(--nc-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mde-bar-r { display: flex; align-items: center; gap: 12px; }
.mde-bar-meta { font-family: var(--nc-font-mono); font-size: 10px; letter-spacing: 0.06em; color: var(--nc-text-dim); flex-shrink: 0; }

/* ── Live-preview editor ── */
.mde-edit-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

.mde-live-editor {
  flex: 1;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 40px 96px;
  outline: none;
  caret-color: var(--nc-accent);
  overflow-y: auto;
  box-sizing: border-box;
  cursor: text;
  /* Base text style for body lines */
  font-family: var(--nc-font-display);
  font-size: 15px;
  line-height: 1.75;
  color: var(--nc-text-secondary);
}

.mde-live-editor::-webkit-scrollbar { width: 6px; }
.mde-live-editor::-webkit-scrollbar-track { background: transparent; }
.mde-live-editor::-webkit-scrollbar-thumb { background: var(--nc-border-active); border-radius: 999px; }

/* Empty state */
.mde-live-editor:empty::before {
  content: '# Start typing your topic…';
  color: var(--nc-text-dim);
  pointer-events: none;
}

/* ── Line typography — display font, token colours ── */
.mde-line { min-height: 1.2em; }

.mde-line--h1 {
  font-size: clamp(1.5rem, 1.2rem + 1.2vw, 1.875rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--nc-text);
  padding: 8px 0 4px;
}

.mde-line--h2 {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--nc-text);
  padding: 22px 0 4px;
}

.mde-line--h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--nc-text-secondary);
  padding: 14px 0 2px;
}

.mde-line--body {
  font-size: 15px;
  font-weight: 400;
  line-height: 1.75;
  color: var(--nc-text-secondary);
}

.mde-line--empty {
  height: 10px;
}

.mde-line--hr {
  color: var(--nc-text-dim);
  padding: 8px 0;
}

/* Hash prefix dimmed */
.mde-hash {
  color: var(--nc-text-dim);
  font-weight: inherit;
}

/* [[wikilinks]] in teal (theme-aware accent-text for light-mode contrast) */
.mde-wikilink {
  color: var(--nc-accent-text, var(--nc-accent));
  font-weight: 500;
}

/* ── Right panel ── */
.mde-right { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--nc-surface); overflow-y: auto; }
.mde-right::-webkit-scrollbar { width: 6px; }
.mde-right::-webkit-scrollbar-thumb { background: var(--nc-border-active); border-radius: 999px; }

.mde-right-section { padding: 16px; border-bottom: 1px solid var(--nc-border); }
.mde-right-lbl { font-family: var(--nc-font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--nc-text-dim); display: block; margin-bottom: 10px; }
.mde-right-meta { font-family: var(--nc-font-mono); font-size: 10px; letter-spacing: 0.04em; color: var(--nc-text-dim); }

/* Mini graph */
.mde-mini-graph { padding: 8px; border-bottom: 1px solid var(--nc-border); }
.mde-mini-svg { width: 100%; height: 200px; display: block; }
.mde-mini-edge { stroke: var(--nc-border-active); }
.mde-mini-dot { cursor: pointer; transition: fill var(--nc-duration-fast) var(--nc-ease); }

/* Selected */
.mde-sel-name { font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--nc-text); margin: 0; }

/* Connections */
.mde-conn-list { display: flex; flex-direction: column; gap: 1px; }
.mde-conn-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 6px; margin: 0 -6px; border-radius: var(--nc-radius-sm); background: none; border: none; color: var(--nc-accent-text, var(--nc-accent)); font: inherit; font-size: 13px; cursor: pointer; text-align: left; transition: background var(--nc-duration-fast) var(--nc-ease); }
.mde-conn-item:hover { background: var(--nc-surface-3); }
.mde-conn-item:active { transform: scale(0.99); }
.mde-conn-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--nc-accent); flex-shrink: 0; }

/* Outline */
.mde-outline { display: flex; flex-direction: column; gap: 1px; }
.mde-outline-item { background: none; border: none; color: var(--nc-text-muted); font: inherit; font-size: 12px; line-height: 16px; cursor: pointer; text-align: left; padding: 4px 6px 4px 12px; margin: 0 -6px; border-radius: var(--nc-radius-sm); transition: color var(--nc-duration-fast) var(--nc-ease), background var(--nc-duration-fast) var(--nc-ease); }
.mde-outline-item:hover { color: var(--nc-text); background: var(--nc-surface-3); }
.mde-outline-item--root { font-weight: 600; color: var(--nc-text); padding-left: 6px; font-size: 13px; }

/* ── Responsive (the desktop view; mobile embeds via MobileMapEditor) ── */
@media (max-width: 1024px) { .mde-right { display: none; } }
@media (max-width: 768px) {
  .mde-tree, .mde-right, .mde-bar { display: none; }
  .mde-center { border-right: none; background: transparent; }
  .mde-edit-wrap { background: transparent; }
  .mde-live-editor {
    max-width: none;
    padding: 4px 20px calc(env(safe-area-inset-bottom, 0px) + 96px);
    background: transparent;
    font-size: 15px;
    line-height: 1.65;
    letter-spacing: 0;
    color: var(--nc-text-secondary);
  }
  .mde-line { padding: 0; }
  .mde-line--h1 {
    /* Root title rendered by chrome card already — collapse the H1 line */
    display: none;
  }
  .mde-line--h2 {
    margin-top: 28px; margin-bottom: 10px; padding: 0;
    font-family: var(--nc-font-mono);
    font-weight: 600; font-size: 11px; line-height: 14px;
    letter-spacing: 0.14em;
    color: var(--nc-text-dim);
    text-transform: uppercase;
  }
  .mde-line--h3 {
    margin-top: 22px; margin-bottom: 8px; padding: 0;
    font-family: var(--nc-font-mono);
    font-weight: 600; font-size: 10px; line-height: 14px;
    letter-spacing: 0.12em;
    color: var(--nc-text-muted);
    text-transform: uppercase;
  }
  .mde-line--body {
    font-size: 15px; line-height: 1.65;
    color: var(--nc-text-secondary);
    margin: 0 0 6px 0;
  }
  .mde-hash { display: none; }
  .mde-wikilink {
    color: var(--nc-accent-text, var(--nc-accent));
    background: var(--nc-accent-glow);
    border-bottom: 1px dashed color-mix(in srgb, var(--nc-accent) 30%, transparent);
    padding: 0 2px;
    border-radius: 3px;
  }
  .mde-line--hr {
    border: none;
    border-top: 1px solid var(--nc-border);
    margin: 24px 0;
  }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .mde-tn, .mde-conn-item, .mde-outline-item, .mde-mini-dot, .mde-tn-chev { transition: none; }
  .mde-tn:active, .mde-conn-item:active { transform: none; }
}
</style>
