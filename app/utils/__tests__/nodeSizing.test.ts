import { describe, it, expect } from 'vitest'
import { getNodeMetrics, measureNodeSize, NODE_FONT_FAMILY } from '../nodeSizing'

describe('nodeSizing — getNodeMetrics', () => {
  it('scales padding / bounds / lineHeight proportionally to fontSize', () => {
    const m14 = getNodeMetrics(14)
    const m24 = getNodeMetrics(24)
    const m32 = getNodeMetrics(32)
    // Padding grows with font size
    expect(m24.paddingX).toBeGreaterThan(m14.paddingX)
    expect(m32.paddingX).toBeGreaterThan(m24.paddingX)
    // Min/max width grows with font size
    expect(m24.maxWidth).toBeGreaterThan(m14.maxWidth)
    // Line height tracks fontSize at 1.4x
    expect(m14.lineHeight).toBeCloseTo(14 * 1.4)
    expect(m24.lineHeight).toBeCloseTo(24 * 1.4)
  })

  it('enforces floor values so tiny fonts still produce sane node boxes', () => {
    const tiny = getNodeMetrics(8)
    expect(tiny.paddingX).toBeGreaterThanOrEqual(20)
    expect(tiny.paddingY).toBeGreaterThanOrEqual(14)
    expect(tiny.minWidth).toBeGreaterThanOrEqual(60)
    expect(tiny.maxWidth).toBeGreaterThanOrEqual(220)
    expect(tiny.minHeight).toBeGreaterThanOrEqual(34)
  })

  it('treats fontSize below 8 as if it were 8 (no negative / sub-pixel surprises)', () => {
    const sub = getNodeMetrics(4)
    const floor = getNodeMetrics(8)
    expect(sub).toEqual(floor)
  })
})

describe('nodeSizing — measureNodeSize', () => {
  it('returns floor dimensions for empty content', () => {
    const { width, height } = measureNodeSize('', 14, 500)
    const floor = getNodeMetrics(14)
    expect(width).toBe(floor.minWidth)
    expect(height).toBe(floor.minHeight)
  })

  it('grows the node when the same text uses a larger font', () => {
    const small = measureNodeSize('Cognitive load', 12, 500)
    const big = measureNodeSize('Cognitive load', 24, 500)
    expect(big.width).toBeGreaterThanOrEqual(small.width)
    expect(big.height).toBeGreaterThanOrEqual(small.height)
  })

  it('clamps width to maxWidth even for long content', () => {
    const longText = 'a'.repeat(500)
    const m = getNodeMetrics(14)
    const { width } = measureNodeSize(longText, 14, 500)
    expect(width).toBeLessThanOrEqual(m.maxWidth)
  })
})

describe('nodeSizing — shape inflation', () => {
  it('inflates a diamond outer box to ~2× the rounded outer box', () => {
    const label = 'Cognitive load'
    const rect = measureNodeSize(label, 14, 500, 'rounded')
    const diamond = measureNodeSize(label, 14, 500, 'diamond')
    // Diamond outer must exceed rounded outer on both axes
    expect(diamond.width).toBeGreaterThan(rect.width)
    expect(diamond.height).toBeGreaterThan(rect.height)
  })

  it('inflates a hexagon width by ~1.155× but leaves height unchanged', () => {
    const label = 'Cognitive load'
    const rect = measureNodeSize(label, 14, 500, 'rounded')
    const hex = measureNodeSize(label, 14, 500, 'hexagon')
    expect(hex.width).toBeGreaterThan(rect.width)
    expect(hex.height).toBe(rect.height)
  })

  it('clamps outer width to maxWidth even when shape multiplier would push past it', () => {
    const longText = 'a '.repeat(120).trim()
    const m = getNodeMetrics(14)
    const diamond = measureNodeSize(longText, 14, 500, 'diamond')
    expect(diamond.width).toBeLessThanOrEqual(m.maxWidth)
  })

  it('treats unknown shape values as rounded (no inflation)', () => {
    const label = 'short'
    const rect = measureNodeSize(label, 14, 500, 'rounded')
    // Same call signature without shape param should match
    const same = measureNodeSize(label, 14, 500)
    expect(same).toEqual(rect)
  })
})

describe('nodeSizing — NODE_FONT_FAMILY', () => {
  it('uses Inter with system fallbacks (matches drawNode renderer)', () => {
    expect(NODE_FONT_FAMILY).toContain('Inter')
    expect(NODE_FONT_FAMILY).toContain('system-ui')
    expect(NODE_FONT_FAMILY).toContain('sans-serif')
  })
})
