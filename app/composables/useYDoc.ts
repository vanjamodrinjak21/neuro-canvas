import { shallowRef, type Ref } from 'vue'
import * as Y from 'yjs'

export interface UseYDoc {
  doc: Y.Doc
  nodeCount: Ref<number>
  edgeCount: Ref<number>
  dispose: () => void
}

/**
 * Wraps a Y.Doc with shallow reactive bindings for the top-level node and
 * edge counts. A future plan replaces mapStore's nodes/edges arrays with
 * Y.Map observers driving deeper reactivity; for now this is enough to
 * surface a "doc has content" signal in the UI.
 */
export function useYDoc(doc: Y.Doc): UseYDoc {
  const nodes = doc.getMap('nodes')
  const edges = doc.getMap('edges')
  const nodeCount = shallowRef(nodes.size)
  const edgeCount = shallowRef(edges.size)

  const onNodes = () => { nodeCount.value = nodes.size }
  const onEdges = () => { edgeCount.value = edges.size }
  nodes.observe(onNodes)
  edges.observe(onEdges)

  return {
    doc,
    nodeCount,
    edgeCount,
    dispose() {
      nodes.unobserve(onNodes)
      edges.unobserve(onEdges)
    }
  }
}
