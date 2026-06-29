import { describe, it, expect } from 'vitest'
import { useViewportCulling, computeNodeBounds } from '../useViewportCulling'
import type { Node, Camera } from '~/types/canvas'

// Minimal Node factory — only the fields the spatial index reads.
function mkNode(id: string, x: number, y: number, w = 100, h = 40): Node {
  return {
    id,
    position: { x, y },
    size: { width: w, height: h },
  } as Node
}

// Camera that frames a world-space region around (cx, cy). InfiniteCanvas uses
// worldX = -camera.x / zoom, so to look at (cx, cy) we set camera.x = -cx.
function cameraLookingAt(cx: number, cy: number, zoom = 1): Camera {
  return { x: -cx, y: -cy, zoom } as Camera
}

describe('computeNodeBounds', () => {
  it('returns a rect that fully encloses every node, regardless of magnitude', () => {
    const nodes = new Map<string, Node>([
      ['a', mkNode('a', -135000, -135000)],
      ['b', mkNode('b', 136000, 135000)],
    ])
    const b = computeNodeBounds(nodes)
    expect(b.x).toBeLessThanOrEqual(-135000)
    expect(b.y).toBeLessThanOrEqual(-135000)
    expect(b.x + b.width).toBeGreaterThanOrEqual(136000 + 100)
    expect(b.y + b.height).toBeGreaterThanOrEqual(135000 + 40)
  })

  it('falls back to a sane default for an empty map (no NaN/Infinity)', () => {
    const b = computeNodeBounds(new Map())
    expect(Number.isFinite(b.x)).toBe(true)
    expect(Number.isFinite(b.width)).toBe(true)
    expect(b.width).toBeGreaterThan(0)
    expect(b.height).toBeGreaterThan(0)
  })
})

describe('useViewportCulling — large maps beyond the legacy ±50000 bounds', () => {
  it('indexes and returns a node far outside ±50000 (regression: was silently dropped)', () => {
    const nodes = new Map<string, Node>([
      ['near', mkNode('near', 0, 0)],
      ['far', mkNode('far', 130000, 130000)],
    ])
    const culling = useViewportCulling()
    culling.rebuild(nodes)

    const visibleFar = culling.getVisibleNodeIds(cameraLookingAt(130050, 130020), 1200, 1200, 200)
    expect(visibleFar.has('far')).toBe(true)

    const visibleNear = culling.getVisibleNodeIds(cameraLookingAt(50, 20), 1200, 1200, 200)
    expect(visibleNear.has('near')).toBe(true)
  })

  it('does not return nodes outside the current viewport', () => {
    const nodes = new Map<string, Node>([
      ['near', mkNode('near', 0, 0)],
      ['far', mkNode('far', 130000, 130000)],
    ])
    const culling = useViewportCulling()
    culling.rebuild(nodes)
    const visible = culling.getVisibleNodeIds(cameraLookingAt(50, 20), 1200, 1200, 200)
    expect(visible.has('far')).toBe(false)
  })

  it('getNodeIdsAt returns the node whose box contains a far point', () => {
    const nodes = new Map<string, Node>([['far', mkNode('far', 130000, 130000, 100, 40)]])
    const culling = useViewportCulling()
    culling.rebuild(nodes)
    expect(culling.getNodeIdsAt({ x: 130050, y: 130020 }).has('far')).toBe(true)
    expect(culling.getNodeIdsAt({ x: 0, y: 0 }).has('far')).toBe(false)
  })

  it('survives an empty map without throwing', () => {
    const culling = useViewportCulling()
    culling.rebuild(new Map())
    expect(() => culling.getVisibleNodeIds(cameraLookingAt(0, 0), 1000, 1000)).not.toThrow()
  })
})
