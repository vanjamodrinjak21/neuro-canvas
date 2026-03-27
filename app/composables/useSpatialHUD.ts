// Spatial HUD overlay — "You Are Here" display
// Shows current region name, visible/total node count, zoom %, distance to root
// Now rendered as a Vue overlay (SpatialHUDOverlay.vue) instead of canvas draw

import type { Camera, Node, MapRegion } from '~/types/canvas'

export interface HUDData {
  regionName: string | null
  visibleCount: number
  totalCount: number
  zoomPercent: number
  distanceToRoot: number | null
}

const HUD_THROTTLE_MS = 200

export function useSpatialHUD() {
  // Throttle state
  let lastComputeTime = 0
  let cachedHUD: HUDData = {
    regionName: null,
    visibleCount: 0,
    totalCount: 0,
    zoomPercent: 100,
    distanceToRoot: null
  }

  /**
   * Compute HUD data from current state.
   * Throttled to at most once every 200ms. Returns cached result when throttled.
   * When minimapVisible is false, skips the expensive region-finding loop.
   */
  function computeHUD(
    camera: Camera,
    nodes: Map<string, Node>,
    visibleNodeIds: Set<string>,
    regions: MapRegion[],
    rootNodeId?: string,
    minimapVisible: boolean = true
  ): HUDData {
    const now = Date.now()
    if (now - lastComputeTime < HUD_THROTTLE_MS) {
      return cachedHUD
    }
    lastComputeTime = now

    // Find current region (viewport center is in which region)
    const viewCenterX = -camera.x / camera.zoom + (window.innerWidth / camera.zoom) / 2
    const viewCenterY = -camera.y / camera.zoom + (window.innerHeight / camera.zoom) / 2

    let regionName: string | null = null

    // Only run the expensive region loop when the minimap is visible
    if (minimapVisible) {
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
    }

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

    cachedHUD = {
      regionName,
      visibleCount: visibleNodeIds.size,
      totalCount: nodes.size,
      zoomPercent: Math.round(camera.zoom * 100),
      distanceToRoot
    }

    return cachedHUD
  }

  return {
    computeHUD
  }
}
