import { describe, it, expect } from 'vitest'
import {
  computeContentBounds,
  computeExportFit,
  EXPORT_PADDING,
  EXPORT_MAX_PIXELS,
  EXPORT_MAX_SIDE,
  type ContentBounds,
} from '../exportFit'
import type { Node, Edge } from '~/types/canvas'

function makeNode(id: string, x: number, y: number, w = 100, h = 40): Node {
  return {
    id, type: 'text', position: { x, y }, size: { width: w, height: h },
    content: 'n', style: {
      shape: 'rounded', fillColor: '#111', borderColor: '#222', borderWidth: 1,
      textColor: '#fff', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false,
    }, createdAt: 0, updatedAt: 0,
  } as Node
}

function makeEdge(
  id: string,
  sourceId: string,
  targetId: string,
  overrides: Partial<Edge> = {},
): Edge {
  return {
    id, sourceId, targetId,
    style: { type: 'bezier', arrowStart: 'none', arrowEnd: 'arrow', animated: false },
    createdAt: 0, updatedAt: 0,
    ...overrides,
  } as Edge
}

function nodeMap(...nodes: Node[]): Map<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]))
}

// ---------------------------------------------------------------------------
// computeContentBounds
// ---------------------------------------------------------------------------

describe('computeContentBounds', () => {
  it('returns null for an empty map', () => {
    expect(computeContentBounds(new Map(), [])).toBeNull()
  })

  it('single node → exactly the node rectangle', () => {
    const nodes = nodeMap(makeNode('a', 120, -30, 200, 64))
    expect(computeContentBounds(nodes, [])).toEqual({
      minX: 120, minY: -30, maxX: 320, maxY: 34,
    })
  })

  it('spread map (including negative coordinates) covers every node rect', () => {
    const nodes = nodeMap(
      makeNode('a', -1000, -500, 150, 50),
      makeNode('b', 0, 0),
      makeNode('c', 2000, 1500, 220, 80),
    )
    expect(computeContentBounds(nodes, [])).toEqual({
      minX: -1000, minY: -500, maxX: 2220, maxY: 1580,
    })
  })

  it('bezier control points anchored away from the map extend the bounds', () => {
    // Two nodes side by side; the edge is explicitly snapped to the OUTER
    // sides, so its control handles stick out 80px beyond each node.
    const a = makeNode('a', 0, 0)     // left side at x=0
    const b = makeNode('b', 400, 0)   // right side at x=500
    const nodes = nodeMap(a, b)
    const edge = makeEdge('e', 'a', 'b', { sourceAnchor: 'left', targetAnchor: 'right' })

    const bounds = computeContentBounds(nodes, [edge])
    expect(bounds).not.toBeNull()
    expect(bounds!.minX).toBe(-80) // control handle left of node a
    expect(bounds!.maxX).toBe(580) // control handle right of node b
  })

  it('includes custom edge control points', () => {
    const nodes = nodeMap(makeNode('a', 0, 0), makeNode('b', 300, 0))
    const edge = makeEdge('e', 'a', 'b', { controlPoints: [{ x: 150, y: -400 }] })
    const bounds = computeContentBounds(nodes, [edge])
    expect(bounds!.minY).toBe(-400)
  })

  it('ignores edges whose endpoints are missing from the node map', () => {
    const nodes = nodeMap(makeNode('a', 0, 0))
    const edge = makeEdge('e', 'a', 'ghost')
    expect(computeContentBounds(nodes, [edge])).toEqual({
      minX: 0, minY: 0, maxX: 100, maxY: 40,
    })
  })
})

// ---------------------------------------------------------------------------
// computeExportFit
// ---------------------------------------------------------------------------

/** Map a content point through the fit transform. */
function project(fit: ReturnType<typeof computeExportFit>, x: number, y: number) {
  return { x: x * fit.scale + fit.translateX, y: y * fit.scale + fit.translateY }
}

