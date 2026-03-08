import type { Node } from '~/types/canvas'

/** Visual state of a node on the canvas. */
export type NodeState = 'normal' | 'hover' | 'selected' | 'dragging' | 'ai-suggestion' | 'highlighted' | 'dimmed'

/** Color palette required by node drawing functions. */
export interface NodeColors {
  nodeBg: string
  nodeBorder: string
  nodeText: string
  nodeSelected: string
  nodeGlow: string
  nodeHoverBorder: string
  nodeAiGlow: string
  nodeHighlightGlow: string
}

/** Subset of colors used by the simplified node renderer. */
export interface NodeColorsSimplified {
  nodeBg: string
  nodeBorder: string
  nodeSelected: string
}

/** Interpolated animation properties driven by the animation composable. */
export interface NodeAnimProps {
  hoverProgress?: number
  selectionProgress?: number
}

/**
 * Draw a single node with full styling, text wrapping, and state-driven
 * visual feedback (selection ring, drag shadow, hover interpolation, etc.).
 *
 * This is a **pure** rendering function — it reads nothing from Vue refs,
 * stores, or composables. Every piece of data it needs is passed explicitly
 * so it can be unit-tested and reused outside the main canvas component.
 *
 * @param ctx             - The 2D rendering context to draw into.
 * @param node            - The node data (position, size, content, style).
 * @param nodeState       - Pre-computed visual state for this node.
 * @param colors          - Theme color palette for nodes.
 * @param isDragging      - Whether the canvas is currently in a drag gesture.
 * @param isSelected      - Whether this particular node belongs to the current selection (used for dim logic during drag).
 * @param isRoot          - Whether this node is the root / main-topic node.
 * @param lerpColor       - A function that linearly interpolates between two CSS color strings.
 * @param animProps       - Optional animation interpolation values (hover, selection).
 */
export function drawNode(
  ctx: CanvasRenderingContext2D,
  node: Node,
  nodeState: NodeState,
  colors: NodeColors,
  isDragging: boolean,
  isSelected: boolean,
  isRoot: boolean,
  lerpColor: (a: string, b: string, t: number) => string,
  animProps?: NodeAnimProps
) {
  const { x, y } = node.position
  const { width, height } = node.size
  const style = node.style

  // Handle dimmed state early
  if (nodeState === 'dimmed') {
    ctx.globalAlpha = 0.4
  }

  const drawX = x
  const drawY = y
  const drawWidth = width
  const drawHeight = height

  // Get interpolated animation state
  const hoverProg = animProps?.hoverProgress ?? 0
  const selProg = animProps?.selectionProgress ?? 0

  // Enhanced drag feedback — shadow grows, scale slightly up
  if (nodeState === 'dragging') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 6
    ctx.shadowOffsetX = 0
  }

  // Determine border color and width based on state - with interpolated hover
  let borderColor = style.borderColor || colors.nodeBorder
  let borderWidth = style.borderWidth || 2
  let fillColor = style.fillColor || colors.nodeBg

  // Ensure minimum visibility - root nodes always have 2px border
  if (borderWidth < 2) borderWidth = 2
  if (isRoot) borderWidth = Math.max(borderWidth, 2)

  // Interpolated hover: blend border color and fill based on hoverProgress
  if (hoverProg > 0 && nodeState !== 'selected' && nodeState !== 'dragging') {
    borderColor = lerpColor(style.borderColor || colors.nodeBorder, colors.nodeHoverBorder, hoverProg)
    fillColor = lerpColor(style.fillColor || colors.nodeBg, '#1E1E24', hoverProg)
  }

  switch (nodeState) {
    case 'selected':
      borderColor = colors.nodeSelected
      break
    case 'hover':
      // Already handled by interpolated hover above
      break
    case 'ai-suggestion':
      borderColor = colors.nodeSelected
      borderWidth = 1
      fillColor = 'transparent'
      ctx.setLineDash([6, 4])
      break
    case 'highlighted':
      borderColor = colors.nodeSelected
      break
  }

  // Dim non-dragged nodes while dragging
  if (isDragging && nodeState !== 'dragging' && isSelected) {
    ctx.globalAlpha *= 0.7
  }

  // Draw shape
  ctx.fillStyle = fillColor
  ctx.strokeStyle = borderColor
  ctx.lineWidth = borderWidth

  const radius = style.shape === 'circle' ? Math.min(drawWidth, drawHeight) / 2 : 8

  if (style.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(drawX + drawWidth / 2, drawY + drawHeight / 2, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (style.shape === 'diamond') {
    ctx.beginPath()
    ctx.moveTo(drawX + drawWidth / 2, drawY)
    ctx.lineTo(drawX + drawWidth, drawY + drawHeight / 2)
    ctx.lineTo(drawX + drawWidth / 2, drawY + drawHeight)
    ctx.lineTo(drawX, drawY + drawHeight / 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    // Rounded rectangle
    ctx.beginPath()
    ctx.roundRect(drawX, drawY, drawWidth, drawHeight, radius)
    ctx.fill()
    ctx.stroke()
  }

  // Animated selection ring — grows from center based on selectionProgress
  if (selProg > 0) {
    const ringExpand = selProg * 3
    ctx.strokeStyle = colors.nodeSelected
    ctx.lineWidth = 1
    ctx.globalAlpha = selProg * 0.8
    ctx.beginPath()
    ctx.roundRect(drawX - ringExpand, drawY - ringExpand, drawWidth + ringExpand * 2, drawHeight + ringExpand * 2, radius + ringExpand)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Reset line dash if it was set
  ctx.setLineDash([])

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // Draw text
  ctx.fillStyle = style.textColor || colors.nodeText
  ctx.font = `${style.fontWeight || 500} ${style.fontSize || 14}px "Inter", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Text wrapping
  const maxWidth = drawWidth - 24
  const words = node.content.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  const lineHeight = (style.fontSize || 14) * 1.4
  const textY = drawY + drawHeight / 2 - ((lines.length - 1) * lineHeight) / 2

  lines.forEach((line, index) => {
    ctx.fillText(line, drawX + drawWidth / 2, textY + index * lineHeight)
  })

  // Reset alpha
  ctx.globalAlpha = 1
}

/**
 * Draw a simplified node representation used at mid-zoom levels (LOD).
 *
 * Only renders the filled shape with a border stroke — no text, shadows,
 * glow, or animation effects. This keeps the frame budget low when many
 * nodes are visible but too small to read.
 *
 * @param ctx      - The 2D rendering context to draw into.
 * @param node     - The node data (position, size, style).
 * @param isSelected - Whether this node is currently selected.
 * @param colors   - Minimal color palette (background + border + selected).
 */
export function drawNodeSimplified(
  ctx: CanvasRenderingContext2D,
  node: Node,
  isSelected: boolean,
  colors: NodeColorsSimplified
) {
  const { x, y } = node.position
  const { width, height } = node.size
  const style = node.style

  ctx.fillStyle = style.fillColor || colors.nodeBg
  ctx.strokeStyle = isSelected ? colors.nodeSelected : (style.borderColor || colors.nodeBorder)
  ctx.lineWidth = isSelected ? 2 : 1

  const radius = style.shape === 'circle' ? Math.min(width, height) / 2 : 6
  if (style.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    ctx.fill()
    ctx.stroke()
  }
}
