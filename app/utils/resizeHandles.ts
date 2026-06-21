// Pure geometry for interactive node resizing. Shared by the renderer
// (which draws the 8 handles) and the interaction layer (which hit-tests
// them and computes the resized rectangle). Keeping the handle positions
// and the resize math in one place guarantees the square you grab is the
// square that moves.

import type { Node, Point } from '~/types/canvas'

/** The eight resize grips: four corners + four edge midpoints. */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** Corners first so they win hit-testing over edge handles on small nodes. */
export const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Which edges a handle drives, per axis:
 *  -1 → the left/top edge moves (right/bottom stays anchored)
 *   1 → the right/bottom edge moves (left/top stays anchored)
 *   0 → that axis is fixed (edge handles), unless scaling proportionally
 */
const HANDLE_DIRS: Record<ResizeHandle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
}

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
}

/** CSS cursor name for the given handle. */
export function getHandleCursor(handle: ResizeHandle): string {
  return HANDLE_CURSORS[handle]
}

/** World-space positions of every handle around a node's bounding box. */
export function getHandlePoints(node: Node): Record<ResizeHandle, Point> {
  const { x, y } = node.position
  const { width: w, height: h } = node.size
  return {
    nw: { x, y },
    n: { x: x + w / 2, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: y + h / 2 },
  }
}

/**
 * Return the handle under `worldPos`, or null. The hit box is a fixed
 * `screenHitSize` pixels regardless of zoom, so the grips stay easy to
 * grab when zoomed far out (and don't balloon when zoomed in).
 *
 * Two safeguards keep neighbouring grips from stealing each other:
 *  - the half-extent is clamped to under half the node's smaller side, so
 *    the hit boxes can never overlap or blanket the whole node on tiny nodes;
 *  - when more than one box still contains the point, the NEAREST handle
 *    wins (corner-first ordering only breaks exact ties), so a click on a
 *    visibly separate edge grip never resolves to an adjacent corner.
 */
export function hitTestResizeHandle(
  node: Node,
  worldPos: Point,
  zoom: number,
  screenHitSize = 14
): ResizeHandle | null {
  const rawHalf = screenHitSize / zoom / 2
  // Never let a grip's catch area exceed (just under) half the node's
  // smaller dimension, or adjacent handles would overlap.
  const maxHalf = Math.min(node.size.width, node.size.height) / 2 - 0.5
  const half = Math.max(0, Math.min(rawHalf, maxHalf))
  const pts = getHandlePoints(node)

  let best: ResizeHandle | null = null
  let bestDist = Infinity
  for (const handle of RESIZE_HANDLES) {
    const p = pts[handle]
    const dx = Math.abs(worldPos.x - p.x)
    const dy = Math.abs(worldPos.y - p.y)
    if (dx <= half && dy <= half) {
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        best = handle
      }
    }
  }
  return best
}

export interface ResizeOptions {
  /** Shift held → preserve the original aspect ratio. */
  proportional: boolean
  minWidth: number
  minHeight: number
}

/**
 * Compute the new bounding rectangle for a node being resized by `handle`,
 * given the original rect `o` and the current pointer position `mouse`.
 *
 * Free (non-proportional) resize: the dragged edge(s) follow the pointer
 * while the opposite edge stays anchored; min-size clamps prevent the box
 * from inverting.
 *
 * Proportional resize (Shift):
 *  - Corner handles scale uniformly from the opposite corner — the size
 *    follows the dominant axis so the grip tracks the pointer without ever
 *    breaking the original aspect ratio.
 *  - Edge handles scale the perpendicular axis to match and keep the node
 *    centered on the unchanged axis, so it grows symmetrically.
 */
export function computeResizedRect(
  handle: ResizeHandle,
  o: Rect,
  mouse: Point,
  opts: ResizeOptions
): Rect {
  const { minWidth: minW, minHeight: minH } = opts
  const dir = HANDLE_DIRS[handle]

  const left = o.x
  const top = o.y
  const right = o.x + o.width
  const bottom = o.y + o.height

  // --- Free-resize edges (clamped so the box can't cross its anchor) ---
  let nLeft = left
  let nRight = right
  let nTop = top
  let nBottom = bottom
  if (dir.x === -1) nLeft = Math.min(mouse.x, right - minW)
  if (dir.x === 1) nRight = Math.max(mouse.x, left + minW)
  if (dir.y === -1) nTop = Math.min(mouse.y, bottom - minH)
  if (dir.y === 1) nBottom = Math.max(mouse.y, top + minH)

  let w = nRight - nLeft
  let h = nBottom - nTop

  if (opts.proportional && o.width > 0 && o.height > 0) {
    const aspect = o.width / o.height
    const isCorner = dir.x !== 0 && dir.y !== 0

    if (isCorner) {
      // Scale uniformly, driven by whichever axis the pointer moved more
      // (in relative terms). Using the larger deviation from 1 — rather than
      // the larger ratio — keeps the dragged axis tracking the cursor for
      // both growing and shrinking, instead of stalling on shrink.
      const rw = w / o.width
      const rh = h / o.height
      const scale = Math.abs(rw - 1) >= Math.abs(rh - 1) ? rw : rh
      w = o.width * scale
      h = o.height * scale
    } else if (dir.x !== 0) {
      // Horizontal edge drives width; height follows.
      h = w / aspect
    } else {
      // Vertical edge drives height; width follows.
      w = h * aspect
    }

    // Re-clamp to min size while preserving the aspect ratio.
    if (w < minW) {
      w = minW
      h = w / aspect
    }
    if (h < minH) {
      h = minH
      w = h * aspect
    }
  }

  // --- Place the rect so the anchored side(s) stay put ---
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  let x: number
  let y: number
  if (dir.x === -1) x = right - w
  else if (dir.x === 1) x = left
  else x = opts.proportional ? centerX - w / 2 : left

  if (dir.y === -1) y = bottom - h
  else if (dir.y === 1) y = top
  else y = opts.proportional ? centerY - h / 2 : top

  return { x, y, width: w, height: h }
}
