import { describe, it, expect } from 'vitest'
import { useBoxSelection } from '../useBoxSelection'
import type { Node } from '~/types/canvas'

function makeNode(id: string, x: number, y: number, w = 120, h = 40): Node {
  return { id, type: 'text', position: { x, y }, size: { width: w, height: h }, content: 'Test', style: { shape: 'rounded', fillColor: '#111', borderColor: '#222', borderWidth: 1, textColor: '#fff', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false }, createdAt: 0, updatedAt: 0 } as Node
}

describe('useBoxSelection', () => {
  it('starts inactive', () => {
    const { isBoxSelecting } = useBoxSelection()
    expect(isBoxSelecting.value).toBe(false)
  })

  it('startBox activates selection', () => {
    const { isBoxSelecting, startBox, boxStart } = useBoxSelection()
    startBox({ x: 10, y: 20 })
    expect(isBoxSelecting.value).toBe(true)
    expect(boxStart.value).toEqual({ x: 10, y: 20 })
  })

  it('getNodesInBox returns nodes within rectangle', () => {
    const { startBox, updateBox, getNodesInBox } = useBoxSelection()
    startBox({ x: 0, y: 0 })
    updateBox({ x: 200, y: 200 })

    const nodes = new Map([
      ['a', makeNode('a', 50, 50)],
      ['b', makeNode('b', 300, 300)],
    ])
    const ids = getNodesInBox(nodes)
    expect(ids).toContain('a')
    expect(ids).not.toContain('b')
  })

  it('commitBox resets state', () => {
    const { isBoxSelecting, startBox, commitBox } = useBoxSelection()
    startBox({ x: 0, y: 0 })
    commitBox()
    expect(isBoxSelecting.value).toBe(false)
  })

  it('getBoxRect returns null when not selecting', () => {
    const { getBoxRect } = useBoxSelection()
    expect(getBoxRect()).toBeNull()
  })

  it('getBoxRect returns normalized rect during selection', () => {
    const { startBox, updateBox, getBoxRect } = useBoxSelection()
    startBox({ x: 200, y: 200 })
    updateBox({ x: 50, y: 50 })
    const rect = getBoxRect()
    expect(rect).toEqual({ x: 50, y: 50, width: 150, height: 150 })
  })
})
