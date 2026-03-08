import type { Node } from '~/types/canvas'

export interface AlignmentGuide {
  axis: 'horizontal' | 'vertical'
  position: number       // world coordinate of the guide line
  type: 'center' | 'edge' // which alignment triggered
}

const SNAP_DISTANCE = 6 // world units — proximity to trigger guide

export function useSmartGuides() {
  const guides = ref<AlignmentGuide[]>([])
  const enabled = ref(true)

  /**
   * Compute alignment guides for dragged nodes against reference nodes.
   * Returns guides and optionally adjusts target positions for micro-snap.
   */
  function compute(
    draggedNodes: Map<string, Node>,
    allNodes: Map<string, Node>,
    selectedIds: Set<string>
  ): { guides: AlignmentGuide[]; snapDx: number; snapDy: number } {
    if (!enabled.value) {
      guides.value = []
      return { guides: [], snapDx: 0, snapDy: 0 }
    }

    const newGuides: AlignmentGuide[] = []
    let snapDx = 0
    let snapDy = 0
    let foundHSnap = false
    let foundVSnap = false

    // Collect reference edges from non-selected nodes
    const references: {
      left: number; right: number; top: number; bottom: number
      centerX: number; centerY: number
    }[] = []

    for (const [id, node] of allNodes) {
      if (selectedIds.has(id)) continue
      references.push({
        left: node.position.x,
        right: node.position.x + node.size.width,
        top: node.position.y,
        bottom: node.position.y + node.size.height,
        centerX: node.position.x + node.size.width / 2,
        centerY: node.position.y + node.size.height / 2
      })
    }

    if (references.length === 0) {
      guides.value = []
      return { guides: [], snapDx: 0, snapDy: 0 }
    }

    // For each dragged node, check alignment
    for (const [, node] of draggedNodes) {
      const dragLeft = node.position.x
      const dragRight = node.position.x + node.size.width
      const dragTop = node.position.y
      const dragBottom = node.position.y + node.size.height
      const dragCenterX = node.position.x + node.size.width / 2
      const dragCenterY = node.position.y + node.size.height / 2

      for (const ref of references) {
        // Vertical guides (x-axis alignment)
        if (!foundVSnap) {
          // Center-to-center X
          const dcx = ref.centerX - dragCenterX
          if (Math.abs(dcx) < SNAP_DISTANCE) {
            newGuides.push({ axis: 'vertical', position: ref.centerX, type: 'center' })
            snapDx = dcx
            foundVSnap = true
          }
          // Left-to-left
          if (!foundVSnap) {
            const dll = ref.left - dragLeft
            if (Math.abs(dll) < SNAP_DISTANCE) {
              newGuides.push({ axis: 'vertical', position: ref.left, type: 'edge' })
              snapDx = dll
              foundVSnap = true
            }
          }
          // Right-to-right
          if (!foundVSnap) {
            const drr = ref.right - dragRight
            if (Math.abs(drr) < SNAP_DISTANCE) {
              newGuides.push({ axis: 'vertical', position: ref.right, type: 'edge' })
              snapDx = drr
              foundVSnap = true
            }
          }
        }

        // Horizontal guides (y-axis alignment)
        if (!foundHSnap) {
          // Center-to-center Y
          const dcy = ref.centerY - dragCenterY
          if (Math.abs(dcy) < SNAP_DISTANCE) {
            newGuides.push({ axis: 'horizontal', position: ref.centerY, type: 'center' })
            snapDy = dcy
            foundHSnap = true
          }
          // Top-to-top
          if (!foundHSnap) {
            const dtt = ref.top - dragTop
            if (Math.abs(dtt) < SNAP_DISTANCE) {
              newGuides.push({ axis: 'horizontal', position: ref.top, type: 'edge' })
              snapDy = dtt
              foundHSnap = true
            }
          }
          // Bottom-to-bottom
          if (!foundHSnap) {
            const dbb = ref.bottom - dragBottom
            if (Math.abs(dbb) < SNAP_DISTANCE) {
              newGuides.push({ axis: 'horizontal', position: ref.bottom, type: 'edge' })
              snapDy = dbb
              foundHSnap = true
            }
          }
        }

        if (foundHSnap && foundVSnap) break
      }

      if (foundHSnap && foundVSnap) break
    }

    guides.value = newGuides
    return { guides: newGuides, snapDx, snapDy }
  }

  function clear() {
    guides.value = []
  }

  return { guides, compute, clear, enabled }
}
