import { describe, it, expect } from 'vitest'
import {
  computeContentBounds,
  computeExportFit,
  computePdfPageLayout,
  EXPORT_PADDING,
  EXPORT_MAX_PIXELS,
  EXPORT_MAX_SIDE,
  PDF_PAGE_SHORT_PT,
  PDF_PAGE_LONG_PT,
  PDF_MARGIN_PT,
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

// ---------------------------------------------------------------------------
// computePdfPageLayout (print PDF export, AER-76)
// ---------------------------------------------------------------------------

describe('computePdfPageLayout', () => {
  const availShort = PDF_PAGE_SHORT_PT - PDF_MARGIN_PT * 2
  const availLong = PDF_PAGE_LONG_PT - PDF_MARGIN_PT * 2

  it('single node (wider than tall) → landscape A4, upscaled to fill the width', () => {
    // 200×80 node at (100,100); padded 296×176 → wider than tall.
    const bounds: ContentBounds = { minX: 100, minY: 100, maxX: 300, maxY: 180 }
    const layout = computePdfPageLayout(bounds)

    expect(layout.orientation).toBe('landscape')
    expect(layout.pageWidthPt).toBe(PDF_PAGE_LONG_PT)
    expect(layout.pageHeightPt).toBe(PDF_PAGE_SHORT_PT)
    expect(layout.contentWidthPx).toBe(200 + EXPORT_PADDING * 2)
    expect(layout.contentHeightPx).toBe(80 + EXPORT_PADDING * 2)

    // Width is the binding axis: it uses the full margin box; vector output
    // upscales losslessly, so small maps grow to a readable print size.
    expect(layout.scale).toBeCloseTo(availLong / 296, 10)
    expect(layout.scale).toBeGreaterThan(1)
    expect(layout.placedWidthPt).toBeCloseTo(availLong, 10)
    expect(layout.offsetXPt).toBeCloseTo(PDF_MARGIN_PT, 10)

    // Height has slack → vertically centered inside the margin box.
    expect(layout.placedHeightPt).toBeLessThan(availShort)
    expect(layout.offsetYPt).toBeCloseTo(
      PDF_MARGIN_PT + (availShort - layout.placedHeightPt) / 2, 10,
    )
  })

  it('wide map → landscape, fully contained, width-bound, centered vertically', () => {
    const bounds: ContentBounds = { minX: -500, minY: 0, maxX: 1500, maxY: 500 }
    const layout = computePdfPageLayout(bounds) // padded 2096×596

    expect(layout.orientation).toBe('landscape')
    expect(layout.scale).toBeCloseTo(availLong / 2096, 10)

    // The whole padded map fits inside the margins on BOTH axes.
    expect(layout.placedWidthPt).toBeLessThanOrEqual(availLong + 1e-9)
    expect(layout.placedHeightPt).toBeLessThanOrEqual(availShort + 1e-9)

    // Symmetric margins: left offset == margin (binding axis), and the
    // placed rect is centered: page mid == placed mid.
    expect(layout.offsetXPt).toBeCloseTo(PDF_MARGIN_PT, 10)
    expect(layout.offsetXPt + layout.placedWidthPt / 2).toBeCloseTo(layout.pageWidthPt / 2, 10)
    expect(layout.offsetYPt + layout.placedHeightPt / 2).toBeCloseTo(layout.pageHeightPt / 2, 10)
  })

  it('tall map → portrait, height-bound, centered horizontally', () => {
    const bounds: ContentBounds = { minX: 0, minY: -800, maxX: 500, maxY: 1200 }
    const layout = computePdfPageLayout(bounds) // padded 596×2096

    expect(layout.orientation).toBe('portrait')
    expect(layout.pageWidthPt).toBe(PDF_PAGE_SHORT_PT)
    expect(layout.pageHeightPt).toBe(PDF_PAGE_LONG_PT)
    expect(layout.scale).toBeCloseTo(availLong / 2096, 10)

    expect(layout.offsetYPt).toBeCloseTo(PDF_MARGIN_PT, 10)
    expect(layout.placedWidthPt).toBeLessThan(availShort)
    expect(layout.offsetXPt).toBeCloseTo(
      PDF_MARGIN_PT + (availShort - layout.placedWidthPt) / 2, 10,
    )
  })

  it('square content ties break to portrait', () => {
    const layout = computePdfPageLayout({ minX: 0, minY: 0, maxX: 400, maxY: 400 })
    expect(layout.orientation).toBe('portrait')
  })

  it('never crops: placed rect always inside the margin box, for any aspect', () => {
    const cases: ContentBounds[] = [
      { minX: 0, minY: 0, maxX: 40_000, maxY: 200 },   // extremely wide
      { minX: 0, minY: 0, maxX: 200, maxY: 40_000 },   // extremely tall
      { minX: -3, minY: -3, maxX: 3, maxY: 3 },        // tiny
      { minX: 0, minY: 0, maxX: 12_000, maxY: 9_000 }, // huge
    ]
    for (const bounds of cases) {
      const layout = computePdfPageLayout(bounds)
      expect(layout.scale).toBeGreaterThan(0)
      expect(Number.isFinite(layout.scale)).toBe(true)
      expect(layout.offsetXPt).toBeGreaterThanOrEqual(layout.marginPt - 1e-9)
      expect(layout.offsetYPt).toBeGreaterThanOrEqual(layout.marginPt - 1e-9)
      expect(layout.offsetXPt + layout.placedWidthPt)
        .toBeLessThanOrEqual(layout.pageWidthPt - layout.marginPt + 1e-9)
      expect(layout.offsetYPt + layout.placedHeightPt)
        .toBeLessThanOrEqual(layout.pageHeightPt - layout.marginPt + 1e-9)
    }
  })

  it('degenerate zero-area bounds still produce a valid page (padding saves it)', () => {
    const layout = computePdfPageLayout({ minX: 10, minY: 10, maxX: 10, maxY: 10 })
    expect(layout.orientation).toBe('portrait') // padded square
    expect(layout.contentWidthPx).toBe(EXPORT_PADDING * 2)
    expect(Number.isFinite(layout.scale)).toBe(true)
    expect(layout.scale).toBeGreaterThan(0)
  })

  it('honours custom padding, margin and page size options', () => {
    const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 }
    const layout = computePdfPageLayout(bounds, {
      padding: 0,
      marginPt: 10,
      pageShortPt: 400,
      pageLongPt: 800,
    })
    expect(layout.orientation).toBe('landscape')
    expect(layout.pageWidthPt).toBe(800)
    expect(layout.pageHeightPt).toBe(400)
    expect(layout.marginPt).toBe(10)
    expect(layout.contentWidthPx).toBe(100)
    // avail 780×380 for 100×50 → min(780/100, 380/50) = 7.6 → height binds.
    expect(layout.scale).toBeCloseTo(7.6, 10)
    expect(layout.offsetYPt).toBeCloseTo(10, 10)
    expect(layout.offsetXPt).toBeCloseTo(10 + (780 - 760) / 2, 10)
  })
})
