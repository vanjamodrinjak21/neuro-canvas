import { describe, it, expect } from 'vitest'
import { resolveEdgeEndpoints, calculateBezierControlPoints } from '../shared'
import type { Node } from '~/types/canvas'

function makeNode(x: number, y: number, w = 100, h = 40): Node {
  return {
    id: `${x},${y}`, type: 'text', position: { x, y }, size: { width: w, height: h },
    content: 'n', style: {
      shape: 'rounded', fillColor: '#111', borderColor: '#222', borderWidth: 1,
      textColor: '#fff', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false,
    }, createdAt: 0, updatedAt: 0,
  } as Node
}

describe('resolveEdgeEndpoints — nearest side connecting', () => {
  it('picks right→left side centers when the target is to the right', () => {
    const a = makeNode(0, 0)      // center (50,20)
    const b = makeNode(300, 0)    // center (350,20) — horizontally apart
    const r = resolveEdgeEndpoints(a, b)
    expect(r.sourceAnchor).toBe('right')
    expect(r.targetAnchor).toBe('left')
    expect(r.sourcePoint).toEqual({ x: 100, y: 20 }) // right-center of A
    expect(r.targetPoint).toEqual({ x: 300, y: 20 }) // left-center of B
  })

  it('picks bottom→top side centers when the target is below', () => {
    const a = makeNode(0, 0)      // center (50,20)
    const b = makeNode(0, 300)    // center (50,320) — vertically apart
    const r = resolveEdgeEndpoints(a, b)
    expect(r.sourceAnchor).toBe('bottom')
    expect(r.targetAnchor).toBe('top')
    expect(r.sourcePoint).toEqual({ x: 50, y: 40 })  // bottom-center of A
    expect(r.targetPoint).toEqual({ x: 50, y: 300 }) // top-center of B
  })

  it('honours an explicit (user-snapped) anchor instead of the nearest side', () => {
    const a = makeNode(0, 0)
    const b = makeNode(300, 0)
    const r = resolveEdgeEndpoints(a, b, 'top', null)
    expect(r.sourceAnchor).toBe('top')
    expect(r.sourcePoint).toEqual({ x: 50, y: 0 }) // top-center of A
    expect(r.targetAnchor).toBe('left')           // target still nearest-side
  })

  it('orients curve handles perpendicular to the side (vertical handle for top/bottom)', () => {
    const source = { x: 50, y: 40 }
    const target = { x: 50, y: 300 }
    const { cx1, cy1 } = calculateBezierControlPoints(source, target, 'bottom', 'top')
    // Bottom side → handle must leave vertically (x stays on source.x, y moves down)
    expect(cx1).toBe(source.x)
    expect(cy1).toBeGreaterThan(source.y)
  })
})
