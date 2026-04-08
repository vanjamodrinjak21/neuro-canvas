import { describe, it, expect, vi } from 'vitest'
import { useNodeEditing } from '../useNodeEditing'
import type { Node } from '~/types/canvas'

function makeNode(id: string): Node {
  return { id, type: 'text', position: { x: 0, y: 0 }, size: { width: 120, height: 40 }, content: 'Test', style: { shape: 'rounded', fillColor: '#111', borderColor: '#222', borderWidth: 1, textColor: '#fff', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false }, createdAt: 0, updatedAt: 0 } as Node
}

describe('useNodeEditing', () => {
  it('starts with no editing node', () => {
    const { editingNode } = useNodeEditing({ select: vi.fn(), updateNode: vi.fn() })
    expect(editingNode.value).toBeNull()
  })

  it('startEditing sets the node and selects it', () => {
    const select = vi.fn()
    const { editingNode, startEditing } = useNodeEditing({ select, updateNode: vi.fn() })
    const node = makeNode('a')
    startEditing(node)
    expect(editingNode.value).toBe(node)
    expect(select).toHaveBeenCalledWith(['a'], [])
  })

  it('saveNodeEdit updates the node and clears editing', () => {
    const updateNode = vi.fn()
    const { editingNode, startEditing, saveNodeEdit } = useNodeEditing({ select: vi.fn(), updateNode })
    startEditing(makeNode('a'))
    saveNodeEdit('New content')
    expect(updateNode).toHaveBeenCalledWith('a', { content: 'New content' })
    expect(editingNode.value).toBeNull()
  })

  it('cancelNodeEdit clears editing without updating', () => {
    const updateNode = vi.fn()
    const { editingNode, startEditing, cancelNodeEdit } = useNodeEditing({ select: vi.fn(), updateNode })
    startEditing(makeNode('a'))
    cancelNodeEdit()
    expect(editingNode.value).toBeNull()
    expect(updateNode).not.toHaveBeenCalled()
  })
})
