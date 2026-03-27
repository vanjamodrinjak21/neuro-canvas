import type { Node, Edge } from '~/types/canvas'
import { radialTreeLayout, type LayoutPosition } from '~/utils/radialTreeLayout'

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

    // Calculate canvas dimensions
    let maxX = 0
    let maxY = 0
    for (const pos of positions.values()) {
      maxX = Math.max(maxX, pos.x + 200) // account for node width
      maxY = Math.max(maxY, pos.y + 60)   // account for node height
    }

    const width = Math.max(maxX + 100, 800)
    const height = Math.max(maxY + 100, 600)
    const dpr = 2 // hi-dpi

    const canvas = document.createElement('canvas')
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#09090B'
    ctx.fillRect(0, 0, width, height)

    // Draw edges (bezier curves)
    ctx.strokeStyle = '#2A2A30'
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
      ctx.fillStyle = node.style.fillColor || '#111113'
      ctx.beginPath()
      ctx.roundRect(pos.x, pos.y, w, h, r)
      ctx.fill()

      // Node border
      ctx.strokeStyle = node.style.borderColor || '#27272A'
      ctx.lineWidth = node.style.borderWidth || 1.5
      ctx.beginPath()
      ctx.roundRect(pos.x, pos.y, w, h, r)
      ctx.stroke()

      // Root node accent glow
      if (node.isRoot) {
        ctx.strokeStyle = '#00D2BE'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(pos.x, pos.y, w, h, r)
        ctx.stroke()
      }

      // Node text
      const fontSize = node.style.fontSize || 14
      ctx.font = `${node.style.fontWeight || 500} ${fontSize}px 'Cabinet Grotesk', system-ui, sans-serif`
      ctx.fillStyle = node.style.textColor || '#FAFAFA'
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
