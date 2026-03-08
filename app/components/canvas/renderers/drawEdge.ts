import type { Node, Edge, Point } from '~/types/canvas'
import type { ConnectionAnimation } from '~/composables/useConnectionAnimation'
import { getAnchorPoint } from '~/composables/useAnchors'
import { getLineDrawProgress, getPulseProgress } from '~/composables/useConnectionAnimation'

/** Color values required by the edge drawing functions. */
export interface EdgeColors {
  edgeSelected: string
  edgeDefault: string
  nodeSelected: string
}

// ---------------------------------------------------------------------------
// getEdgePoint
// ---------------------------------------------------------------------------

/**
 * Calculate the point where an edge intersects a rectangular node boundary.
 *
 * Given a node and an external target point, this projects a ray from the
 * node center toward the target and returns the intersection with the node's
 * bounding rectangle.
 *
 * @param node        - The node whose boundary is used for intersection.
 * @param targetPoint - An external point (typically the center of the
 *                      connected node) that defines the ray direction.
 * @returns The intersection point on the node boundary.
 */
export function getEdgePoint(node: Node, targetPoint: Point): Point {
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
    y: cy + dy * s
  }
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
  let sourcePoint: Point
  let targetPoint: Point

  if (edge.sourceAnchor) {
    sourcePoint = getAnchorPoint(sourceNode, edge.sourceAnchor)
  } else {
    const targetCenter = {
      x: targetNode.position.x + targetNode.size.width / 2,
      y: targetNode.position.y + targetNode.size.height / 2
    }
    sourcePoint = getEdgePoint(sourceNode, targetCenter)
  }

  if (edge.targetAnchor) {
    targetPoint = getAnchorPoint(targetNode, edge.targetAnchor)
  } else {
    const sourceCenter = {
      x: sourceNode.position.x + sourceNode.size.width / 2,
      y: sourceNode.position.y + sourceNode.size.height / 2
    }
    targetPoint = getEdgePoint(targetNode, sourceCenter)
  }

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
    // Premium bezier curve with smart control points
    const dx = targetPoint.x - sourcePoint.x
    const dy = targetPoint.y - sourcePoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Control point offset scales with distance for elegant curves
    const controlOffset = Math.min(distance * 0.4, 80)

    // Determine control point direction based on anchor positions
    let cx1: number, cy1: number, cx2: number, cy2: number

    if (edge.sourceAnchor === 'right' || edge.sourceAnchor === 'left') {
      const dir = edge.sourceAnchor === 'right' ? 1 : -1
      cx1 = sourcePoint.x + controlOffset * dir
      cy1 = sourcePoint.y
    } else if (edge.sourceAnchor === 'top' || edge.sourceAnchor === 'bottom') {
      const dir = edge.sourceAnchor === 'bottom' ? 1 : -1
      cx1 = sourcePoint.x
      cy1 = sourcePoint.y + controlOffset * dir
    } else {
      cx1 = sourcePoint.x + controlOffset * Math.sign(dx || 1)
      cy1 = sourcePoint.y
    }

    if (edge.targetAnchor === 'right' || edge.targetAnchor === 'left') {
      const dir = edge.targetAnchor === 'right' ? 1 : -1
      cx2 = targetPoint.x + controlOffset * dir
      cy2 = targetPoint.y
    } else if (edge.targetAnchor === 'top' || edge.targetAnchor === 'bottom') {
      const dir = edge.targetAnchor === 'bottom' ? 1 : -1
      cx2 = targetPoint.x
      cy2 = targetPoint.y + controlOffset * dir
    } else {
      cx2 = targetPoint.x - controlOffset * Math.sign(dx || 1)
      cy2 = targetPoint.y
    }

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
  let sourcePoint: Point
  let targetPoint: Point

  if (edge.sourceAnchor) {
    sourcePoint = getAnchorPoint(sourceNode, edge.sourceAnchor)
  } else {
    const targetCenter = {
      x: targetNode.position.x + targetNode.size.width / 2,
      y: targetNode.position.y + targetNode.size.height / 2
    }
    sourcePoint = getEdgePoint(sourceNode, targetCenter)
  }

  if (edge.targetAnchor) {
    targetPoint = getAnchorPoint(targetNode, edge.targetAnchor)
  } else {
    const sourceCenter = {
      x: sourceNode.position.x + sourceNode.size.width / 2,
      y: sourceNode.position.y + sourceNode.size.height / 2
    }
    targetPoint = getEdgePoint(targetNode, sourceCenter)
  }

  // Calculate bezier control points (matching drawEdge logic)
  const dx = targetPoint.x - sourcePoint.x
  const dy = targetPoint.y - sourcePoint.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const controlOffset = Math.min(distance * 0.4, 80)

  let cx1: number, cy1: number, cx2: number, cy2: number

  if (edge.sourceAnchor === 'right' || edge.sourceAnchor === 'left') {
    const dir = edge.sourceAnchor === 'right' ? 1 : -1
    cx1 = sourcePoint.x + controlOffset * dir
    cy1 = sourcePoint.y
  } else if (edge.sourceAnchor === 'top' || edge.sourceAnchor === 'bottom') {
    const dir = edge.sourceAnchor === 'bottom' ? 1 : -1
    cx1 = sourcePoint.x
    cy1 = sourcePoint.y + controlOffset * dir
  } else {
    cx1 = sourcePoint.x + controlOffset * Math.sign(dx || 1)
    cy1 = sourcePoint.y
  }

  if (edge.targetAnchor === 'right' || edge.targetAnchor === 'left') {
    const dir = edge.targetAnchor === 'right' ? 1 : -1
    cx2 = targetPoint.x + controlOffset * dir
    cy2 = targetPoint.y
  } else if (edge.targetAnchor === 'top' || edge.targetAnchor === 'bottom') {
    const dir = edge.targetAnchor === 'bottom' ? 1 : -1
    cx2 = targetPoint.x
    cy2 = targetPoint.y + controlOffset * dir
  } else {
    cx2 = targetPoint.x - controlOffset * Math.sign(dx || 1)
    cy2 = targetPoint.y
  }

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
    // Draw partial bezier curve for animation
    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    const steps = 20
    for (let i = 1; i <= steps * drawProgress; i++) {
      const t = i / steps
      const x = Math.pow(1 - t, 3) * sourcePoint.x +
                3 * Math.pow(1 - t, 2) * t * cx1 +
                3 * (1 - t) * Math.pow(t, 2) * cx2 +
                Math.pow(t, 3) * targetPoint.x
      const y = Math.pow(1 - t, 3) * sourcePoint.y +
                3 * Math.pow(1 - t, 2) * t * cy1 +
                3 * (1 - t) * Math.pow(t, 2) * cy2 +
                Math.pow(t, 3) * targetPoint.y
      ctx.lineTo(x, y)
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
      const t = pulseProgress
      pulseX = Math.pow(1 - t, 3) * sourcePoint.x +
               3 * Math.pow(1 - t, 2) * t * cx1 +
               3 * (1 - t) * Math.pow(t, 2) * cx2 +
               Math.pow(t, 3) * targetPoint.x
      pulseY = Math.pow(1 - t, 3) * sourcePoint.y +
               3 * Math.pow(1 - t, 2) * t * cy1 +
               3 * (1 - t) * Math.pow(t, 2) * cy2 +
               Math.pow(t, 3) * targetPoint.y
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
