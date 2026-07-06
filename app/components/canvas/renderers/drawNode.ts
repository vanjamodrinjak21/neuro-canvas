import type { Node } from '~/types/canvas'
import { getShapePath } from './shapes'
import { getNodeMetrics, NODE_FONT_FAMILY } from '~/utils/nodeSizing'

/** Visual state of a node on the canvas. */
export type NodeState = 'normal' | 'hover' | 'selected' | 'dragging' | 'ai-suggestion' | 'highlighted' | 'dimmed'

/** Color palette required by node drawing functions. */
export interface NodeColors {
  nodeBg: string
  nodeBorder: string
  nodeTier2Bg: string
  nodeTier1Border: string
  nodeTier2Border: string
  nodeText: string
  nodeSelected: string
  nodeGlow: string
  nodeHoverBorder: string
  nodeAiGlow: string
  nodeHighlightGlow: string
}

// Saturated teal `#00D2BE` was the legacy default `style.borderColor` baked
// into every generated node. Treat it as "no explicit override" so the
// theme's tier-derived defaults can take effect on existing maps.
const LEGACY_DEFAULT_BORDERS = new Set(['#00D2BE', '#00d2be', '#00D2BEFF', '#00d2beff'])

// Dark-mode default text colors baked into every node by mapStore /
// properties panels. Treat as "no explicit override" so light mode can
// fall back to the theme's high-contrast text color on white nodes.
const LEGACY_DEFAULT_TEXT_COLORS = new Set([
  '#FAFAFA', '#fafafa', '#FAFAFAFF', '#fafafaff',
  '#E8E8EC', '#e8e8ec', '#E8E8ECFF', '#e8e8ecff',
])

// Category accent strip palette (matches Paper artboard CEO-0).
const CATEGORY_STRIP_COLORS: Record<string, string> = {
  idea: '#A78BFA',
  task: '#60A5FA',
  note: '#34D399',
  question: '#F472B6',
  evidence: '#F59E0B',
  default: '',
}

// Text-wrap layout cache (AER-82). Wrapping runs ctx.measureText per WORD per
// node per FRAME — the dominant full-LOD render cost on large maps. The layout
// depends only on (font, available width, content), so cache computed lines.
// Bounded by insertion-order eviction; edits/resizes re-key naturally.
const MAX_WRAP_CACHE = 2000
const wrapCache = new Map<string, string[]>()

