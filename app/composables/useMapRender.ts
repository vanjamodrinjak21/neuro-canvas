import type { Node, Edge } from '~/types/canvas'
import { radialTreeLayout } from '~/utils/radialTreeLayout'
import { computeExportFit, type ContentBounds } from '~/utils/exportFit'
import { getCanvasColors } from '~/composables/useCanvasTheme'

/**
 * Client-side PNG rendering of a mind map.
 * Uses an offscreen <canvas> with the radial tree layout.
 * Works fully offline — no server required.
 */
export function useMapRender() {
  /**
   * Render the map to a data URL (PNG).
   */
  async function renderToDataUrl(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    rootNodeId: string | null
  ): Promise<string> {
    const blob = await renderToBlob(nodes, edges, rootNodeId)
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * Render the map to a PNG blob.
   */
  async function renderToBlob(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    rootNodeId: string | null
  ): Promise<Blob> {
    // Compute radial layout
    const positions = radialTreeLayout(nodes, edges, rootNodeId)

    // Bounding box of the laid-out map using each node's REAL size — the old
    // code assumed 200×60 for every node, clipping wider nodes at the right/
    // bottom edge. Fitted through the shared export math so this render stays
    // in lockstep with the canvas raster export (48px padding, ≥2x
    // supersampling, graceful pixel cap for huge maps).
    let bounds: ContentBounds | null = null
    for (const [id, pos] of positions) {
      const node = nodes.get(id)
      const w = node?.size.width || 200
      const h = node?.size.height || 60
      if (!bounds) {
        bounds = { minX: pos.x, minY: pos.y, maxX: pos.x + w, maxY: pos.y + h }
      } else {
        bounds.minX = Math.min(bounds.minX, pos.x)
        bounds.minY = Math.min(bounds.minY, pos.y)
        bounds.maxX = Math.max(bounds.maxX, pos.x + w)
        bounds.maxY = Math.max(bounds.maxY, pos.y + h)
      }
    }
    const fit = computeExportFit(bounds ?? { minX: 0, minY: 0, maxX: 800, maxY: 600 }, {
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    })

    const isLight = typeof document !== 'undefined'
      && document.documentElement.classList.contains('light')
    const colors = getCanvasColors(isLight)

    const canvas = document.createElement('canvas')
    canvas.width = fit.width
    canvas.height = fit.height
    const ctx = canvas.getContext('2d')!

    // Theme-correct background token (dark #050508 / light #FAFAF9), painted
    // before any content so alpha-less encoders (JPEG) never see black.
    ctx.fillStyle = colors.canvasBg
    ctx.fillRect(0, 0, fit.width, fit.height)

    // Layout space → supersampled pixels
    ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.translateX, fit.translateY)

    // Draw edges (bezier curves)
    ctx.strokeStyle = colors.edgeDefault
    ctx.lineWidth = 2
    ctx.lineCap = 'round'

    for (const edge of edges.values()) {
      const sourcePos = positions.get(edge.sourceId)
      const targetPos = positions.get(edge.targetId)
      if (!sourcePos || !targetPos) continue

      const sourceNode = nodes.get(edge.sourceId)
      const targetNode = nodes.get(edge.targetId)

      // Center positions
      const sx = sourcePos.x + (sourceNode?.size.width ?? 120) / 2
      const sy = sourcePos.y + (sourceNode?.size.height ?? 40) / 2
      const tx = targetPos.x + (targetNode?.size.width ?? 120) / 2
      const ty = targetPos.y + (targetNode?.size.height ?? 40) / 2

      // Bezier control points
      const mx = (sx + tx) / 2
      const my = (sy + ty) / 2
      const dx = tx - sx
      const dy = ty - sy

      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.quadraticCurveTo(mx + dy * 0.15, my - dx * 0.15, tx, ty)
      ctx.stroke()
    }

    // Draw nodes (rounded rects with text)
    for (const node of nodes.values()) {
      const pos = positions.get(node.id)
      if (!pos) continue

      const w = node.size.width || 120
      const h = node.size.height || 40
      const r = 8 // border radius

      // Node background
      ctx.fillStyle = node.style.fillColor || colors.nodeBg
      ctx.beginPath()
      ctx.roundRect(pos.x, pos.y, w, h, r)
      ctx.fill()

      // Node border
      ctx.strokeStyle = node.style.borderColor || colors.nodeBorder
      ctx.lineWidth = node.style.borderWidth || 1.5
      ctx.beginPath()
      ctx.roundRect(pos.x, pos.y, w, h, r)
      ctx.stroke()

      // Root node accent glow
      if (node.isRoot) {
        ctx.strokeStyle = colors.accent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(pos.x, pos.y, w, h, r)
        ctx.stroke()
      }

      // Node text
      const fontSize = node.style.fontSize || 14
      ctx.font = `${node.style.fontWeight || 500} ${fontSize}px 'Cabinet Grotesk', system-ui, sans-serif`
      ctx.fillStyle = node.style.textColor || colors.nodeText
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Truncate text to fit
      const maxTextWidth = w - 16
      let displayText = node.content || ''
      const measured = ctx.measureText(displayText)
      if (measured.width > maxTextWidth) {
        while (displayText.length > 0 && ctx.measureText(displayText + '...').width > maxTextWidth) {
          displayText = displayText.slice(0, -1)
        }
        displayText += '...'
      }

      ctx.fillText(displayText, pos.x + w / 2, pos.y + h / 2)
    }

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/png'
      )
    })
  }

  /**
   * Download the rendered PNG.
   */
  async function downloadPng(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    rootNodeId: string | null,
    title: string
  ) {
    const blob = await renderToBlob(nodes, edges, rootNodeId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'mind-map'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return {
    renderToDataUrl,
    renderToBlob,
    downloadPng,
  }
}
