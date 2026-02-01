// Link Index System for NeuroCanvas
// Manages forward links (outLinks), backward links (backLinks), and link counts
// Inspired by Obsidian's MetadataCache link system

import type { Edge, LinkIndex } from '~/types/canvas'

// Global link index state
const linkIndex = reactive<LinkIndex>({
  outLinks: new Map(),
  backLinks: new Map(),
  linkCounts: new Map()
})

export function useLinkIndex() {
  /**
   * Rebuild the entire link index from a collection of edges
   * Called when loading a document or after batch operations
   */
  function rebuildIndex(edges: Map<string, Edge>): void {
    // Clear existing index
    linkIndex.outLinks.clear()
    linkIndex.backLinks.clear()
    linkIndex.linkCounts.clear()

    // Rebuild from all edges
    for (const edge of edges.values()) {
      addEdgeToIndex(edge)
    }
  }

  /**
   * Add a single edge to the index
   */
  function addEdgeToIndex(edge: Edge): void {
    const { sourceId, targetId } = edge

    // Initialize sets if needed
    if (!linkIndex.outLinks.has(sourceId)) {
      linkIndex.outLinks.set(sourceId, new Set())
    }
    if (!linkIndex.backLinks.has(targetId)) {
      linkIndex.backLinks.set(targetId, new Set())
    }
    if (!linkIndex.linkCounts.has(sourceId)) {
      linkIndex.linkCounts.set(sourceId, new Map())
    }

    // Add the link
    linkIndex.outLinks.get(sourceId)!.add(targetId)
    linkIndex.backLinks.get(targetId)!.add(sourceId)

    // Update link count
    const counts = linkIndex.linkCounts.get(sourceId)!
    counts.set(targetId, (counts.get(targetId) || 0) + 1)
  }

  /**
   * Remove an edge from the index by looking up its source and target
   */
  function removeEdgeFromIndex(sourceId: string, targetId: string): void {
    // Remove from outLinks
    const outSet = linkIndex.outLinks.get(sourceId)
    if (outSet) {
      outSet.delete(targetId)
      if (outSet.size === 0) {
        linkIndex.outLinks.delete(sourceId)
      }
    }

    // Remove from backLinks
    const backSet = linkIndex.backLinks.get(targetId)
    if (backSet) {
      backSet.delete(sourceId)
      if (backSet.size === 0) {
        linkIndex.backLinks.delete(targetId)
      }
    }

    // Update link count
    const counts = linkIndex.linkCounts.get(sourceId)
    if (counts) {
      const currentCount = counts.get(targetId) || 0
      if (currentCount <= 1) {
        counts.delete(targetId)
        if (counts.size === 0) {
          linkIndex.linkCounts.delete(sourceId)
        }
      } else {
        counts.set(targetId, currentCount - 1)
      }
    }
  }

  /**
   * Event handler: called when an edge is added
   */
  function onEdgeAdded(edge: Edge): void {
    addEdgeToIndex(edge)
  }

  /**
   * Event handler: called when an edge is removed
   * Requires the edge data to properly remove from index
   */
  function onEdgeRemoved(edge: Edge): void {
    removeEdgeFromIndex(edge.sourceId, edge.targetId)
  }

  /**
   * Get all nodes that this node links TO (outgoing links)
   */
  function getOutLinks(nodeId: string): string[] {
    const outSet = linkIndex.outLinks.get(nodeId)
    return outSet ? Array.from(outSet) : []
  }

  /**
   * Get all nodes that link TO this node (backlinks/incoming links)
   */
  function getBackLinks(nodeId: string): string[] {
    const backSet = linkIndex.backLinks.get(nodeId)
    return backSet ? Array.from(backSet) : []
  }

  /**
   * Get nodes that have bidirectional connections with this node
   * (both links to AND is linked from)
   */
  function getMutualLinks(nodeId: string): string[] {
    const outSet = linkIndex.outLinks.get(nodeId) || new Set()
    const backSet = linkIndex.backLinks.get(nodeId) || new Set()

    const mutual: string[] = []
    for (const id of outSet) {
      if (backSet.has(id)) {
        mutual.push(id)
      }
    }
    return mutual
  }

  /**
   * Get the link weight (count) between two nodes
   */
  function getLinkWeight(sourceId: string, targetId: string): number {
    const counts = linkIndex.linkCounts.get(sourceId)
    return counts?.get(targetId) || 0
  }

  /**
   * Get total number of connections for a node (both in and out)
   */
  function getConnectionCount(nodeId: string): number {
    const outCount = linkIndex.outLinks.get(nodeId)?.size || 0
    const backCount = linkIndex.backLinks.get(nodeId)?.size || 0
    return outCount + backCount
  }

  /**
   * Get all nodes connected to a node within a certain depth
   * Used for local graph view
   */
  function getConnectedNodes(nodeId: string, depth: number = 1): Set<string> {
    const connected = new Set<string>()
    const queue: Array<{ id: string; currentDepth: number }> = [{ id: nodeId, currentDepth: 0 }]

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!

      if (connected.has(id)) continue
      connected.add(id)

      if (currentDepth < depth) {
        // Add outgoing connections
        const outLinks = linkIndex.outLinks.get(id)
        if (outLinks) {
          for (const targetId of outLinks) {
            if (!connected.has(targetId)) {
              queue.push({ id: targetId, currentDepth: currentDepth + 1 })
            }
          }
        }

        // Add incoming connections
        const backLinks = linkIndex.backLinks.get(id)
        if (backLinks) {
          for (const sourceId of backLinks) {
            if (!connected.has(sourceId)) {
              queue.push({ id: sourceId, currentDepth: currentDepth + 1 })
            }
          }
        }
      }
    }

    return connected
  }

  /**
   * Check if a node is an orphan (no connections)
   */
  function isOrphan(nodeId: string): boolean {
    return getConnectionCount(nodeId) === 0
  }

  /**
   * Get all orphan nodes from a list of node IDs
   */
  function getOrphanNodes(nodeIds: string[]): string[] {
    return nodeIds.filter(id => isOrphan(id))
  }

  return {
    // State (read-only access)
    index: readonly(linkIndex),

    // Index management
    rebuildIndex,
    onEdgeAdded,
    onEdgeRemoved,

    // Query functions
    getOutLinks,
    getBackLinks,
    getMutualLinks,
    getLinkWeight,
    getConnectionCount,
    getConnectedNodes,
    isOrphan,
    getOrphanNodes
  }
}
