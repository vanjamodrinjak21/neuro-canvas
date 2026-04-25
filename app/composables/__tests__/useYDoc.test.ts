// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { nextTick } from 'vue'
import { useYDoc } from '../useYDoc'

describe('useYDoc', () => {
  it('exposes a reactive node count that updates when the Y.Doc changes', async () => {
    const ydoc = new Y.Doc()
    const { nodeCount, dispose } = useYDoc(ydoc)
    expect(nodeCount.value).toBe(0)
    ydoc.getMap('nodes').set('n1', new Y.Map())
    await nextTick()
    expect(nodeCount.value).toBe(1)
    dispose()
  })

  it('stops reacting after dispose()', async () => {
    const ydoc = new Y.Doc()
    const { nodeCount, dispose } = useYDoc(ydoc)
    dispose()
    ydoc.getMap('nodes').set('n1', new Y.Map())
    await nextTick()
    expect(nodeCount.value).toBe(0)
  })

  it('also tracks edge count', async () => {
    const ydoc = new Y.Doc()
    const { edgeCount, dispose } = useYDoc(ydoc)
    expect(edgeCount.value).toBe(0)
    ydoc.getMap('edges').set('e1', new Y.Map())
    await nextTick()
    expect(edgeCount.value).toBe(1)
    dispose()
  })
})
