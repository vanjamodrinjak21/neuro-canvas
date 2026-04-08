import type { Node, Edge, Point } from '~/types/canvas'
import type { ConnectionAnimation } from '~/composables/useConnectionAnimation'
import { getLineDrawProgress, getPulseProgress } from '~/composables/useConnectionAnimation'
import { resolveEdgeEndpoints, calculateBezierControlPoints, bezierPoint } from './shared'

/** Color values required by the edge drawing functions. */
export interface EdgeColors {
  edgeSelected: string
  edgeDefault: string
  nodeSelected: string
}

// ---------------------------------------------------------------------------
// drawArrow
// ---------------------------------------------------------------------------

/**
 * Draw an arrow head (or alternative end marker) at the tip of an edge.
 *
 * Supports three marker styles:
 * - `"arrow"` -- filled triangular arrowhead pointing along the tangent.
 * - `"dot"`   -- small filled circle at the tip.
 * - `"diamond"` -- diamond / rhombus shape aligned to the tangent.
 *
 * The tangent direction is derived from `tangentFrom` toward `tipPoint`,
 * which gives the correct visual orientation for bezier curves when the
 * second control point is passed as `tangentFrom`.
 *
 * @param ctx           - The 2D canvas rendering context.
 * @param tipPoint      - The exact position of the arrow tip (edge endpoint).
 * @param tangentFrom   - A reference point used to compute the approach angle
 *                        (e.g. the second bezier control point, or the source
 *                        point for straight lines).
 * @param style         - Marker style: `"arrow"`, `"dot"`, or `"diamond"`.
 * @param color         - Fill / stroke color for the marker.
 * @param isHighlighted - When `true`, a subtle glow is applied.
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  tipPoint: Point,
  tangentFrom: Point,
  style: string,
  color: string,
  isHighlighted: boolean = false
): void {
  // Calculate angle from tangent
  const angle = Math.atan2(tipPoint.y - tangentFrom.y, tipPoint.x - tangentFrom.x)

  // Clean, minimal arrow sizing
  const arrowLength = 10
  const arrowWidth = 8

  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Subtle glow for highlighted
  if (isHighlighted) {
    ctx.shadowColor = color
    ctx.shadowBlur = 4
  }

  if (style === 'arrow') {
    // Clean triangular arrow - simple and elegant
    const tipX = tipPoint.x
    const tipY = tipPoint.y

    // Calculate perpendicular for wing spread
    const perpX = -Math.sin(angle)
    const perpY = Math.cos(angle)

    // Arrow base point (pulled back from tip)
    const baseX = tipX - arrowLength * Math.cos(angle)
    const baseY = tipY - arrowLength * Math.sin(angle)

    // Wing points
    const halfWidth = arrowWidth / 2
    const wing1X = baseX + perpX * halfWidth
    const wing1Y = baseY + perpY * halfWidth
    const wing2X = baseX - perpX * halfWidth
    const wing2Y = baseY - perpY * halfWidth

    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(wing1X, wing1Y)
    ctx.lineTo(wing2X, wing2Y)
    ctx.closePath()
    ctx.fill()

  } else if (style === 'dot') {
    // Simple filled circle
    ctx.beginPath()
    ctx.arc(tipPoint.x, tipPoint.y, 4, 0, Math.PI * 2)
    ctx.fill()

  } else if (style === 'diamond') {
    // Clean diamond shape
    const size = 6

    // Diamond points along the tangent direction
    const perpX = -Math.sin(angle)
    const perpY = Math.cos(angle)

    ctx.beginPath()
    ctx.moveTo(tipPoint.x, tipPoint.y)
    ctx.lineTo(tipPoint.x - size * Math.cos(angle) + size * 0.5 * perpX,
               tipPoint.y - size * Math.sin(angle) + size * 0.5 * perpY)
    ctx.lineTo(tipPoint.x - size * 2 * Math.cos(angle),
               tipPoint.y - size * 2 * Math.sin(angle))
    ctx.lineTo(tipPoint.x - size * Math.cos(angle) - size * 0.5 * perpX,
               tipPoint.y - size * Math.sin(angle) - size * 0.5 * perpY)
    ctx.closePath()
    ctx.fill()
  }

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

// ---------------------------------------------------------------------------
// drawEdge
// ---------------------------------------------------------------------------

/**
 * Draw a single edge between two nodes on the canvas.
 *
 * Supports three path types (determined by `edge.style.type`):
 * - `"bezier"`     -- cubic bezier with smart control points based on anchors.
 * - `"orthogonal"` -- right-angle connector routed through a midpoint.
 * - `"straight"`   -- direct line segment.
 *
 * The function is **pure**: it reads node positions and selection state from
 * the arguments rather than from any reactive store or ref.
 *
 * @param ctx               - The 2D canvas rendering context.
 * @param edge              - The edge to render.
 * @param nodes             - All nodes in the map, keyed by id.
 * @param selectionNodeIds  - Currently selected node ids (used for highlight).
 * @param selectionEdgeIds  - Currently selected edge ids (used for highlight).
 * @param colors            - Color palette for edges.
 */
