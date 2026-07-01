// Camera intelligence — higher-level navigation commands built on spring camera
// Provides flyTo, fit, cycle, follow, and breadcrumb navigation

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Camera, Edge, Node } from '~/types/canvas'
import type { SpringPresets } from '~/composables/useSpringCamera'

/** Viewport the camera frames into. Excludes any UI that overlays the canvas
 *  (left sidebar, right detail panel) so content centers in the VISIBLE area. */
export type ViewportGetter = () => { width: number; height: number }

const defaultViewport: ViewportGetter = () =>
  typeof window !== 'undefined'
    ? { width: window.innerWidth, height: window.innerHeight }
    : { width: 1280, height: 800 }

export interface FlyToOptions {
  padding?: number
  zoom?: number
  preset?: 'navigation' | 'snappy' | 'elastic'
  pulse?: boolean
}

export interface NavigationBreadcrumb {
  x: number
  y: number
  zoom: number
  timestamp: number
}

interface SpringCameraAPI {
  camera: Ref<Camera>
  setTarget: (target: Partial<Camera>, preset?: keyof SpringPresets) => void
  setCurrent: (value: Camera) => void
  stop: () => void
}

interface NodeAnimAPI {
  pulseNode: (nodeId: string) => void
}

export function useCameraIntelligence(
  springCamera: SpringCameraAPI,
  getNodes: () => Map<string, Node>,
  getSelectedNodeIds: () => Set<string>,
  nodeAnimations?: NodeAnimAPI | null,
  getEdges?: () => Map<string, Edge>,
  getRootNodeId?: () => string | null,
  getViewport: ViewportGetter = defaultViewport,
) {
  // Breadcrumb trail
  const breadcrumbs = ref<NavigationBreadcrumb[]>([])
  const maxBreadcrumbs = 20
  let lastBreadcrumbPos = { x: 0, y: 0 }

  // Node cycle index
  let cycleIndex = -1
  let cycleNodeIds: string[] = []

  /**
   * Fly to center a specific node in the viewport
   */
  function flyToNode(nodeId: string, options: FlyToOptions = {}) {
    const nodes = getNodes()
    const node = nodes.get(nodeId)
    if (!node) return

    const { preset = 'snappy', pulse = false } = options
    const cam = springCamera.camera.value

    const zoom = options.zoom ?? cam.zoom
    const vp = getViewport()
    const targetX = -node.position.x * zoom + vp.width / 2 - (node.size.width * zoom) / 2
    const targetY = -node.position.y * zoom + vp.height / 2 - (node.size.height * zoom) / 2

    // Record breadcrumb before navigating
    recordBreadcrumb()

    springCamera.setTarget({ x: targetX, y: targetY, zoom }, preset)

    if (pulse && nodeAnimations) {
      setTimeout(() => nodeAnimations.pulseNode(nodeId), 300)
    }
  }

  /**
   * Fly to fit all selected nodes in view
   */
  function flyToSelection(pad: number = 80) {
    const selectedIds = getSelectedNodeIds()
    if (selectedIds.size === 0) return

    const nodes = getNodes()
    const selectedNodes = Array.from(selectedIds)
      .map(id => nodes.get(id))
      .filter((n): n is Node => !!n)

    if (selectedNodes.length === 0) return

    flyToNodes(selectedNodes, pad)
  }

  /**
   * Fly to fit all nodes in view
   */
  function fitToContent(padding: number = 80) {
    const nodes = getNodes()
    if (nodes.size === 0) return

    recordBreadcrumb()
    flyToNodes(Array.from(nodes.values()), padding)
  }

  /**
   * Internal: fly to fit a set of nodes
   */
  function flyToNodes(nodes: Node[], padding: number) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const node of nodes) {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + node.size.width)
      maxY = Math.max(maxY, node.position.y + node.size.height)
    }

    const contentWidth = maxX - minX + padding * 2
    const contentHeight = maxY - minY + padding * 2

    const vp = getViewport()
    const zoom = Math.min(
      vp.width / contentWidth,
      vp.height / contentHeight,
      2 // Don't zoom in too much
    )

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    springCamera.setTarget({
      x: vp.width / 2 - centerX * zoom,
      y: vp.height / 2 - centerY * zoom,
      zoom
    }, 'navigation')
  }

  /**
   * Cycle through nodes sequentially (Tab/Shift+Tab)
   */
  function cycleNode(direction: 'next' | 'prev') {
    const nodes = getNodes()
    if (nodes.size === 0) return null

    // Refresh cycle list if stale
    cycleNodeIds = Array.from(nodes.keys())
    if (cycleNodeIds.length === 0) return null

    if (direction === 'next') {
      cycleIndex = (cycleIndex + 1) % cycleNodeIds.length
    } else {
      cycleIndex = cycleIndex <= 0 ? cycleNodeIds.length - 1 : cycleIndex - 1
    }

    const nodeId = cycleNodeIds[cycleIndex]!
    flyToNode(nodeId, { preset: 'snappy' })
    return nodeId
  }

  /**
   * Compute the camera that frames a set of nodes inside the given viewport.
   * Pure function — doesn't read from window/refs so it works during SSR/init.
   */
  function cameraForBbox(
    bbox: { minX: number; minY: number; maxX: number; maxY: number },
    viewport: { width: number; height: number },
    padding: number,
    maxZoom: number,
  ): Camera {
    const contentWidth = bbox.maxX - bbox.minX + padding * 2
    const contentHeight = bbox.maxY - bbox.minY + padding * 2
    const zoom = Math.min(
      viewport.width / contentWidth,
      viewport.height / contentHeight,
      maxZoom,
    )
    const centerX = (bbox.minX + bbox.maxX) / 2
    const centerY = (bbox.minY + bbox.maxY) / 2
    return {
      x: viewport.width / 2 - centerX * zoom,
      y: viewport.height / 2 - centerY * zoom,
      zoom,
    }
  }

  function bboxOfNodes(nodes: Node[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + n.size.width)
      maxY = Math.max(maxY, n.position.y + n.size.height)
    }
    return { minX, minY, maxX, maxY }
  }

  /**
   * Compute the camera position to use when a map first opens.
   *
   *  - If the entire map fits in the viewport at a comfortable zoom, frame
   *    the whole map.
   *  - Otherwise, frame the root node and its directly-connected neighbours
   *    so the user sees the main topic and its primary branches first.
   *
   * Returns null if there is nothing to frame (empty map). Caller decides
   * whether to apply via setCurrent (snap) or setTarget (animate).
   */
  function computeOpeningCamera(
    viewport: { width: number; height: number },
    opts: { padding?: number; fullMapZoomThreshold?: number; rootViewMaxZoom?: number } = {},
  ): Camera | null {
    const padding = opts.padding ?? 120
    const fullThreshold = opts.fullMapZoomThreshold ?? 0.55
    const rootViewMaxZoom = opts.rootViewMaxZoom ?? 1
    const nodes = getNodes()
    if (nodes.size === 0) return null

    const all = Array.from(nodes.values())
    const allBbox = bboxOfNodes(all)
    const fullCam = cameraForBbox(allBbox, viewport, padding, 1)
    if (fullCam.zoom >= fullThreshold) return fullCam

    // Map is big — focus on root + 1-hop neighbours
    const rootId = getRootNodeId?.()
      ?? (Array.from(nodes.values()).find(n => n.isRoot)?.id ?? null)

    if (rootId) {
      const root = nodes.get(rootId)
      if (root) {
        const edges = getEdges?.() ?? new Map<string, Edge>()
        const neighbourIds = new Set<string>([rootId])
        for (const e of edges.values()) {
          if (e.sourceId === rootId) neighbourIds.add(e.targetId)
          else if (e.targetId === rootId) neighbourIds.add(e.sourceId)
        }
        // Also include nodes whose parentId is the root (graph may not have edges)
        for (const n of all) {
          if (n.parentId === rootId) neighbourIds.add(n.id)
        }
        const subset = Array.from(neighbourIds)
          .map(id => nodes.get(id))
          .filter((n): n is Node => !!n)
        if (subset.length > 0) {
          const subBbox = bboxOfNodes(subset)
          return cameraForBbox(subBbox, viewport, padding, rootViewMaxZoom)
        }
      }
    }

    // Fallback: clamp full-map camera to a usable zoom
    return cameraForBbox(allBbox, viewport, padding, rootViewMaxZoom)
  }

  /**
   * Apply the computed opening camera. Use setCurrent on initial load (snap)
   * so the user never sees a janky pre-frame state.
   */
  function fitToOpeningView(
    viewport: { width: number; height: number },
    opts: { animate?: boolean; padding?: number; fullMapZoomThreshold?: number; rootViewMaxZoom?: number } = {},
  ): Camera | null {
    const cam = computeOpeningCamera(viewport, opts)
    if (!cam) return null
    if (opts.animate) {
      springCamera.setTarget(cam, 'navigation')
    } else {
      springCamera.setCurrent(cam)
    }
    return cam
  }

  /**
   * Fly to root node
   */
  function flyToRoot() {
    const nodes = getNodes()
    for (const node of nodes.values()) {
      if (node.isRoot) {
        flyToNode(node.id, { preset: 'navigation', pulse: true })
        return node.id
      }
    }
    // Fallback: first node
    const firstId = Array.from(nodes.keys())[0]
    if (firstId) {
      flyToNode(firstId, { preset: 'navigation' })
      return firstId
    }
    return null
  }

  /**
   * Record current camera position as a breadcrumb
   */
  function recordBreadcrumb() {
    const cam = springCamera.camera.value
    const dx = cam.x - lastBreadcrumbPos.x
    const dy = cam.y - lastBreadcrumbPos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Only record if moved significantly (200+ world-units equivalent)
    if (distance < 200 * cam.zoom && breadcrumbs.value.length > 0) return

    breadcrumbs.value.push({
      x: cam.x,
      y: cam.y,
      zoom: cam.zoom,
      timestamp: Date.now()
    })

    // Trim to max
    if (breadcrumbs.value.length > maxBreadcrumbs) {
      breadcrumbs.value.shift()
    }

    lastBreadcrumbPos = { x: cam.x, y: cam.y }
  }

  /**
   * Navigate back to the previous breadcrumb position
   */
  function goBack(): boolean {
    if (breadcrumbs.value.length === 0) return false

    const crumb = breadcrumbs.value.pop()!
    springCamera.setTarget({
      x: crumb.x,
      y: crumb.y,
      zoom: crumb.zoom
    }, 'navigation')

    lastBreadcrumbPos = { x: crumb.x, y: crumb.y }
    return true
  }

  return {
    flyToNode,
    flyToSelection,
    fitToContent,
    cycleNode,
    flyToRoot,
    fitToOpeningView,
    computeOpeningCamera,
    recordBreadcrumb,
    goBack,
    breadcrumbs: breadcrumbs as Ref<NavigationBreadcrumb[]>
  }
}
