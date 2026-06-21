import { describe, it, expect } from 'vitest'
import {
  computeResizedRect,
  hitTestResizeHandle,
  getHandlePoints,
  getHandleCursor,
  RESIZE_HANDLES,
  type Rect,
} from '../resizeHandles'
import type { Node } from '~/types/canvas'

// A 200×100 node at (100, 100) → aspect ratio 2:1.
const ORIGINAL: Rect = { x: 100, y: 100, width: 200, height: 100 }
const OPTS = { proportional: false, minWidth: 50, minHeight: 30 }
const OPTS_PROP = { ...OPTS, proportional: true }

function makeNode(rect: Rect): Node {
  return {
    id: 'n1',
    type: 'text',
    position: { x: rect.x, y: rect.y },
    size: { width: rect.width, height: rect.height },
    content: 'x',
    style: {} as Node['style'],
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('computeResizedRect — free (non-proportional)', () => {
  it('grows from the SE corner, anchoring the top-left', () => {
    const r = computeResizedRect('se', ORIGINAL, { x: 400, y: 350 }, OPTS)
    expect(r).toEqual({ x: 100, y: 100, width: 300, height: 250 })
  })

  it('drags the NW corner, moving the origin and anchoring bottom-right', () => {
    const r = computeResizedRect('nw', ORIGINAL, { x: 60, y: 70 }, OPTS)
    // bottom-right stays at (300, 200)
    expect(r.x).toBe(60)
    expect(r.y).toBe(70)
    expect(r.x + r.width).toBe(300)
    expect(r.y + r.height).toBe(200)
  })

  it('an edge handle only changes its own axis', () => {
    const r = computeResizedRect('e', ORIGINAL, { x: 500, y: 9999 }, OPTS)
    expect(r.width).toBe(400)
    expect(r.height).toBe(100) // unchanged
    expect(r.y).toBe(100)
  })

  it('clamps to min size instead of inverting when dragged past the anchor', () => {
    const r = computeResizedRect('se', ORIGINAL, { x: 0, y: 0 }, OPTS)
    expect(r.width).toBe(50) // minWidth
    expect(r.height).toBe(30) // minHeight
    expect(r.x).toBe(100) // top-left still anchored
    expect(r.y).toBe(100)
  })
})

describe('computeResizedRect — proportional (Shift)', () => {
  it('keeps the 2:1 aspect ratio on a corner drag', () => {
    const r = computeResizedRect('se', ORIGINAL, { x: 500, y: 250 }, OPTS_PROP)
    expect(r.width / r.height).toBeCloseTo(2, 5)
    expect(r.x).toBe(100) // anchored at top-left
    expect(r.y).toBe(100)
  })

  it('corner scale follows the dominant axis', () => {
    // Pointer pushes width to 400 (×2) but height only to 150 (×1.5).
    // Dominant axis is width → scale ×2 → 400×200.
    const r = computeResizedRect('se', ORIGINAL, { x: 500, y: 250 }, OPTS_PROP)
    expect(r.width).toBeCloseTo(400, 5)
    expect(r.height).toBeCloseTo(200, 5)
  })

  it('an edge drag derives the perpendicular axis and stays centered', () => {
    // East edge → width 400, height follows aspect → 200, centered on cy=150.
    const r = computeResizedRect('e', ORIGINAL, { x: 500, y: 150 }, OPTS_PROP)
    expect(r.width).toBeCloseTo(400, 5)
    expect(r.height).toBeCloseTo(200, 5)
    expect(r.y + r.height / 2).toBeCloseTo(150, 5) // vertical center preserved
  })

  it('shrinks responsively along the dragged axis (no stall)', () => {
    // Drag SE inward, mostly horizontally: width → ~60 (×0.3), height
    // barely moves. The dominant axis (width) must drive the scale down
    // rather than the near-unchanged height pinning it near full size.
    const r = computeResizedRect('se', ORIGINAL, { x: 160, y: 199 }, OPTS_PROP)
    expect(r.width).toBeCloseTo(60, 5)
    expect(r.height).toBeCloseTo(30, 5)
    expect(r.width / r.height).toBeCloseTo(2, 5)
  })

  it('respects min size while preserving aspect ratio', () => {
    const r = computeResizedRect('se', ORIGINAL, { x: 100, y: 100 }, OPTS_PROP)
    expect(r.width).toBeGreaterThanOrEqual(50)
    expect(r.height).toBeGreaterThanOrEqual(30)
    expect(r.width / r.height).toBeCloseTo(2, 5)
  })
})

describe('hitTestResizeHandle', () => {
  const node = makeNode(ORIGINAL)

  it('hits a corner grip dead-on', () => {
    expect(hitTestResizeHandle(node, { x: 100, y: 100 }, 1)).toBe('nw')
    expect(hitTestResizeHandle(node, { x: 300, y: 200 }, 1)).toBe('se')
  })

  it('hits an edge midpoint', () => {
    expect(hitTestResizeHandle(node, { x: 200, y: 100 }, 1)).toBe('n')
    expect(hitTestResizeHandle(node, { x: 300, y: 150 }, 1)).toBe('e')
  })

  it('returns null in the node body away from any handle', () => {
    expect(hitTestResizeHandle(node, { x: 200, y: 150 }, 1)).toBeNull()
  })

  it('scales the hit area inversely with zoom (bigger grip when zoomed out)', () => {
    // 10px away from the corner: a miss at zoom 1 (7px half-box)...
    expect(hitTestResizeHandle(node, { x: 110, y: 110 }, 1)).toBeNull()
    // ...but a hit at zoom 0.5 (14px half-box in world units).
    expect(hitTestResizeHandle(node, { x: 110, y: 110 }, 0.5)).toBe('nw')
  })

  it('picks the NEAREST handle when boxes overlap (edge grip is not stolen by a corner)', () => {
    // A short node: E grip at (300,115) sits only 15 units below NE (300,100),
    // so their hit boxes overlap. A click at y=110 falls in both boxes but is
    // closer to E — corners-first ordering would wrongly return 'ne'.
    const shortNode = makeNode({ x: 100, y: 100, width: 200, height: 30 })
    expect(hitTestResizeHandle(shortNode, { x: 300, y: 110 }, 0.4)).toBe('e')
  })

  it('clamps the hit box to under half the node — center of a tiny node is not grabbable', () => {
    // 50x30 node, zoomed far out: an unclamped 35px half-box would blanket the
    // whole node and hijack a center click. Clamped, the center returns null.
    const tiny = makeNode({ x: 100, y: 100, width: 50, height: 30 })
    expect(hitTestResizeHandle(tiny, { x: 125, y: 115 }, 0.2)).toBeNull()
    // ...but the actual corner still hits.
    expect(hitTestResizeHandle(tiny, { x: 100, y: 100 }, 0.2)).toBe('nw')
  })
})

describe('handle geometry helpers', () => {
  it('places all eight handles around the bounding box', () => {
    const pts = getHandlePoints(makeNode(ORIGINAL))
    expect(pts.nw).toEqual({ x: 100, y: 100 })
    expect(pts.se).toEqual({ x: 300, y: 200 })
    expect(pts.e).toEqual({ x: 300, y: 150 })
    expect(RESIZE_HANDLES).toHaveLength(8)
  })

  it('maps corners to diagonal cursors and edges to axis cursors', () => {
    expect(getHandleCursor('nw')).toBe('nwse-resize')
    expect(getHandleCursor('ne')).toBe('nesw-resize')
    expect(getHandleCursor('n')).toBe('ns-resize')
    expect(getHandleCursor('e')).toBe('ew-resize')
  })
})
