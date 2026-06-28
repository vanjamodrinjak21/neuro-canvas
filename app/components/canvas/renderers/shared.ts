import type { Node, Point, Anchor } from '~/types/canvas'
import { getAnchorPoint, getBestAnchorPair } from '~/composables/useAnchors'

/** Calculate bezier control points for an edge between two points with optional anchor hints. */
export function calculateBezierControlPoints(
  source: Point,
  target: Point,
  sourceAnchor?: Anchor | null,
  targetAnchor?: Anchor | null,
): { cx1: number; cy1: number; cx2: number; cy2: number } {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Control point offset scales with distance for elegant curves
  const controlOffset = Math.min(distance * 0.4, 80)

  let cx1: number, cy1: number, cx2: number, cy2: number

  if (sourceAnchor === 'right' || sourceAnchor === 'left') {
    const dir = sourceAnchor === 'right' ? 1 : -1
    cx1 = source.x + controlOffset * dir
    cy1 = source.y
  } else if (sourceAnchor === 'top' || sourceAnchor === 'bottom') {
    const dir = sourceAnchor === 'bottom' ? 1 : -1
    cx1 = source.x
    cy1 = source.y + controlOffset * dir
  } else {
    cx1 = source.x + controlOffset * Math.sign(dx || 1)
    cy1 = source.y
  }

  if (targetAnchor === 'right' || targetAnchor === 'left') {
    const dir = targetAnchor === 'right' ? 1 : -1
    cx2 = target.x + controlOffset * dir
    cy2 = target.y
  } else if (targetAnchor === 'top' || targetAnchor === 'bottom') {
    const dir = targetAnchor === 'bottom' ? 1 : -1
    cx2 = target.x
    cy2 = target.y + controlOffset * dir
  } else {
    cx2 = target.x - controlOffset * Math.sign(dx || 1)
    cy2 = target.y
  }

  return { cx1, cy1, cx2, cy2 }
}

/**
 * Resolve where an edge attaches to each node — at the NEAREST SIDE.
 *
 * Any endpoint without an explicit (user-snapped) anchor gets one chosen
 * dynamically from the current node positions via `getBestAnchorPair`
 * (dominant-axis: right/left when horizontally apart, top/bottom when
 * vertically apart). This makes AI-generated / imported / programmatic edges —
 * which carry no stored anchors — connect to the nearest side and re-pick it
 * live as nodes move, instead of attaching at an arbitrary center-ray point.
 * Explicit anchors are still honoured.
 *
 * The resolved anchors are returned so the curve handles can emanate
 * perpendicular to the chosen side (see `calculateBezierControlPoints`).
 */
export function resolveEdgeEndpoints(
  sourceNode: Node,
  targetNode: Node,
  sourceAnchor?: Anchor | null,
  targetAnchor?: Anchor | null,
): { sourcePoint: Point; targetPoint: Point; sourceAnchor: Anchor; targetAnchor: Anchor } {
  const best = getBestAnchorPair(sourceNode, targetNode)
  const sAnchor: Anchor = sourceAnchor ?? best.sourceAnchor
  const tAnchor: Anchor = targetAnchor ?? best.targetAnchor

  return {
    sourcePoint: getAnchorPoint(sourceNode, sAnchor),
    targetPoint: getAnchorPoint(targetNode, tAnchor),
    sourceAnchor: sAnchor,
    targetAnchor: tAnchor,
  }
}

/** Get intersection point of ray from node center toward target with node boundary. */
export function getEdgeIntersection(node: Node, targetPoint: Point): Point {
  const cx = node.position.x + node.size.width / 2
  const cy = node.position.y + node.size.height / 2
  const dx = targetPoint.x - cx
  const dy = targetPoint.y - cy

  const hw = node.size.width / 2
  const hh = node.size.height / 2

  // Calculate intersection with rectangle boundary
  const sx = dx === 0 ? 0 : Math.abs(hw / dx)
  const sy = dy === 0 ? 0 : Math.abs(hh / dy)
  const s = Math.min(sx || Infinity, sy || Infinity)

  return {
    x: cx + dx * s,
    y: cy + dy * s,
  }
}

/** Ease-out cubic. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Interpolate along a cubic bezier at parameter t. */
export function bezierPoint(
  t: number,
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
): Point {
  return {
    x: Math.pow(1 - t, 3) * p0.x +
       3 * Math.pow(1 - t, 2) * t * cp1.x +
       3 * (1 - t) * Math.pow(t, 2) * cp2.x +
       Math.pow(t, 3) * p3.x,
    y: Math.pow(1 - t, 3) * p0.y +
       3 * Math.pow(1 - t, 2) * t * cp1.y +
       3 * (1 - t) * Math.pow(t, 2) * cp2.y +
       Math.pow(t, 3) * p3.y,
  }
}
