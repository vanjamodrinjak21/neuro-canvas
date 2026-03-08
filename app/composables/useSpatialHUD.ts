// Spatial HUD overlay — "You Are Here" display
// Shows current region name, visible/total node count, zoom %, distance to root
// Drawn in screen space

import type { Camera, Node, MapRegion } from '~/types/canvas'

interface HUDData {
  regionName: string | null
  visibleCount: number
  totalCount: number
  zoomPercent: number
  distanceToRoot: number | null
}

export function useSpatialHUD() {
  /**
   * Compute HUD data from current state
   */
  function computeHUD(
    camera: Camera,
    nodes: Map<string, Node>,
    visibleNodeIds: Set<string>,
    regions: MapRegion[],
    rootNodeId?: string
  ): HUDData {
    // Find current region (viewport center is in which region)
    const viewCenterX = -camera.x / camera.zoom + (window.innerWidth / camera.zoom) / 2
    const viewCenterY = -camera.y / camera.zoom + (window.innerHeight / camera.zoom) / 2

    let regionName: string | null = null
    let minDist = Infinity

    for (const region of regions) {
      const dx = viewCenterX - region.centerX
      const dy = viewCenterY - region.centerY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist) {
        minDist = dist
        regionName = region.label
      }
    }

    // Only show region if viewport center is close enough
    if (minDist > 500) regionName = null

    // Distance to root
    let distanceToRoot: number | null = null
    if (rootNodeId) {
      const root = nodes.get(rootNodeId)
      if (root) {
        const dx = viewCenterX - (root.position.x + root.size.width / 2)
        const dy = viewCenterY - (root.position.y + root.size.height / 2)
        distanceToRoot = Math.round(Math.sqrt(dx * dx + dy * dy))
      }
    }

    return {
      regionName,
      visibleCount: visibleNodeIds.size,
      totalCount: nodes.size,
      zoomPercent: Math.round(camera.zoom * 100),
      distanceToRoot
    }
  }

  /**
   * Draw the HUD in screen space
   */
  function draw(
    ctx: CanvasRenderingContext2D,
    hud: HUDData,
    x: number,
    y: number
  ) {
    ctx.save()
    ctx.globalAlpha = 0.6
    ctx.font = '10px "Inter", system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    let offsetY = 0
    const lineHeight = 14

    // Region name
    if (hud.regionName) {
      ctx.fillStyle = '#00D2BE'
      ctx.fillText(hud.regionName, x, y + offsetY)
      offsetY += lineHeight
    }

    // Node count
    ctx.fillStyle = '#888890'
    ctx.fillText(`${hud.visibleCount}/${hud.totalCount} nodes`, x, y + offsetY)
    offsetY += lineHeight

    // Zoom
    ctx.fillText(`${hud.zoomPercent}%`, x, y + offsetY)
    offsetY += lineHeight

    // Distance to root
    if (hud.distanceToRoot !== null) {
      ctx.fillText(`Root: ${hud.distanceToRoot}px`, x, y + offsetY)
    }

    ctx.restore()
  }

  return {
    computeHUD,
    draw
  }
}
