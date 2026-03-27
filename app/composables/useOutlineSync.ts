import { nanoid } from 'nanoid'
import { useMapStore } from '~/stores/mapStore'

/**
 * Outline item — one line in the outline editor, mapped 1:1 to a map node.
 */
export interface OutlineItem {
  id: string        // Stable node ID
  content: string   // Inline markdown text
  depth: number     // Indentation level (0 = root)
}

/**
 * Bidirectional sync between an indented-outline text representation
 * and the mapStore node/edge graph.
 *
 * - parse(): text lines → OutlineItem[] + mapStore mutations
 * - render(): mapStore nodes/edges → OutlineItem[]
 */
export function useOutlineSync() {
  const mapStore = useMapStore()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // ── Nodes → Outline Items (render) ─────────────────────────────────

  /**
   * Walk the node tree depth-first and produce an ordered list of OutlineItems.
   * Reuses the same adjacency-list pattern as useExport's mapToMarkdown.
   */
  function render(): OutlineItem[] {
    const items: OutlineItem[] = []
    const nodes = mapStore.nodes
    const edges = mapStore.edges

    // Build adjacency list (parent → children)
    const childrenOf = new Map<string, string[]>()
    for (const edge of edges.values()) {
      const list = childrenOf.get(edge.sourceId) || []
      list.push(edge.targetId)
      childrenOf.set(edge.sourceId, list)
    }

    const visited = new Set<string>()

    function walk(nodeId: string, depth: number) {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const node = nodes.get(nodeId)
      if (!node) return

      items.push({
        id: node.id,
        content: node.content,
        depth,
      })

      const children = childrenOf.get(nodeId) || []
      for (const childId of children) {
        walk(childId, depth + 1)
      }
    }

    // Start from root if available
    if (mapStore.rootNodeId && nodes.has(mapStore.rootNodeId)) {
      walk(mapStore.rootNodeId, 0)
    }

    // Collect orphan nodes not reached from root
    for (const node of nodes.values()) {
      if (!visited.has(node.id)) {
        walk(node.id, 0)
      }
    }

    return items
  }

  // ── Outline Items → Nodes (parse + apply) ──────────────────────────

  /**
   * Apply a list of OutlineItems to the mapStore.
   * Creates/updates/deletes nodes and edges as needed.
   * Wraps all changes in a single batchUpdate for clean undo/redo.
   */
  function apply(items: OutlineItem[]) {
    mapStore.batchUpdate('Edit outline', () => {
      const existingNodeIds = new Set(mapStore.nodes.keys())
      const newNodeIds = new Set(items.map(i => i.id))

      // Track parent stack for edge creation
      const parentStack: string[] = []

      // Track which edges we need
      const neededEdges = new Set<string>() // "sourceId→targetId"

      for (const item of items) {
        // Ensure parentStack is deep enough
        parentStack[item.depth] = item.id

        // Create or update node
        if (existingNodeIds.has(item.id)) {
          const existing = mapStore.nodes.get(item.id)
          if (existing && existing.content !== item.content) {
            mapStore.updateNode(item.id, { content: item.content })
          }
        } else {
          // Position new nodes in a simple vertical layout
          const y = items.indexOf(item) * 60
          const x = item.depth * 200
          mapStore.addNode({
            id: item.id,
            content: item.content,
            position: { x, y },
          })
        }

        // Create edge from parent
        if (item.depth > 0) {
          const parentId = parentStack[item.depth - 1]
          if (parentId) {
            neededEdges.add(`${parentId}→${item.id}`)
          }
        }
      }

      // Delete nodes that were removed from the outline
      for (const nodeId of existingNodeIds) {
        if (!newNodeIds.has(nodeId)) {
          mapStore.deleteNode(nodeId)
        }
      }

      // Build set of existing edges for comparison
      const existingEdgeKeys = new Map<string, string>()
      for (const edge of mapStore.edges.values()) {
        existingEdgeKeys.set(`${edge.sourceId}→${edge.targetId}`, edge.id)
      }

      // Add missing edges
      for (const key of neededEdges) {
        if (!existingEdgeKeys.has(key)) {
          const [sourceId, targetId] = key.split('→')
          mapStore.addEdge(sourceId, targetId)
        }
      }

      // Remove edges that no longer correspond to the outline hierarchy
      for (const [key, edgeId] of existingEdgeKeys) {
        if (!neededEdges.has(key)) {
          mapStore.deleteEdge(edgeId)
        }
      }

      // Ensure root is set correctly
      if (items.length > 0) {
        const rootItem = items.find(i => i.depth === 0)
        if (rootItem && mapStore.rootNodeId !== rootItem.id) {
          // Update root node flag
          const oldRoot = mapStore.rootNodeId ? mapStore.nodes.get(mapStore.rootNodeId) : null
          if (oldRoot) {
            mapStore.updateNode(oldRoot.id, { isRoot: false })
          }
          mapStore.updateNode(rootItem.id, { isRoot: true })
        }
      }
    })
  }

  // ── Text ↔ Items (convenience for raw text mode) ───────────────────

  /**
   * Parse raw indented text into OutlineItems.
   * Each line becomes an item; leading 2-space indentation sets depth.
   * Preserves existing node IDs via the provided ID map.
   */
  function parseText(text: string, idMap: Map<number, string>): OutlineItem[] {
    const lines = text.split('\n')
    const items: OutlineItem[] = []

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      if (raw.trim() === '') continue

      // Count leading 2-space indentation
      const match = raw.match(/^( *)/)
      const spaces = match ? match[1].length : 0
      const depth = Math.floor(spaces / 2)
      const content = raw.trimStart()

      // Reuse existing ID or generate new one
      const id = idMap.get(i) || nanoid()
      idMap.set(i, id)

      items.push({ id, content, depth })
    }

    return items
  }

  /**
   * Render OutlineItems back to indented text.
   */
  function renderText(items: OutlineItem[]): string {
    return items
      .map(item => '  '.repeat(item.depth) + item.content)
      .join('\n')
  }

  // ── Debounced sync ─────────────────────────────────────────────────

  /**
   * Schedule a debounced apply from items to the store.
   */
  function debouncedApply(items: OutlineItem[], delay = 300) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      apply(items)
    }, delay)
  }

  function cancelDebounce() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  return {
    render,
    apply,
    parseText,
    renderText,
    debouncedApply,
    cancelDebounce,
  }
}
