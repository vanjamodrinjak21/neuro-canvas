// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drawNode, type NodeColors } from '../drawNode'

// ---------------------------------------------------------------------------
// drawNode — text-wrap layout cache (AER-82)
//
// Wrapping calls ctx.measureText per WORD per node per FRAME; at full LOD on
// a 1000-node map that is the dominant render cost. The layout depends only
// on (content, font, available width), so repeated draws of an unchanged
// node must not re-measure.
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.Path2D === 'undefined') {
    class Path2DPolyfill {
      arc() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
      roundRect() {}
      rect() {}
      ellipse() {}
    }
    // @ts-expect-error polyfill for test environment
    globalThis.Path2D = Path2DPolyfill
  }
})

const COLORS: NodeColors = {
  nodeBg: '#111', nodeBorder: '#222', nodeTier2Bg: '#333',
  nodeTier1Border: '#444', nodeTier2Border: '#555', nodeText: '#eee',
  nodeSelected: '#5EF2E8', nodeGlow: '#5EF2E8', nodeHoverBorder: '#666',
  nodeAiGlow: '#777', nodeHighlightGlow: '#888'
}

const measureText = vi.fn((text: string) => ({ width: text.length * 7 }))

function makeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(), restore: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(),
    beginPath: vi.fn(), closePath: vi.fn(),
    arc: vi.fn(), rect: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(), roundRect: vi.fn(),
    fillText: vi.fn(), measureText,
    translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    setLineDash: vi.fn(), clip: vi.fn(),
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0
  } as unknown as CanvasRenderingContext2D
}

function makeNode(content: string, over: Record<string, unknown> = {}) {
  return {
    id: `n-${content.slice(0, 12)}`,
    position: { x: 100, y: 100 },
    size: { width: 180, height: 64 },
    content,
    style: {},
    parentId: null,
    isRoot: false,
    ...over
  } as never
}

const lerp = (a: string) => a

beforeEach(() => {
  measureText.mockClear()
})

describe('drawNode — text wrap cache (AER-82)', () => {
  it('does not re-measure text when the same node is drawn again', () => {
    const ctx = makeCtx()
    const node = makeNode('several words that will need wrapping into lines')

    drawNode(ctx, node, 'normal', COLORS, false, false, false, lerp)
    const callsAfterFirst = measureText.mock.calls.length
    expect(callsAfterFirst).toBeGreaterThan(0)

    drawNode(ctx, node, 'normal', COLORS, false, false, false, lerp)
    expect(measureText.mock.calls.length).toBe(callsAfterFirst)
  })

  it('produces identical wrapped lines from the cached path', () => {
    const ctx1 = makeCtx()
    const node = makeNode('cached lines must match the freshly computed ones exactly')
    drawNode(ctx1, node, 'normal', COLORS, false, false, false, lerp)
    const firstLines = (ctx1.fillText as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])

    const ctx2 = makeCtx()
    drawNode(ctx2, node, 'normal', COLORS, false, false, false, lerp)
    const secondLines = (ctx2.fillText as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])

    expect(secondLines).toEqual(firstLines)
    expect(firstLines.length).toBeGreaterThan(1) // actually wrapped
  })

  it('re-measures when the content changes', () => {
    const ctx = makeCtx()
    drawNode(ctx, makeNode('original content for this node'), 'normal', COLORS, false, false, false, lerp)
    const afterFirst = measureText.mock.calls.length

    drawNode(ctx, makeNode('edited content is different now'), 'normal', COLORS, false, false, false, lerp)
    expect(measureText.mock.calls.length).toBeGreaterThan(afterFirst)
  })

  it('re-measures when the node width changes (resize)', () => {
    const ctx = makeCtx()
    const content = 'width sensitive wrapping text example here'
    drawNode(ctx, makeNode(content), 'normal', COLORS, false, false, false, lerp)
    const afterFirst = measureText.mock.calls.length

    drawNode(ctx, makeNode(content, { size: { width: 320, height: 64 } }), 'normal', COLORS, false, false, false, lerp)
    expect(measureText.mock.calls.length).toBeGreaterThan(afterFirst)
  })
})
