import type { Camera, Node, Point, Anchor } from '~/types/canvas'
import type { AlignmentGuide } from '~/composables/useSmartGuides'
import { getAnchorPoint } from '~/composables/useAnchors'
import { calculateBezierControlPoints, getEdgeIntersection } from './shared'

/**
 * Draw smart alignment guides during node drag.
 * Renders thin dashed lines spanning the visible viewport.
 */
export function drawSmartGuides(
  ctx: CanvasRenderingContext2D,
  guides: AlignmentGuide[],
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  dpr: number,
  accentColor: string
) {
  if (guides.length === 0) return

  const viewWidth = canvasWidth / dpr / camera.zoom
  const viewHeight = canvasHeight / dpr / camera.zoom
  const worldLeft = -camera.x / camera.zoom
  const worldTop = -camera.y / camera.zoom
  const worldRight = worldLeft + viewWidth
  const worldBottom = worldTop + viewHeight

  ctx.save()
  ctx.strokeStyle = accentColor
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1 / camera.zoom
  ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom])

  for (const guide of guides) {
    ctx.beginPath()
    if (guide.axis === 'vertical') {
      ctx.moveTo(guide.position, worldTop)
      ctx.lineTo(guide.position, worldBottom)
    } else {
      ctx.moveTo(worldLeft, guide.position)
      ctx.lineTo(worldRight, guide.position)
    }
    ctx.stroke()

    // Diamond marker at guide position
    const markerSize = 3 / camera.zoom
    ctx.fillStyle = accentColor
    ctx.globalAlpha = 0.6
    if (guide.axis === 'vertical') {
      const midY = (worldTop + worldBottom) / 2
      ctx.beginPath()
      ctx.moveTo(guide.position, midY - markerSize)
      ctx.lineTo(guide.position + markerSize, midY)
      ctx.lineTo(guide.position, midY + markerSize)
      ctx.lineTo(guide.position - markerSize, midY)
      ctx.closePath()
      ctx.fill()
    } else {
      const midX = (worldLeft + worldRight) / 2
      ctx.beginPath()
      ctx.moveTo(midX - markerSize, guide.position)
      ctx.lineTo(midX, guide.position - markerSize)
      ctx.lineTo(midX + markerSize, guide.position)
      ctx.lineTo(midX, guide.position + markerSize)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 0.4
  }

  ctx.setLineDash([])
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Overlay color palette subset used by the functions below
// ---------------------------------------------------------------------------

export interface OverlayColors {
  nodeSelected: string
  anchorFill: string
  anchorBorder: string
  rootIndicatorBg: string
}

// ---------------------------------------------------------------------------
// drawAnchorPoints
// ---------------------------------------------------------------------------

/** Snap target descriptor used by the connection tool. */
export interface SnapTarget {
  node: Node
  anchor: Anchor
  point: Point
}

/**
 * Draw the circular anchor point handles on a node.
 *
 * Pure function — all reactive state must be pre-resolved before calling.
 *
 * @param ctx           - 2D canvas rendering context.
 * @param node          - The node whose anchors should be drawn.
 * @param anchors       - The set of anchors visible for this node.
 * @param snapTarget    - Currently snapped anchor target (or null).
 * @param currentTime   - `performance.now()` value for scale animation.
 * @param colors        - Overlay color palette.
 * @param getAnchorScale - Function returning the animated scale for a given anchor.
 * @param isLight       - Whether the light theme is active.
 */
export function drawAnchorPoints(
  ctx: CanvasRenderingContext2D,
  node: Node,
  anchors: Anchor[],
  snapTarget: SnapTarget | null,
  currentTime: number,
  colors: OverlayColors,
  getAnchorScale: (nodeId: string, anchor: Anchor, time: number) => number,
  isLight?: boolean
): void {
  for (const anchor of anchors) {
    const point = getAnchorPoint(node, anchor)
    const isSnapped = snapTarget?.node.id === node.id && snapTarget?.anchor === anchor
    const scale = getAnchorScale(node.id, anchor, currentTime)
    const baseSize = isSnapped ? 12 : 10
    const size = baseSize * scale

    // Glow effect for snapped anchor
    if (isSnapped) {
      ctx.shadowColor = colors.nodeSelected
      ctx.shadowBlur = 12
    }

    // Outer ring
    ctx.beginPath()
    ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2)
    ctx.fillStyle = isSnapped ? colors.nodeSelected : (isLight ? '#F5F5F3' : '#1A1A20')
    ctx.fill()

    // Border
    ctx.strokeStyle = isSnapped ? colors.nodeSelected : (isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)')
    ctx.lineWidth = isSnapped ? 2 : 1.5
    ctx.stroke()

    // Inner highlight dot for premium look
    ctx.beginPath()
    ctx.arc(point.x, point.y, size / 4, 0, Math.PI * 2)
    ctx.fillStyle = isSnapped ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'
    ctx.fill()

    // Reset shadow
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }
}

// ---------------------------------------------------------------------------
// drawRootIndicator
// ---------------------------------------------------------------------------

/**
 * Draw the teal pill indicator above a root node.
 *
 * Pure function — receives all visual data as parameters.
 *
 * @param ctx    - 2D canvas rendering context.
 * @param node   - The root node to annotate.
 * @param colors - Overlay color palette.
 */
