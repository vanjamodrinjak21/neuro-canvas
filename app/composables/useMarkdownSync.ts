import { useMapStore } from '~/stores/mapStore'
import type { Node } from '~/types/canvas'

/**
 * Bidirectional sync between a heading-based markdown string and the
 * mapStore node/edge graph.
 *
 * - toMarkdown()       — walks the node tree depth-first, emits ATX headings
 * - fromMarkdown(md)   — parses headings back into the node tree, then calls
 *                        layoutNodes() to position everything radially
 */
export function useMarkdownSync() {
  const mapStore = useMapStore()

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Build a Map<nodeId, primaryParentId> by looking at which node has an
   * incoming edge whose source is the first parent found (lowest BFS depth).
   * "Primary parent" is determined by the source of the first edge pointing
   * at the node when walking from rootNodeId.
   */
  function buildPrimaryParentMap(): Map<string, string> {
    const primaryParent = new Map<string, string>()
    const edges = mapStore.edges
    const rootNodeId = mapStore.rootNodeId

    if (!rootNodeId) return primaryParent

    // Build adjacency list (parent → children)
    const childrenOf = new Map<string, string[]>()
    for (const edge of edges.values()) {
      const list = childrenOf.get(edge.sourceId) ?? []
      list.push(edge.targetId)
      childrenOf.set(edge.sourceId, list)
    }

    // BFS from root to assign primary parent (first visit wins)
    const queue: string[] = [rootNodeId]
    const visited = new Set<string>([rootNodeId])

    while (queue.length > 0) {
      const current = queue.shift()!
      const children = childrenOf.get(current) ?? []
      for (const childId of children) {
        if (!visited.has(childId)) {
          visited.add(childId)
          primaryParent.set(childId, current)
          queue.push(childId)
        }
      }
    }

    return primaryParent
  }

  // ── toMarkdown ───────────────────────────────────────────────────────

  /**
   * Walk the node tree depth-first from rootNodeId and produce a markdown
   * string where heading level corresponds to tree depth.
   *
   * - depth 0 → `# Root`
   * - depth 1 → `## Child`
   * - depth 2 → `### Grandchild`
   * - description text (node.metadata?.description?.summary) on next line
   * - `[[Node Name]]` wikilinks for cross-connections (edges where the
   *   target's primary parent differs from the current node being visited)
   * - Orphan nodes appended after a `---` separator
   */
  function toMarkdown(): string {
    const nodes = mapStore.nodes
    const edges = mapStore.edges
    const rootNodeId = mapStore.rootNodeId

    const lines: string[] = []

    // Build adjacency list (parent → children)
    const childrenOf = new Map<string, string[]>()
    for (const edge of edges.values()) {
      const list = childrenOf.get(edge.sourceId) ?? []
      list.push(edge.targetId)
      childrenOf.set(edge.sourceId, list)
    }

    const primaryParent = buildPrimaryParentMap()
    const visited = new Set<string>()

    function walk(nodeId: string, depth: number) {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const node = nodes.get(nodeId)
      if (!node) return

      // Heading: clamp at h6 (depth 5+)
      const level = Math.min(depth + 1, 6)
      const hashes = '#'.repeat(level)
      lines.push(`${hashes} ${node.content}`)

      // Optional description summary
      const summary = (node.metadata?.description as { summary?: string } | undefined)?.summary
      if (summary) {
        lines.push('')
        lines.push(summary)
      }

      // Cross-connection wikilinks: edges from this node whose target's
      // primary parent is NOT this node (i.e. true cross-links, not tree edges)
      const crossLinks: string[] = []
      const children = childrenOf.get(nodeId) ?? []

      for (const childId of children) {
        const parent = primaryParent.get(childId)
        if (parent !== nodeId) {
          const targetNode = nodes.get(childId)
          if (targetNode) {
            crossLinks.push(`[[${targetNode.content}]]`)
          }
        }
      }

      if (crossLinks.length > 0) {
        lines.push('')
        lines.push(crossLinks.join(' '))
      }

      lines.push('')

      // Recurse into tree children only (primary parent === this node)
      for (const childId of children) {
        const parent = primaryParent.get(childId)
        if (parent === nodeId) {
          walk(childId, depth + 1)
        }
      }
    }

    // Walk from root
    if (rootNodeId && nodes.has(rootNodeId)) {
      walk(rootNodeId, 0)
    }

    // Orphan nodes after separator
    const orphans: Node[] = []
    for (const node of nodes.values()) {
      if (!visited.has(node.id)) {
        orphans.push(node)
      }
    }

    if (orphans.length > 0) {
      lines.push('---')
      lines.push('')
      for (const orphan of orphans) {
        lines.push(`## ${orphan.content}`)
        const summary = (orphan.metadata?.description as { summary?: string } | undefined)?.summary
        if (summary) {
          lines.push('')
          lines.push(summary)
        }
        lines.push('')
      }
    }

    return lines.join('\n').trimEnd() + '\n'
  }

  // ── fromMarkdown ─────────────────────────────────────────────────────

  /**
   * Parsed representation of one heading block.
   */
  interface ParsedBlock {
    depth: number       // 0-based (h1=0, h2=1, …)
    content: string     // heading text (trimmed)
    summary: string     // body text under the heading (joined)
    wikilinks: string[] // [[target content]] cross-links
  }

  /** Parse a markdown string into ParsedBlock[]. Stops at `---`. */
  function parseMarkdown(markdown: string): ParsedBlock[] {
    const blocks: ParsedBlock[] = []
    const lines = markdown.split('\n')

    let current: ParsedBlock | null = null
    const bodyLines: string[] = []

    function flushBlock() {
      if (!current) return
      current.summary = bodyLines
        .filter(l => !l.match(/^\[\[.*\]\]/))
        .join('\n')
        .trim()
      // Collect wikilinks from body
      for (const bl of bodyLines) {
        const matches = bl.matchAll(/\[\[([^\]]+)\]\]/g)
        for (const m of matches) {
          if (m[1]) current.wikilinks.push(m[1].trim())
        }
      }
      blocks.push(current)
      bodyLines.length = 0
    }

    for (const line of lines) {
      // Stop at orphan separator
      if (line.trim() === '---') break

      const headingMatch = line.match(/^(#{1,6}) (.+)$/)
      if (headingMatch) {
        flushBlock()
        current = {
          depth: headingMatch[1]!.length - 1,
          content: headingMatch[2]!.trim(),
          summary: '',
          wikilinks: [],
        }
      } else if (current !== null) {
        bodyLines.push(line)
      }
    }

    flushBlock()
    return blocks
  }

  /**
   * Parse markdown back into mapStore.
   * - Heading levels determine depth → parent/child edges
   * - Body text → node.metadata.description.summary
   * - `[[links]]` → cross-connection edges
   * - Reuses existing nodes by case-insensitive content match
   * - Removes nodes no longer in markdown
   * - All mutations are wrapped in mapStore.batchUpdate()
   * - Calls layoutNodes() after sync
   */
  function fromMarkdown(markdown: string): void {
    const blocks = parseMarkdown(markdown)
    if (blocks.length === 0) return

    mapStore.batchUpdate('Sync from markdown', () => {
      const existingNodes = mapStore.nodes

      // Build lookup: lowercase content → existing node id
      const contentToId = new Map<string, string>()
      for (const node of existingNodes.values()) {
        contentToId.set(node.content.toLowerCase(), node.id)
      }

      // ── Phase 1: Determine node IDs for each block ──────────────────

      interface BlockWithId extends ParsedBlock {
        nodeId: string
        isNew: boolean
      }

      const blocksWithIds: BlockWithId[] = blocks.map(block => {
        const key = block.content.toLowerCase()
        const existingId = contentToId.get(key)
        if (existingId) {
          return { ...block, nodeId: existingId, isNew: false }
        }
        const { nanoid } = { nanoid: () => Math.random().toString(36).slice(2, 11) }
        return { ...block, nodeId: nanoid(), isNew: true }
      })

      const incomingNodeIds = new Set(blocksWithIds.map(b => b.nodeId))

      // ── Phase 2: Delete nodes no longer in markdown ─────────────────

      for (const nodeId of existingNodes.keys()) {
        if (!incomingNodeIds.has(nodeId)) {
          mapStore.deleteNode(nodeId)
        }
      }

      // ── Phase 3: Create / update nodes ─────────────────────────────

      const depthStack: string[] = [] // depthStack[d] = nodeId at depth d

      for (const block of blocksWithIds) {
        const { nodeId, isNew, content, summary, depth } = block

        if (isNew) {
          mapStore.addNode({
            id: nodeId,
            content,
            position: { x: 0, y: 0 },
            isRoot: depth === 0,
            metadata: summary
              ? { description: { summary, generatedAt: Date.now() } }
              : {},
          })
        } else {
          const existing = mapStore.nodes.get(nodeId)
          if (!existing) continue

          const updates: Partial<Node> = {}

          if (existing.content !== content) {
            updates.content = content
          }

          const existingSummary = (existing.metadata?.description as { summary?: string } | undefined)?.summary ?? ''
          if (summary !== existingSummary) {
            updates.metadata = {
              ...(existing.metadata ?? {}),
              description: {
                ...((existing.metadata?.description as unknown as Record<string, unknown>) ?? {}),
                summary,
                generatedAt: Date.now(),
              },
            }
          }

          if (Object.keys(updates).length > 0) {
            mapStore.updateNode(nodeId, updates)
          }

          // Ensure root flag
          if (depth === 0 && !existing.isRoot) {
            mapStore.updateNode(nodeId, { isRoot: true })
          }
        }

        depthStack[depth] = nodeId
      }

      // ── Phase 4: Rebuild tree edges ─────────────────────────────────

      // Determine needed tree edges (parent → child based on heading depth)
      const neededTreeEdges = new Set<string>() // "sourceId→targetId"

      for (const block of blocksWithIds) {
        if (block.depth > 0) {
          const parentId = depthStack[block.depth - 1]
          if (parentId) {
            neededTreeEdges.add(`${parentId}→${block.nodeId}`)
          }
        }
      }

      // ── Phase 5: Build cross-connection edges from wikilinks ────────

      const neededCrossEdges = new Set<string>()

      // Build a fresh content→id map after all node mutations
      const freshContentToId = new Map<string, string>()
      for (const node of mapStore.nodes.values()) {
        freshContentToId.set(node.content.toLowerCase(), node.id)
      }

      for (const block of blocksWithIds) {
        for (const linkContent of block.wikilinks) {
          const targetId = freshContentToId.get(linkContent.toLowerCase())
          if (targetId && targetId !== block.nodeId) {
            neededCrossEdges.add(`${block.nodeId}→${targetId}`)
          }
        }
      }

      const allNeededEdges = new Set([...neededTreeEdges, ...neededCrossEdges])

      // Index existing edges
      const existingEdgeKeys = new Map<string, string>() // "src→tgt" → edgeId
      for (const edge of mapStore.edges.values()) {
        existingEdgeKeys.set(`${edge.sourceId}→${edge.targetId}`, edge.id)
      }

      // Add missing edges
      for (const key of allNeededEdges) {
        if (!existingEdgeKeys.has(key)) {
          const [sourceId, targetId] = key.split('→')
          if (sourceId && targetId) {
            mapStore.addEdge(sourceId, targetId)
          }
        }
      }

      // Remove edges that no longer exist in the markdown
      for (const [key, edgeId] of existingEdgeKeys) {
        if (!allNeededEdges.has(key)) {
          mapStore.deleteEdge(edgeId)
        }
      }

      // ── Phase 6: Ensure root is set ────────────────────────────────

      const rootBlock = blocksWithIds.find(b => b.depth === 0)
      if (rootBlock && mapStore.rootNodeId !== rootBlock.nodeId) {
        const oldRootId = mapStore.rootNodeId
        if (oldRootId) {
          mapStore.updateNode(oldRootId, { isRoot: false })
        }
        mapStore.updateNode(rootBlock.nodeId, { isRoot: true })
      }
    })

    // Position nodes radially after the full sync
    layoutNodes()
  }

  // ── layoutNodes ───────────────────────────────────────────────────────

  /**
   * Position nodes radially from the root.
   * - Root sits at (0, 0)
   * - Each depth ring is spaced RING_GAP px apart
   * - Children are distributed evenly on each ring
   */
  function layoutNodes(): void {
    const nodes = mapStore.nodes
    const edges = mapStore.edges
    const rootNodeId = mapStore.rootNodeId

    if (nodes.size === 0) return

    const RING_GAP = 240    // px between depth rings
    const MIN_ARC_GAP = 160 // minimum arc distance between siblings

    // Build adjacency list
    const childrenOf = new Map<string, string[]>()
    for (const edge of edges.values()) {
      const list = childrenOf.get(edge.sourceId) ?? []
      list.push(edge.targetId)
      childrenOf.set(edge.sourceId, list)
    }

    const positions = new Map<string, { x: number; y: number }>()
    const visited = new Set<string>()

    /**
     * Recursively assign positions.
     * @param nodeId   current node
     * @param cx       center x of the subtree fan
     * @param cy       center y of the subtree fan
     * @param startAngle  start of the angular slice (radians)
     * @param endAngle    end of the angular slice (radians)
     * @param depth    current depth from root
     */
    function assignPositions(
      nodeId: string,
      cx: number,
      cy: number,
      startAngle: number,
      endAngle: number,
      depth: number
    ): void {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const midAngle = (startAngle + endAngle) / 2
      const radius = depth * RING_GAP

      const x = cx + Math.cos(midAngle) * radius
      const y = cy + Math.sin(midAngle) * radius
      positions.set(nodeId, { x: Math.round(x), y: Math.round(y) })

      const children = (childrenOf.get(nodeId) ?? []).filter(id => !visited.has(id))
      if (children.length === 0) return

      const arc = endAngle - startAngle
      // Ensure at least MIN_ARC_GAP per child at the next ring
      const nextRadius = (depth + 1) * RING_GAP
      const minArcNeeded = children.length * (MIN_ARC_GAP / nextRadius)
      const usedArc = Math.max(arc, minArcNeeded)
      const sliceSize = usedArc / children.length
      const sliceStart = midAngle - usedArc / 2

      children.forEach((childId, i) => {
        assignPositions(
          childId,
          cx, cy,
          sliceStart + i * sliceSize,
          sliceStart + (i + 1) * sliceSize,
          depth + 1
        )
      })
    }

    // Root at origin, full circle
    const startId = rootNodeId ?? nodes.keys().next().value
    if (!startId) return

    assignPositions(startId, 0, 0, -Math.PI, Math.PI, 0)

    // Handle disconnected nodes (orphans not reached from root)
    let orphanX = 0
    const orphanY = (nodes.size + 1) * RING_GAP
    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        positions.set(nodeId, { x: orphanX, y: orphanY })
        orphanX += 200
      }
    }

    // Apply positions
    for (const [nodeId, pos] of positions) {
      mapStore.moveNode(nodeId, pos.x, pos.y)
    }
  }

  return {
    toMarkdown,
    fromMarkdown,
    layoutNodes,
  }
}