describe('computeExportFit', () => {
  it('single node: 2x supersample with 48px padding on every side', () => {
    const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 100, maxY: 40 }
    const fit = computeExportFit(bounds)

    expect(fit.scale).toBe(2)
    expect(fit.width).toBe((100 + EXPORT_PADDING * 2) * 2)  // 392
    expect(fit.height).toBe((40 + EXPORT_PADDING * 2) * 2)  // 272

    // Content corners land inside the canvas, inset by scaled padding.
    expect(project(fit, 0, 0)).toEqual({ x: 96, y: 96 })
    expect(project(fit, 100, 40)).toEqual({ x: fit.width - 96, y: fit.height - 96 })
  })

  it('spread map with negative origin: nothing is clipped on any side', () => {
    const bounds: ContentBounds = { minX: -1000, minY: -500, maxX: 2220, maxY: 1580 }
    const fit = computeExportFit(bounds)

    const topLeft = project(fit, bounds.minX, bounds.minY)
    const bottomRight = project(fit, bounds.maxX, bounds.maxY)
    expect(topLeft.x).toBeGreaterThan(0)
    expect(topLeft.y).toBeGreaterThan(0)
    expect(bottomRight.x).toBeLessThanOrEqual(fit.width)
    expect(bottomRight.y).toBeLessThanOrEqual(fit.height)
  })

  it('devicePixelRatio raises sharpness but is clamped to 2x', () => {
    const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    expect(computeExportFit(bounds, { devicePixelRatio: 2 }).scale).toBe(4)
    expect(computeExportFit(bounds, { devicePixelRatio: 3 }).scale).toBe(4)
    expect(computeExportFit(bounds, { devicePixelRatio: 0.5 }).scale).toBe(2)
  })

  it('huge map hits the pixel cap: scales down gracefully, never crops', () => {
    const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 40_000, maxY: 40_000 }
    const fit = computeExportFit(bounds)

    // Budget respected, but nearly fully used (no needless quality loss).
    expect(fit.width * fit.height).toBeLessThanOrEqual(EXPORT_MAX_PIXELS)
    expect(fit.width * fit.height).toBeGreaterThan(EXPORT_MAX_PIXELS * 0.98)
    expect(fit.scale).toBeLessThan(2)

    // The full padded content still fits inside the canvas.
    const bottomRight = project(fit, bounds.maxX + EXPORT_PADDING, bounds.maxY + EXPORT_PADDING)
    expect(bottomRight.x).toBeGreaterThanOrEqual(fit.width)  // canvas edge == padded edge
    expect(bottomRight.x).toBeLessThanOrEqual(fit.width + 1) // (floor slack ≤ 1px)
    expect(project(fit, bounds.minX - EXPORT_PADDING, 0).x).toBeCloseTo(0)
  })

  it('extreme aspect ratio hits the per-side cap instead of the area cap', () => {
    const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 200_000, maxY: 10 }
    const fit = computeExportFit(bounds)

    expect(fit.width).toBeLessThanOrEqual(EXPORT_MAX_SIDE)
    expect(fit.width).toBeGreaterThan(EXPORT_MAX_SIDE - 3)
    expect(fit.height).toBeGreaterThanOrEqual(1)
  })

  it('degenerate zero-area bounds still produce a valid canvas', () => {
    const fit = computeExportFit({ minX: 10, minY: 10, maxX: 10, maxY: 10 })
    expect(fit.width).toBe(EXPORT_PADDING * 2 * 2)
    expect(fit.height).toBe(EXPORT_PADDING * 2 * 2)
  })

  it('pathologically vast bounds never produce a zero-sized canvas', () => {
    const fit = computeExportFit({ minX: 0, minY: 0, maxX: 1e9, maxY: 1e9 })
    expect(fit.width).toBeGreaterThanOrEqual(1)
    expect(fit.height).toBeGreaterThanOrEqual(1)
    expect(fit.scale).toBeGreaterThan(0)
  })

  it('honours custom padding and supersample options', () => {
    const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    const fit = computeExportFit(bounds, { padding: 10, supersample: 3 })
    expect(fit.scale).toBe(3)
    expect(fit.width).toBe((100 + 20) * 3)
    expect(project(fit, 0, 0)).toEqual({ x: 30, y: 30 })
  })
})
