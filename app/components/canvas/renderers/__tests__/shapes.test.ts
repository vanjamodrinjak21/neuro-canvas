import { describe, it, expect, beforeAll } from 'vitest'
import { getShapePath } from '../shapes'
import type { NodeShape } from '~/types/canvas'

// Path2D is a Canvas 2D API not available in happy-dom — polyfill for unit tests
beforeAll(() => {
  if (typeof globalThis.Path2D === 'undefined') {
    class Path2DPolyfill {
      arc() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
      roundRect() {}
    }
    // @ts-expect-error polyfill for test environment
    globalThis.Path2D = Path2DPolyfill
  }
})

const ALL_SHAPES: NodeShape[] = [
  'rounded', 'rectangle', 'circle', 'diamond', 'hexagon', 'star', 'pill', 'dot'
]

describe('getShapePath', () => {
  for (const shape of ALL_SHAPES) {
    it(`returns a Path2D for "${shape}"`, () => {
      const path = getShapePath(shape, 100, 100, 160, 60)
      expect(path).toBeInstanceOf(Path2D)
    })
  }

  it('handles zero-size gracefully', () => {
    expect(() => getShapePath('rounded', 0, 0, 0, 0)).not.toThrow()
  })

  it('handles negative coordinates', () => {
    expect(() => getShapePath('circle', -100, -200, 50, 50)).not.toThrow()
  })

  it('dot shape produces a path regardless of size', () => {
    const path = getShapePath('dot', 50, 50, 12, 12)
    expect(path).toBeInstanceOf(Path2D)
  })

  it('defaults to rounded for unknown shapes', () => {
    const path = getShapePath('nonexistent' as NodeShape, 0, 0, 100, 50)
    expect(path).toBeInstanceOf(Path2D)
  })
})
