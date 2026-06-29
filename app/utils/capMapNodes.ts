/**
 * Hard cap on how many nodes a map loads into the store/canvas.
 *
 * Beyond this, the deeply-reactive store and the per-frame canvas render bog
 * down badly (and very large maps froze the page on open). Rather than risk a
 * lock-up we load a bounded, root-connected subset.
 */
export const MAX_LOADED_NODES = 1000

interface MinNode { id: string }
interface MinEdge { sourceId: string; targetId: string }

function addAdj(adj: Map<string, string[]>, a: string, b: string) {
  const list = adj.get(a)
  if (list) list.push(b)
  else adj.set(a, [b])
}

/**
 * If `nodes` exceeds `max`, keep a connected subset of `max` nodes via BFS from
 * the root (falling back to the first node), then any leftovers to fill the
 * quota for disconnected graphs. Edges with a dropped endpoint are removed so
 * the result is internally consistent.
 *
 * Returns the originals untouched (and `capped: false`) when already within the
 * cap, so it's safe to call unconditionally.
 */
export function capToRootSubset<N extends MinNode, E extends MinEdge>(
  nodes: N[],
  edges: E[],
  rootId: string | null,
  max: number = MAX_LOADED_NODES,
): { nodes: N[]; edges: E[]; capped: boolean } {
  if (nodes.length <= max) return { nodes, edges, capped: false }

  const present = new Set(nodes.map(n => n.id))
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!present.has(e.sourceId) || !present.has(e.targetId)) continue
    addAdj(adj, e.sourceId, e.targetId)
    addAdj(adj, e.targetId, e.sourceId)
  }

  const keep = new Set<string>()
  const start = rootId && present.has(rootId) ? rootId : nodes[0]?.id
  if (start) {
    keep.add(start)
    const queue: string[] = [start]
    while (queue.length && keep.size < max) {
      const cur = queue.shift()!
      for (const nb of adj.get(cur) ?? []) {
        if (keep.size >= max) break
        if (!keep.has(nb)) {
          keep.add(nb)
          queue.push(nb)
        }
      }
    }
  }
  // Disconnected graph: top up to the quota with remaining nodes in order.
  for (const n of nodes) {
    if (keep.size >= max) break
    keep.add(n.id)
  }

  return {
    nodes: nodes.filter(n => keep.has(n.id)),
    edges: edges.filter(e => keep.has(e.sourceId) && keep.has(e.targetId)),
    capped: true,
  }
}
