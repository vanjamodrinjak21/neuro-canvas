import { describe, it, expect } from 'vitest'
import { findNodeAtPosition, pointToLineDistance } from '../useNodeHitTest'
import type { Node } from '~/types/canvas'

function makeNode(id: string, x: number, y: number, w = 120, h = 40): Node {
  return {
    id,
    type: 'text',
    position: { x, y },
    size: { width: w, height: h },
    content: 'Test',
    style: { shape: 'rounded', fillColor: '#111', borderColor: '#222', borderWidth: 1, textColor: '#fff', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as Node
}

describe('findNodeAtPosition', () => {
  it('returns node when point is inside', () => {
    const nodes = new Map([['a', makeNode('a', 100, 100, 120, 40)]])
    const result = findNodeAtPosition({ x: 150, y: 120 }, nodes)
    expect(result?.id).toBe('a')
  })

  it('returns null when point is outside all nodes', () => {
    const nodes = new Map([['a', makeNode('a', 100, 100, 120, 40)]])
    const result = findNodeAtPosition({ x: 0, y: 0 }, nodes)
    expect(result).toBeNull()
  })

  it('returns topmost (last iterated) node on overlap', () => {
    const nodes = new Map([
      ['a', makeNode('a', 100, 100, 120, 40)],
      ['b', makeNode('b', 110, 110, 120, 40)],
    ])
    const result = findNodeAtPosition({ x: 150, y: 120 }, nodes)
    expect(result?.id).toBe('b')
  })
})

describe('pointToLineDistance', () => {
  it('returns 0 for point on the line', () => {
    const d = pointToLineDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 10 })
    expect(d).toBeCloseTo(0, 5)
  })

  it('returns correct perpendicular distance', () => {
    const d = pointToLineDistance({ x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 })
    expect(d).toBeCloseTo(10)
  })

  it('returns distance to nearest endpoint when projection is outside segment', () => {
    const d = pointToLineDistance({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })
    expect(d).toBeCloseTo(5)
  })
})