export function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: Edge,
  nodes: Map<string, Node>,
  selectionNodeIds: Set<string>,
  selectionEdgeIds: Set<string>,
  colors: EdgeColors
): void {
  const sourceNode = nodes.get(edge.sourceId)
  const targetNode = nodes.get(edge.targetId)

  if (!sourceNode || !targetNode) return

  const style = edge.style
  const isSelected = selectionEdgeIds.has(edge.id)

  // Check if edge is connected to any selected node
  const isConnectedToSelection = selectionNodeIds.has(edge.sourceId) ||
                                  selectionNodeIds.has(edge.targetId)

  // Get edge points - use anchor points if available, otherwise calculate from boundaries
  const { sourcePoint, targetPoint } = resolveEdgeEndpoints(
    sourceNode, targetNode, edge.sourceAnchor, edge.targetAnchor
  )

  // Edge styling - highlight if selected or connected to selected node
  const isHighlighted = isSelected || isConnectedToSelection
  ctx.strokeStyle = isHighlighted ? colors.edgeSelected : colors.edgeDefault
  ctx.lineWidth = isHighlighted ? 2 : 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (style.dashArray) {
    ctx.setLineDash(style.dashArray)
  } else {
    ctx.setLineDash([])
  }

  // Add subtle glow for highlighted edges
  if (isHighlighted) {
    ctx.shadowColor = colors.nodeSelected
    ctx.shadowBlur = 4
  }

  ctx.beginPath()

  // Track the tangent point for arrow direction
  let arrowTangentPoint: Point = sourcePoint

  if (style.type === 'bezier') {
    // Premium bezier curve with smart control points (via shared utility)
    const { cx1, cy1, cx2, cy2 } = calculateBezierControlPoints(
      sourcePoint, targetPoint, edge.sourceAnchor, edge.targetAnchor
    )

    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, targetPoint.x, targetPoint.y)

    // For bezier, arrow tangent comes from second control point
    arrowTangentPoint = { x: cx2, y: cy2 }

  } else if (style.type === 'orthogonal') {
    // Orthogonal path
    const midX = (sourcePoint.x + targetPoint.x) / 2

    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    ctx.lineTo(midX, sourcePoint.y)
    ctx.lineTo(midX, targetPoint.y)
    ctx.lineTo(targetPoint.x, targetPoint.y)

    // For orthogonal, arrow tangent is horizontal from midX
    arrowTangentPoint = { x: midX, y: targetPoint.y }

  } else {
    // Straight line
    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    ctx.lineTo(targetPoint.x, targetPoint.y)

    // For straight line, tangent is from source
    arrowTangentPoint = sourcePoint
  }

  ctx.stroke()

  // Reset shadow and dash
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.setLineDash([])

  // Draw arrow at end - using correct tangent point for direction
  if (style.arrowEnd !== 'none') {
    drawArrow(ctx, targetPoint, arrowTangentPoint, style.arrowEnd, isHighlighted ? colors.edgeSelected : colors.edgeDefault, isHighlighted)
  }
}

// ---------------------------------------------------------------------------
// drawAnimatedEdge
// ---------------------------------------------------------------------------

/**
 * Draw an edge with a line-draw entrance animation and a traveling pulse dot.
 *
 * When the animation is `undefined` this falls through to {@link drawEdge} so
 * it can be used as a drop-in replacement on every frame.
 *
 * The function is **pure**: all mutable / reactive state is passed in via the
 * arguments.
 *
 * @param ctx               - The 2D canvas rendering context.
 * @param edge              - The edge to render.
 * @param animation         - The active connection animation state, or
 *                            `undefined` if no animation is running.
 * @param currentTime       - The current `performance.now()` timestamp.
 * @param nodes             - All nodes in the map, keyed by id.
 * @param selectionNodeIds  - Currently selected node ids (used for highlight).
 * @param selectionEdgeIds  - Currently selected edge ids (used for highlight).
 * @param colors            - Color palette for edges and pulse dot.
 */