export function drawRootIndicator(
  ctx: CanvasRenderingContext2D,
  node: Node,
  colors: OverlayColors
): void {
  const { x, y } = node.position
  const { width } = node.size
  const centerX = x + width / 2
  const indicatorY = y - 10

  // Subtle glow
  ctx.shadowColor = colors.nodeSelected
  ctx.shadowBlur = 6

  // Draw premium pill-shaped indicator
  ctx.fillStyle = colors.nodeSelected
  ctx.globalAlpha = 0.6

  // Rounded rectangle (pill shape)
  const pillWidth = 20
  const pillHeight = 4
  const pillRadius = pillHeight / 2

  ctx.beginPath()
  ctx.moveTo(centerX - pillWidth / 2 + pillRadius, indicatorY)
  ctx.lineTo(centerX + pillWidth / 2 - pillRadius, indicatorY)
  ctx.arc(centerX + pillWidth / 2 - pillRadius, indicatorY + pillRadius, pillRadius, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(centerX - pillWidth / 2 + pillRadius, indicatorY + pillHeight)
  ctx.arc(centerX - pillWidth / 2 + pillRadius, indicatorY + pillRadius, pillRadius, Math.PI / 2, -Math.PI / 2)
  ctx.closePath()
  ctx.fill()

  // Reset
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// drawBoxSelectionRect
// ---------------------------------------------------------------------------

/** Box selection rect in world coordinates. */
export interface BoxRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Draw the animated dashed box-selection rectangle.
 *
 * Pure function — receives pre-computed box rect and count.
 *
 * @param ctx            - 2D canvas rendering context.
 * @param boxRect        - The world-space selection rectangle.
 * @param camera         - Current camera (used for zoom-invariant sizing).
 * @param selectedCount  - Number of nodes currently inside the box (for badge).
 * @param colors         - Overlay color palette.
 */
export function drawBoxSelectionRect(
  ctx: CanvasRenderingContext2D,
  boxRect: BoxRect,
  camera: Camera,
  selectedCount: number,
  colors: OverlayColors
): void {
  const { x, y, width, height } = boxRect
  const radius = 4 / camera.zoom

  // Fill with semi-transparent teal (rounded corners)
  ctx.fillStyle = 'rgba(0, 210, 190, 0.08)'
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fill()

  // Animated dashed border with teal
  ctx.strokeStyle = colors.nodeSelected
  ctx.lineWidth = 1 / camera.zoom
  const dashSize = 4 / camera.zoom
  ctx.setLineDash([dashSize, dashSize])
  ctx.lineDashOffset = -(performance.now() / 50) % (dashSize * 2)
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineDashOffset = 0

  // Selected count badge (if nodes are being selected)
  if (selectedCount > 0) {
    const badgeX = x + width
    const badgeY = y - 12 / camera.zoom
    const fontSize = 10 / camera.zoom
    ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`
    const text = selectedCount.toString()
    const metrics = ctx.measureText(text)
    const badgeW = Math.max(metrics.width + 8 / camera.zoom, 16 / camera.zoom)
    const badgeH = 14 / camera.zoom

    ctx.fillStyle = colors.nodeSelected
    ctx.beginPath()
    ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, badgeH / 2)
    ctx.fill()

    ctx.fillStyle = '#0A0A0C'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, badgeX, badgeY)
  }
}

// ---------------------------------------------------------------------------
// drawConnectionPreviewLine
// ---------------------------------------------------------------------------

/**
 * Draw the animated bezier preview line during connection creation.
 *
 * Pure function — all state is passed as parameters.
 *
 * @param ctx          - 2D canvas rendering context.
 * @param sourceNode   - The node where the connection originates.
 * @param previewEnd   - The current mouse/touch position in world space.
 * @param sourceAnchor - The anchor on the source node (or null for boundary calc).
 * @param snapTarget   - Currently snapped anchor target (or null).
 * @param colors       - Overlay color palette.
 */
export function drawConnectionPreviewLine(
  ctx: CanvasRenderingContext2D,
  sourceNode: Node,
  previewEnd: Point,
  sourceAnchor: Anchor | null,
  snapTarget: SnapTarget | null,
  colors: OverlayColors
): void {
  // Use anchor point if available, otherwise calculate from node boundary
  let sourcePoint: Point
  if (sourceAnchor) {
    sourcePoint = getAnchorPoint(sourceNode, sourceAnchor)
  } else {
    sourcePoint = getEdgeIntersection(sourceNode, previewEnd)
  }

  // Determine target point - snap to anchor if available
  const targetPoint: Point = snapTarget ? snapTarget.point : previewEnd

  // Control points via shared utility
  const snapAnchor = snapTarget?.anchor ?? null
  const { cx1, cy1, cx2, cy2 } = calculateBezierControlPoints(
    sourcePoint, targetPoint, sourceAnchor, snapAnchor
  )

  // Subtle glow effect
  ctx.shadowColor = colors.nodeSelected
  ctx.shadowBlur = 8

  // Draw bezier curve with animated dashes
  ctx.strokeStyle = colors.nodeSelected
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  const dashOffset = -(performance.now() / 40) % 14
  ctx.lineDashOffset = dashOffset
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.8

  ctx.beginPath()
  ctx.moveTo(sourcePoint.x, sourcePoint.y)
  ctx.bezierCurveTo(cx1, cy1, cx2, cy2, targetPoint.x, targetPoint.y)
  ctx.stroke()

  // Draw end indicator
  ctx.globalAlpha = 1
  ctx.fillStyle = colors.nodeSelected

  if (snapTarget) {
    // Snapped: draw premium ring indicator
    ctx.beginPath()
    ctx.arc(targetPoint.x, targetPoint.y, 8, 0, Math.PI * 2)
    ctx.fill()

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.arc(targetPoint.x - 1, targetPoint.y - 1, 3, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Not snapped: small dot
    ctx.beginPath()
    ctx.arc(targetPoint.x, targetPoint.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Reset
  ctx.setLineDash([])
  ctx.lineDashOffset = 0
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}
