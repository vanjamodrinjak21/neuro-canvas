// Camera intelligence — higher-level navigation commands built on spring camera
// Provides flyTo, fit, cycle, follow, and breadcrumb navigation

import type { Camera, Node } from '~/types/canvas'

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
  setTarget: (target: Partial<Camera>, preset?: string) => void
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
  nodeAnimations?: NodeAnimAPI | null
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

    const { padding = 50, preset = 'snappy', pulse = false } = options
    const cam = springCamera.camera.value

    const zoom = options.zoom ?? cam.zoom
    const targetX = -node.position.x * zoom + window.innerWidth / 2 - (node.size.width * zoom) / 2
    const targetY = -node.position.y * zoom + window.innerHeight / 2 - (node.size.height * zoom) / 2

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

    const zoom = Math.min(
      window.innerWidth / contentWidth,
      window.innerHeight / contentHeight,
      2 // Don't zoom in too much
    )

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    springCamera.setTarget({
      x: window.innerWidth / 2 - centerX * zoom,
      y: window.innerHeight / 2 - centerY * zoom,
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
    recordBreadcrumb,
    goBack,
    breadcrumbs: breadcrumbs as Ref<NavigationBreadcrumb[]>
  }
}
