import { describe, it, expect, vi } from 'vitest'
import { useNodeResize } from '../useNodeResize'
import type { Node } from '~/types/canvas'

function makeNode(): Node {
  return {
    id: 'n1',
    type: 'text',
    position: { x: 100, y: 100 },
    size: { width: 200, height: 100 },
    content: 'Test',
    style: {} as Node['style'],
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeDeps(node: Node) {
  return {
    nodes: () => new Map([[node.id, node]]),
    beginResizeNode: vi.fn(() => ({
      position: { x: node.position.x, y: node.position.y },
      size: { width: node.size.width, height: node.size.height },
    })),
    setNodeRect: vi.fn(),
    commitResizeNode: vi.fn(),
    bumpNodesVersion: vi.fn(),
  }
}

describe('useNodeResize', () => {
  it('starts idle', () => {
    const node = makeNode()
    const r = useNodeResize(makeDeps(node))
    expect(r.isResizing.value).toBe(false)
    expect(r.activeHandle.value).toBeNull()
  })

  it('begin → update → commit records exactly one history entry and never reverts', () => {
    const node = makeNode()
    const deps = makeDeps(node)
    const r = useNodeResize(deps)

    r.beginResize(node, 'se')
    expect(r.isResizing.value).toBe(true)
    expect(deps.beginResizeNode).toHaveBeenCalledOnce()

    r.updateResize({ x: 400, y: 350 }, false)
    expect(deps.setNodeRect).toHaveBeenCalledWith('n1', { x: 100, y: 100, width: 300, height: 250 })

    r.commitResize()
    expect(deps.commitResizeNode).toHaveBeenCalledOnce()
    // commit must not also restore the original (that would be a revert)
    expect(deps.setNodeRect).toHaveBeenCalledTimes(1)
    expect(r.isResizing.value).toBe(false)
  })

  it('cancel restores the pre-resize rect and records no history', () => {
    const node = makeNode()
    const deps = makeDeps(node)
    const r = useNodeResize(deps)

    r.beginResize(node, 'se')
    r.updateResize({ x: 400, y: 350 }, false) // live, history-free change
    expect(deps.setNodeRect).toHaveBeenLastCalledWith('n1', { x: 100, y: 100, width: 300, height: 250 })

    r.cancelResize()
    // The last setNodeRect call must restore the original rect...
    expect(deps.setNodeRect).toHaveBeenLastCalledWith('n1', { x: 100, y: 100, width: 200, height: 100 })
    // ...and nothing is committed to history.
    expect(deps.commitResizeNode).not.toHaveBeenCalled()
    expect(r.isResizing.value).toBe(false)
  })

  it('does nothing when beginResizeNode returns null (missing/locked node)', () => {
    const node = makeNode()
    const deps = { ...makeDeps(node), beginResizeNode: vi.fn(() => null) }
    const r = useNodeResize(deps)

    r.beginResize(node, 'se')
    expect(r.isResizing.value).toBe(false)

    r.updateResize({ x: 400, y: 350 }, false)
    expect(deps.setNodeRect).not.toHaveBeenCalled()
    r.commitResize()
    expect(deps.commitResizeNode).not.toHaveBeenCalled()
  })

  it('honors the proportional flag (Shift) per frame', () => {
    const node = makeNode() // 200x100, aspect 2:1
    const deps = makeDeps(node)
    const r = useNodeResize(deps)

    r.beginResize(node, 'se')
    r.updateResize({ x: 500, y: 250 }, true)
    const rect = deps.setNodeRect.mock.calls[0]?.[1]
    expect(rect).toBeDefined()
    expect(rect!.width / rect!.height).toBeCloseTo(2, 5)
  })
})
