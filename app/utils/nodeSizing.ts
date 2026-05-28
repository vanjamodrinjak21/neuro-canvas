// Proportional sizing rules shared by mapStore.measureNodeSize (which
// computes node.size) and the canvas renderer (which wraps text inside
// that size). Keeping them in one place guarantees the renderer wraps
// using the same padding the sizer assumed — otherwise text overflows
// or leaves dead space when fontSize changes.

import type { NodeShape } from '~/types/canvas'

export const NODE_FONT_FAMILY = '"Inter", system-ui, sans-serif'

export interface NodeMetrics {
  paddingX: number
  paddingY: number
  minWidth: number
  maxWidth: number
  minHeight: number
  lineHeight: number
}

/**
 * Per-shape inflation factors that convert an inner content box (the
 * rectangle the text occupies) into the outer bounding box the shape
 * must occupy so the text never clips against the shape's visible edge.
 *
 * For each shape, given an inner box of `w × h`, the smallest outer
 * bounding box that fully contains it is `w * widthMul × h * heightMul`.
 *
 * - rectangle / rounded / pill: inner == outer (no penalty).
 * - circle: inscribed rect with aspect r=w/h inside a circle of
 *   diameter D requires `D >= sqrt(w² + h²)`. We use `sqrt(2)` as the
 *   symmetric multiplier on both axes — slightly generous for very
 *   wide rectangles but keeps the circle round rather than elliptical.
 * - diamond (rotated square): inscribed rectangle is exactly HALF the
 *   diamond's bounding box on each axis (|x|/W + |y|/H ≤ 1/2 — the
 *   symmetric inner rect). So outer = inner × 2 on both axes.
 * - hexagon (pointy-top via shapes.ts): inscribed rectangle width is
 *   `0.866 * W` (cos 30°). So outer width = inner / 0.866 ≈ 1.155×;
 *   height passes through 1:1 because the hex is taller than the
 *   inscribed rect on its vertical axis already.
 * - star (5-point): the largest axis-aligned rect that fits cleanly
 *   inside the inner pentagon of a 5-point star is roughly 0.6 × the
 *   bounding box. Use 1.7× inflate on both axes for a safe fit.
 * - dot: intentionally tiny indicator — does NOT host text. We do not
 *   inflate; callers may render labels external to the dot.
 */
const SHAPE_INFLATION: Record<NodeShape, { widthMul: number; heightMul: number }> = {
  rectangle: { widthMul: 1, heightMul: 1 },
  rounded:   { widthMul: 1, heightMul: 1 },
  pill:      { widthMul: 1, heightMul: 1 },
  circle:    { widthMul: Math.SQRT2, heightMul: Math.SQRT2 },
  diamond:   { widthMul: 2, heightMul: 2 },
  hexagon:   { widthMul: 1.155, heightMul: 1 },
  star:      { widthMul: 1.7, heightMul: 1.7 },
  dot:       { widthMul: 1, heightMul: 1 },
}

/** Inflate a content (inner) box to the outer bounding box for a shape. */
export function inflateForShape(
  innerWidth: number,
  innerHeight: number,
  shape: NodeShape = 'rounded'
): { width: number; height: number } {
  const mul = SHAPE_INFLATION[shape] ?? SHAPE_INFLATION.rounded
  return {
    width: innerWidth * mul.widthMul,
    height: innerHeight * mul.heightMul,
  }
}

/**
 * Derive padding / bounds / lineHeight from fontSize so a 24px node
 * doesn't feel cramped in the same box that fits 12px text comfortably.
 */
export function getNodeMetrics(fontSize: number): NodeMetrics {
  const size = Math.max(8, fontSize)
  return {
    paddingX: Math.round(Math.max(20, size * 1.2)),
    paddingY: Math.round(Math.max(14, size * 0.85)),
    minWidth: Math.round(Math.max(60, size * 4)),
    maxWidth: Math.round(Math.max(220, size * 18)),
    minHeight: Math.round(Math.max(34, size * 2.2)),
    lineHeight: size * 1.4,
  }
}

let _measureCtx: CanvasRenderingContext2D | null = null
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!_measureCtx) {
    const c = document.createElement('canvas')
    _measureCtx = c.getContext('2d')
  }
  return _measureCtx
}

/**
 * Compute the width and height a node needs to fit its text content
 * given a fontSize / fontWeight, then inflate to the outer bounding box
 * for the requested shape so non-rectangular shapes (diamond, circle,
 * hexagon, star) leave enough room for the text inside their visible
 * edges. Mirrors the renderer's wrap logic so the rendered text fits
 * the returned inner content box exactly.
 *
 * @param content     - The node's label text.
 * @param fontSize    - Pixel size of the rendered text.
 * @param fontWeight  - Numeric font weight (400, 500, 700, ...).
 * @param shape       - The shape the node will be drawn as. Defaults to
 *                      'rounded' (no inflation) for backward compat.
 */
export function measureNodeSize(
  content: string,
  fontSize: number = 14,
  fontWeight: number = 500,
  shape: NodeShape = 'rounded'
): { width: number; height: number } {
  const m = getNodeMetrics(fontSize)
  const ctx = getMeasureCtx()
  if (!ctx || !content) {
    const inflated = inflateForShape(m.minWidth, m.minHeight, shape)
    return {
      width: Math.ceil(Math.min(m.maxWidth, inflated.width)),
      height: Math.ceil(inflated.height),
    }
  }

  ctx.font = `${fontWeight} ${fontSize}px ${NODE_FONT_FAMILY}`

  // Compute the inner content box (the rectangle the text occupies).
  // We clamp the inner width against an *inner* maxWidth derived from
  // the project-wide maxWidth divided by the shape's inflation factor,
  // so the final outer width respects the global cap regardless of
  // shape. Diamond's 2× multiplier would otherwise produce 2× the cap.
  const unit = inflateForShape(1, 1, shape)
  const innerMaxWidth = Math.max(m.minWidth, m.maxWidth / unit.width)

  const fullWidth = ctx.measureText(content).width + m.paddingX
  const innerTargetWidth = Math.max(m.minWidth, Math.min(innerMaxWidth, fullWidth))
  const maxTextWidth = innerTargetWidth - m.paddingX

  // Word-wrap to compute line count. Falls back to single-line measure
  // when a single word is wider than maxTextWidth (long URLs, no-space
  // Croatian compound terms, etc.) — we let the renderer clip / ellipsis
  // rather than overflow the box.
  const words = content.split(' ')
  const lines: string[] = []
  let currentLine = ''
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  const textHeight = lines.length * m.lineHeight
  const innerHeight = Math.max(m.minHeight, textHeight + m.paddingY)

  // Inflate the inner content box to the shape's outer bounding box so
  // the text fits inside the visible shape, not just inside the AABB.
  const outer = inflateForShape(innerTargetWidth, innerHeight, shape)

  // Final clamp: never exceed the project-wide maxWidth on the outer
  // width (e.g. extremely long single words on a diamond).
  const outerWidth = Math.min(m.maxWidth, outer.width)

  return { width: Math.ceil(outerWidth), height: Math.ceil(outer.height) }
}
