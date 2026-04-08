import { shallowRef } from 'vue'
import type { Node } from '~/types/canvas'

interface NodeEditingDeps {
  select: (nodeIds: string[], edgeIds: string[]) => void
  updateNode: (id: string, updates: Partial<Node>) => void
}

export function useNodeEditing(deps: NodeEditingDeps) {
  const editingNode = shallowRef<Node | null>(null)

  function startEditing(node: Node) {
    editingNode.value = node
    deps.select([node.id], [])
  }

  function saveNodeEdit(content: string) {
    if (!editingNode.value) return
    deps.updateNode(editingNode.value.id, { content })
    editingNode.value = null
  }

  function cancelNodeEdit() {
    editingNode.value = null
  }

  return { editingNode, startEditing, saveNodeEdit, cancelNodeEdit }
}
