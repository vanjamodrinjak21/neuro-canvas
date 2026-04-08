import { ref } from 'vue'
import type { Point, Node } from '~/types/canvas'

export function useBoxSelection() {
  const isBoxSelecting = ref(false)
  const boxStart = ref<Point | null>(null)
  const boxEnd = ref<Point | null>(null)

  function startBox(worldPos: Point) {
    isBoxSelecting.value = true
    boxStart.value = { ...worldPos }
    boxEnd.value = { ...worldPos }
  }

  function updateBox(worldPos: Point) {
    boxEnd.value = { ...worldPos }
  }

  function commitBox() {
    isBoxSelecting.value = false
    boxStart.value = null
    boxEnd.value = null
  }

  function getNodesInBox(nodes: Map<string, Node>): string[] {
    if (!boxStart.value || !boxEnd.value) return []
    const minX = Math.min(boxStart.value.x, boxEnd.value.x)
    const minY = Math.min(boxStart.value.y, boxEnd.value.y)
    const maxX = Math.max(boxStart.value.x, boxEnd.value.x)
    const maxY = Math.max(boxStart.value.y, boxEnd.value.y)
    const result: string[] = []
    for (const node of nodes.values()) {
      const nodeRight = node.position.x + node.size.width
      const nodeBottom = node.position.y + node.size.height
      if (node.position.x < maxX && nodeRight > minX && node.position.y < maxY && nodeBottom > minY) {
        result.push(node.id)
      }
    }
    return result
  }

  function getBoxRect(): { x: number; y: number; width: number; height: number } | null {
    if (!isBoxSelecting.value || !boxStart.value || !boxEnd.value) return null
    const x = Math.min(boxStart.value.x, boxEnd.value.x)
    const y = Math.min(boxStart.value.y, boxEnd.value.y)
    return {
      x,
      y,
      width: Math.abs(boxEnd.value.x - boxStart.value.x),
      height: Math.abs(boxEnd.value.y - boxStart.value.y),
    }
  }

  return { isBoxSelecting, boxStart, boxEnd, startBox, updateBox, commitBox, getNodesInBox, getBoxRect }
}