function wrapNodeText(
  ctx: CanvasRenderingContext2D,
  content: string,
  font: string,
  maxWidth: number
): string[] {
  const key = `${font}|${maxWidth}|${content}`
  const cached = wrapCache.get(key)
  if (cached) return cached

  const words = content.split(' ')
  const lines: string[] = []
  let currentLine = ''
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const m = ctx.measureText(testLine)
    if (m.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  if (wrapCache.size >= MAX_WRAP_CACHE) {
    const oldest = wrapCache.keys().next().value
    if (oldest !== undefined) wrapCache.delete(oldest)
  }
  wrapCache.set(key, lines)
  return lines
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
 * @param isLight         - Whether the light theme is active (affects hover fill blend target).
 * @param parentIsRoot    - Whether the direct parent of this node is the root node (for tier-2+ differentiation).
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
  animProps?: NodeAnimProps,
  isLight?: boolean,
  parentIsRoot?: boolean,
  textScale: number = 1
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

  // Treat legacy hard-coded teal borders as "no explicit override" so tier
  // defaults from the theme take effect on existing maps.
  const explicitBorder = style.borderColor && !LEGACY_DEFAULT_BORDERS.has(style.borderColor)
    ? style.borderColor
    : null
  const explicitFill = style.fillColor && style.fillColor !== '#111113' ? style.fillColor : null

  // Determine border color and width based on state - with interpolated hover
  let borderColor: string
  let borderWidth = explicitBorder ? (style.borderWidth || 1) : 1
  let fillColor: string

  if (isRoot) {
    // Root: solid teal fill, no border (Paper CEO-0 "ROOT NODE")
    fillColor = colors.nodeSelected
    borderColor = colors.nodeSelected
    borderWidth = 0
  } else if (node.parentId && parentIsRoot) {
    // Tier-1: dark fill, subtle teal hint stroke (Paper CEO-0 "TIER 1")
    fillColor = explicitFill || colors.nodeBg
    borderColor = explicitBorder || colors.nodeTier1Border
  } else {
    // Tier-2+: deeper dark fill, near-invisible neutral stroke (Paper CEO-0 "TIER 2+")
    fillColor = explicitFill || colors.nodeTier2Bg
    borderColor = explicitBorder || colors.nodeTier2Border
  }

  // Interpolated hover: blend border + fill toward hover targets.
  // Light hover fill is a warm-paper tint that's distinct from the
  // resting #FFF and from the resting #D4D4D0 border, so the hover
  // change is felt instead of hidden behind the border.
  if (hoverProg > 0 && nodeState !== 'selected' && nodeState !== 'dragging' && !isRoot) {
    borderColor = lerpColor(borderColor, colors.nodeHoverBorder, hoverProg)
    fillColor = lerpColor(fillColor, isLight ? '#F4F4F0' : '#1E1E24', hoverProg)
  }

  switch (nodeState) {
    case 'selected':
      if (!isRoot) {
        borderColor = colors.nodeSelected
        borderWidth = 2
      }
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
      borderWidth = Math.max(borderWidth, 1.5)
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

  const shapePath = getShapePath(style.shape || 'rounded', drawX, drawY, drawWidth, drawHeight)
  ctx.fill(shapePath)
  if (borderWidth > 0) ctx.stroke(shapePath)

  // Category accent strip on left edge (non-root only) — matches Paper CEO-0.
  const category = !isRoot ? (node.metadata?.category as string | undefined) : undefined
  if (category) {
    const stripColor = CATEGORY_STRIP_COLORS[category.toLowerCase()] || CATEGORY_STRIP_COLORS[category]
    if (stripColor) {
      ctx.save()
      ctx.clip(shapePath)
      ctx.fillStyle = stripColor
      ctx.fillRect(drawX, drawY, 3, drawHeight)
      ctx.restore()
    }
  }

  // Animated selection ring — grows from center based on selectionProgress
  if (selProg > 0) {
    const ringExpand = selProg * 3
    ctx.strokeStyle = colors.nodeSelected
    ctx.lineWidth = 1
    ctx.globalAlpha = selProg * 0.8
    const ringPath = getShapePath(
      style.shape || 'rounded',
      drawX - ringExpand,
      drawY - ringExpand,
      drawWidth + ringExpand * 2,
      drawHeight + ringExpand * 2
    )
    ctx.stroke(ringPath)
    ctx.globalAlpha = 1
  }

  // Reset line dash if it was set
  ctx.setLineDash([])

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // Draw text — root node always uses white text for contrast on teal bg.
  // For non-root nodes, ignore baked-in dark-mode default text colors so
  // light theme can supply a high-contrast color on white node fills.
  const explicitText = style.textColor && !LEGACY_DEFAULT_TEXT_COLORS.has(style.textColor)
    ? style.textColor
    : null
  ctx.fillStyle = isRoot ? '#FAFAFA' : (explicitText || colors.nodeText)
  // Apply the global Settings → Font Size preference. `textScale` is
  // sourced from `--nc-text-scale` (xs=0.85 .. xl=1.25) by useTextScale
  // and threaded through useRenderLoop. Multiplying here scales every
  // node's text without touching the per-node style.fontSize stored on
  // the document. min(8px) so xs+tiny-font doesn't disappear.
  const baseFontSize = style.fontSize || 14
  const fontSize = Math.max(8, Math.round(baseFontSize * textScale))
  const fontWeight = style.fontWeight || 500
  ctx.font = `${fontWeight} ${fontSize}px ${NODE_FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Wrap using the same padding the sizer used so text fits exactly.
  // Layout is cached across frames (AER-82) — see wrapNodeText.
  const metrics = getNodeMetrics(fontSize)
  const maxWidth = drawWidth - metrics.paddingX
  const lines = wrapNodeText(ctx, node.content, ctx.font, maxWidth)

  const lineHeight = metrics.lineHeight
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

  const shapePath = getShapePath(style.shape || 'rounded', x, y, width, height)
  ctx.fill(shapePath)
  ctx.stroke(shapePath)
}
