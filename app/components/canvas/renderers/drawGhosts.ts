/**
 * Ghost node and pulse effect rendering functions.
 *
 * Pure rendering helpers with no external dependencies — all data
 * is passed in through parameters so the functions stay composable
 * and easy to test.
 */

/** Snapshot of a node captured at the moment of deletion. */
interface GhostSnapshot {
  position: { x: number; y: number }
  size: { width: number; height: number }
  style: {
    fillColor?: string
    borderColor?: string
    borderWidth?: number
    shape?: string
    textColor?: string
    fontWeight?: number
    fontSize?: number
  }
  content: string
}

/** A ghost entry representing an exiting (deleted) node. */
interface Ghost {
  opacity: number
  offsetY: number
  scale: number
  snapshot: GhostSnapshot
}

/** A single expanding ring inside a pulse effect. */
interface PulseRing {
  radius: number
  opacity: number
}

/** A pulse effect anchored to a specific node. */
interface Pulse {
  nodeId: string
  rings: PulseRing[]
}

/** Minimal node geometry needed to position pulse rings. */
interface NodeGeometry {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

/**
 * Draw ghost nodes that fade out after deletion.
 *
 * Each ghost carries a frozen snapshot of the original node's appearance.
 * The rendering applies the ghost's current `opacity`, `scale`, and
 * vertical `offsetY` drift so the node appears to dissolve upward.
 *
 * @param ctx    - The 2D canvas rendering context (already world-transformed).
 * @param ghosts - Array of ghost entries produced by the node-animation system.
 * @param colors - Fallback colours used when the snapshot has no explicit style.
 */
export function drawGhostNodes(
  ctx: CanvasRenderingContext2D,
  ghosts: Ghost[],
  colors: { nodeBg: string; nodeBorder: string; nodeText: string }
): void {
  for (const ghost of ghosts) {
    ctx.save()
    ctx.globalAlpha = ghost.opacity

    const snap = ghost.snapshot
    const cx = snap.position.x + snap.size.width / 2
    const cy = snap.position.y + snap.size.height / 2

    // Apply drift + scale around the node centre
    ctx.translate(cx, cy + ghost.offsetY)
    ctx.scale(ghost.scale, ghost.scale)
    ctx.translate(-cx, -cy)

    // --- Shape -----------------------------------------------------------
    ctx.fillStyle = snap.style.fillColor || colors.nodeBg
    ctx.strokeStyle = snap.style.borderColor || colors.nodeBorder
    ctx.lineWidth = snap.style.borderWidth || 2

    const radius =
      snap.style.shape === 'circle'
        ? Math.min(snap.size.width, snap.size.height) / 2
        : 8

    if (snap.style.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(
        snap.position.x + snap.size.width / 2,
        snap.position.y + snap.size.height / 2,
        radius,
        0,
        Math.PI * 2
      )
      ctx.fill()
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.roundRect(
        snap.position.x,
        snap.position.y,
        snap.size.width,
        snap.size.height,
        radius
      )
      ctx.fill()
      ctx.stroke()
    }

    // --- Text ------------------------------------------------------------
    ctx.fillStyle = snap.style.textColor || colors.nodeText
    ctx.font = `${snap.style.fontWeight || 500} ${snap.style.fontSize || 14}px "Inter", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      snap.content,
      snap.position.x + snap.size.width / 2,
      snap.position.y + snap.size.height / 2
    )

    ctx.restore()
  }
}

/**
 * Draw expanding pulse rings around nodes.
 *
 * Each pulse contains one or more concentric rings that grow outward from
 * the node centre. The ring stroke uses `accentColor` at a reduced opacity
 * so it blends smoothly with the canvas background.
 *
 * @param ctx         - The 2D canvas rendering context (already world-transformed).
 * @param pulses      - Active pulse entries produced by the node-animation system.
 * @param nodes       - Map of node geometries keyed by node ID. Pulses whose
 *                      `nodeId` is missing from the map are silently skipped.
 * @param accentColor - Stroke colour for the pulse rings (e.g. selection teal).
 */
export function drawPulseEffects(
  ctx: CanvasRenderingContext2D,
  pulses: Pulse[],
  nodes: Map<string, NodeGeometry>,
  accentColor: string
): void {
  for (const pulse of pulses) {
    const node = nodes.get(pulse.nodeId)
    if (!node) continue

    const cx = node.position.x + node.size.width / 2
    const cy = node.position.y + node.size.height / 2
    const baseRadius = Math.max(node.size.width, node.size.height) / 2

    for (const ring of pulse.rings) {
      ctx.beginPath()
      ctx.arc(cx, cy, baseRadius + ring.radius, 0, Math.PI * 2)
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 2
      ctx.globalAlpha = ring.opacity * 0.4
      ctx.stroke()
    }

    ctx.globalAlpha = 1
  }
}