export function drawAnimatedEdge(
  ctx: CanvasRenderingContext2D,
  edge: Edge,
  animation: ConnectionAnimation | undefined,
  currentTime: number,
  nodes: Map<string, Node>,
  selectionNodeIds: Set<string>,
  selectionEdgeIds: Set<string>,
  colors: EdgeColors
): void {
  if (!animation) {
    drawEdge(ctx, edge, nodes, selectionNodeIds, selectionEdgeIds, colors)
    return
  }

  const sourceNode = nodes.get(edge.sourceId)
  const targetNode = nodes.get(edge.targetId)
  if (!sourceNode || !targetNode) return

  const style = edge.style
  const isSelected = selectionEdgeIds.has(edge.id)
  const isConnectedToSelection = selectionNodeIds.has(edge.sourceId) ||
                                  selectionNodeIds.has(edge.targetId)
  const isHighlighted = isSelected || isConnectedToSelection

  // Get anchor-based points if available, otherwise use boundary calculation
  const { sourcePoint, targetPoint } = resolveEdgeEndpoints(
    sourceNode, targetNode, edge.sourceAnchor, edge.targetAnchor
  )

  // Calculate bezier control points via shared utility
  const { cx1, cy1, cx2, cy2 } = calculateBezierControlPoints(
    sourcePoint, targetPoint, edge.sourceAnchor, edge.targetAnchor
  )

  // Get animation progress
  const drawProgress = getLineDrawProgress(animation, currentTime)

  // Draw edge styling
  ctx.strokeStyle = isHighlighted ? colors.edgeSelected : colors.edgeDefault
  ctx.lineWidth = isHighlighted ? 2 : 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (style.dashArray) {
    ctx.setLineDash(style.dashArray)
  } else {
    ctx.setLineDash([])
  }

  ctx.beginPath()

  if (style.type === 'bezier') {
    // Draw partial bezier curve for animation using bezierPoint utility
    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    const cp1 = { x: cx1, y: cy1 }
    const cp2 = { x: cx2, y: cy2 }
    const steps = 20
    for (let i = 1; i <= steps * drawProgress; i++) {
      const t = i / steps
      const pt = bezierPoint(t, sourcePoint, cp1, cp2, targetPoint)
      ctx.lineTo(pt.x, pt.y)
    }
  } else {
    // Straight line - simple partial draw
    const currentEndX = sourcePoint.x + (targetPoint.x - sourcePoint.x) * drawProgress
    const currentEndY = sourcePoint.y + (targetPoint.y - sourcePoint.y) * drawProgress
    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    ctx.lineTo(currentEndX, currentEndY)
  }

  ctx.stroke()
  ctx.setLineDash([])

  // Draw pulse dot (after line draw starts)
  const pulseProgress = getPulseProgress(animation, currentTime)
  if (pulseProgress >= 0 && pulseProgress <= 1) {
    let pulseX: number, pulseY: number

    if (style.type === 'bezier') {
      const cp1 = { x: cx1, y: cy1 }
      const cp2 = { x: cx2, y: cy2 }
      const pt = bezierPoint(pulseProgress, sourcePoint, cp1, cp2, targetPoint)
      pulseX = pt.x
      pulseY = pt.y
    } else {
      pulseX = sourcePoint.x + (targetPoint.x - sourcePoint.x) * pulseProgress
      pulseY = sourcePoint.y + (targetPoint.y - sourcePoint.y) * pulseProgress
    }

    const opacity = pulseProgress < 0.2 ? pulseProgress * 5 :
                    pulseProgress > 0.8 ? (1 - pulseProgress) * 5 : 1

    ctx.beginPath()
    ctx.arc(pulseX, pulseY, 4, 0, Math.PI * 2)
    ctx.fillStyle = colors.nodeSelected
    ctx.globalAlpha = opacity
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Draw arrow at end if animation is complete - use control point for tangent
  if (drawProgress >= 1 && style.arrowEnd !== 'none') {
    const tangentPoint = style.type === 'bezier' ? { x: cx2, y: cy2 } : sourcePoint
    drawArrow(ctx, targetPoint, tangentPoint, style.arrowEnd, isHighlighted ? colors.edgeSelected : colors.edgeDefault, isHighlighted)
  }
}
