import { describe, it, expect } from 'vitest'
import { capToRootSubset, MAX_LOADED_NODES } from '../capMapNodes'

type N = { id: string }
type E = { id: string; sourceId: string; targetId: string }

// Build a chain root -> n1 -> n2 -> ... of `count` nodes.
function chain(count: number): { nodes: N[]; edges: E[] } {
  const nodes: N[] = []
  const edges: E[] = []
  for (let i = 0; i < count; i++) {
    const id = i === 0 ? 'root' : `n${i}`
    nodes.push({ id })
    if (i > 0) edges.push({ id: `e${i}`, sourceId: i === 1 ? 'root' : `n${i - 1}`, targetId: id })
  }
  return { nodes, edges }
}

describe('capToRootSubset', () => {
  it('returns originals untouched when within the cap', () => {
    const { nodes, edges } = chain(10)
    const r = capToRootSubset(nodes, edges, 'root', MAX_LOADED_NODES)
    expect(r.capped).toBe(false)
    expect(r.nodes).toBe(nodes)
    expect(r.edges).toBe(edges)
  })

  it('caps to exactly `max` nodes, keeping the root', () => {
    const { nodes, edges } = chain(5000)
    const r = capToRootSubset(nodes, edges, 'root', 1000)
    expect(r.capped).toBe(true)
    expect(r.nodes).toHaveLength(1000)
    expect(r.nodes.some(n => n.id === 'root')).toBe(true)
  })

  it('drops edges whose endpoints were pruned (no dangling edges)', () => {
    const { nodes, edges } = chain(5000)
    const r = capToRootSubset(nodes, edges, 'root', 1000)
    const kept = new Set(r.nodes.map(n => n.id))
    for (const e of r.edges) {
      expect(kept.has(e.sourceId)).toBe(true)
      expect(kept.has(e.targetId)).toBe(true)
    }
  })

  it('still fills the quota for a disconnected graph (no edges)', () => {
    const nodes: N[] = Array.from({ length: 3000 }, (_, i) => ({ id: `x${i}` }))
    const r = capToRootSubset(nodes, [], null, 1000)
    expect(r.capped).toBe(true)
    expect(r.nodes).toHaveLength(1000)
    expect(r.edges).toHaveLength(0)
  })
})
