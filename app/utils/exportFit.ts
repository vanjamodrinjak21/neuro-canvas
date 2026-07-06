// Pure fit-bounds math for raster (PNG/JPG) map export.
//
// The old export path screenshotted the live canvas element, so the output
// inherited the current camera, zoom, device pixel ratio and the 360px
// detail-panel occlusion — maps came out cropped and soft. These helpers
// compute (1) the full content bounding box of a map (nodes + edge geometry)
// and (2) a supersampled canvas size + transform that fits that box entirely,
// independent of any viewport state.
//
// Everything here is pure and unit-tested (see __tests__/exportFit.test.ts).

import type { Node, Edge } from '~/types/canvas'
import {
  resolveEdgeEndpoints,
  calculateBezierControlPoints,
} from '~/components/canvas/renderers/shared'

/** Axis-aligned bounding box in content (world) space. */
export interface ContentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ExportFitOptions {
  /**
   * Breathing room added on every side, in content-space pixels. Also absorbs
   * small overshoots the bounds don't model exactly (arrow heads ≤10px, the
   * root-indicator pill 16px above the root node, edge glow).
   */
  padding?: number
  /** Minimum sharpness multiplier applied to the fitted size (default 2). */
  supersample?: number
  /**
   * The display's devicePixelRatio. Multiplied into the supersample factor so
   * hi-dpi users get output at least as dense as their screen. Clamped to
   * [1, 2] so a 3x phone screen doesn't triple the pixel budget.
   */
  devicePixelRatio?: number
  /**
   * Total pixel budget. Default 16_777_216 (16.7MP) — sharp for any normal
   * map yet safely under WKWebView's historical canvas-area limits (the
   * desktop app runs in WKWebView via Tauri, mobile via Capacitor). Huge maps
   * scale down gracefully instead of failing to rasterize.
   */
  maxPixels?: number
  /** Per-side length cap in pixels (browser canvas dimension limit guard). */
  maxSide?: number
}

/** Canvas size and content→pixel transform for an export render. */
export interface ExportFit {
  /** Export canvas width in device pixels. */
  width: number
  /** Export canvas height in device pixels. */
  height: number
  /** Multiplier from content units to device pixels. */
  scale: number
  /** Pass to `ctx.setTransform(scale, 0, 0, scale, translateX, translateY)`. */
  translateX: number
  /** See {@link ExportFit.translateX}. */
  translateY: number
}

export const EXPORT_PADDING = 48
export const EXPORT_SUPERSAMPLE = 2
export const EXPORT_MAX_PIXELS = 16_777_216
export const EXPORT_MAX_SIDE = 8_192

/**
 * Compute the bounding box of every node rectangle plus every edge's actual
 * drawn geometry. Edge endpoints sit on node borders, but bezier control
 * points can extend up to 80px beyond a node's side (see
 * `calculateBezierControlPoints`), and the rendered curve is always contained
 * in the convex hull of its endpoints + control points — so including the
 * control points guarantees no curve is clipped. Custom `edge.controlPoints`
 * are included for the same reason.
 *
 * Returns `null` for an empty map.
 */
export function computeContentBounds(
  nodes: Map<string, Node>,
  edges: Iterable<Edge>,
): ContentBounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const extend = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  for (const node of nodes.values()) {
    extend(node.position.x, node.position.y)
    extend(node.position.x + node.size.width, node.position.y + node.size.height)
  }

  for (const edge of edges) {
    const sourceNode = nodes.get(edge.sourceId)
    const targetNode = nodes.get(edge.targetId)
    if (!sourceNode || !targetNode) continue

    const { sourcePoint, targetPoint, sourceAnchor, targetAnchor } = resolveEdgeEndpoints(
      sourceNode, targetNode, edge.sourceAnchor, edge.targetAnchor,
    )
    extend(sourcePoint.x, sourcePoint.y)
    extend(targetPoint.x, targetPoint.y)

    if (edge.style.type === 'bezier') {
      const { cx1, cy1, cx2, cy2 } = calculateBezierControlPoints(
        sourcePoint, targetPoint, sourceAnchor, targetAnchor,
      )
      extend(cx1, cy1)
      extend(cx2, cy2)
    }

    if (edge.controlPoints) {
      for (const p of edge.controlPoints) extend(p.x, p.y)
    }
  }

  if (minX === Infinity) return null
  return { minX, minY, maxX, maxY }
}

/**
 * Fit padded content bounds into a supersampled export canvas.
 *
 * The scale starts at `supersample × clamp(devicePixelRatio, 1, 2)` (≥2x for
 * crisp text and edges) and is reduced — never the content cropped — when the
 * result would exceed the total pixel budget or a per-side canvas limit.
 */
export function computeExportFit(
  bounds: ContentBounds,
  options: ExportFitOptions = {},
): ExportFit {
  const padding = options.padding ?? EXPORT_PADDING
  const supersample = options.supersample ?? EXPORT_SUPERSAMPLE
  const maxPixels = options.maxPixels ?? EXPORT_MAX_PIXELS
  const maxSide = options.maxSide ?? EXPORT_MAX_SIDE
  const dpr = Math.min(2, Math.max(1, options.devicePixelRatio ?? 1))

  const contentW = Math.max(0, bounds.maxX - bounds.minX)
  const contentH = Math.max(0, bounds.maxY - bounds.minY)
  const paddedW = contentW + padding * 2
  const paddedH = contentH + padding * 2

  const baseScale = supersample * dpr
  const budgetScale = Math.sqrt(maxPixels / (paddedW * paddedH))
  const sideScale = Math.min(maxSide / paddedW, maxSide / paddedH)
  const scale = Math.max(Math.min(baseScale, budgetScale, sideScale), 1e-4)

  return {
    width: Math.max(1, Math.floor(paddedW * scale)),
    height: Math.max(1, Math.floor(paddedH * scale)),
    scale,
    translateX: (padding - bounds.minX) * scale,
    translateY: (padding - bounds.minY) * scale,
  }
}
