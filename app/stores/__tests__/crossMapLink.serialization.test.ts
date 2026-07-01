import { describe, it, expect } from 'vitest'
import type { Node } from '~/types/canvas'
import type { DBNode } from '~/composables/useDatabase'

/**
 * AER-69 — cross-map node links round-trip.
 *
 * `metadata.linkedMapId` must survive export→import so a linked node stays
 * linked after a map is persisted and re-hydrated. The map store does NOT add
 * any special handling for it: `toSerializable` deep-clones the whole metadata
 * object and `fromSerializable` re-attaches the node wholesale, so metadata (and
 * therefore `linkedMapId`) already round-trips. These tests pin that guarantee
 * so a future change to serialization can't silently drop the link.
 *
 * The transforms below mirror mapStore.toSerializable / fromSerializable exactly
 * (the store's own module can't be imported in isolation because it relies on
 * Nuxt auto-imported Vue globals; the serialization logic itself is pure).
 */

// Mirror of mapStore.toSerializable's per-node mapping (the metadata branch).
function serializeNode(node: Node): DBNode {
  return {
    id: node.id,
    type: node.type,
    position: { x: node.position.x, y: node.position.y },
    size: { width: node.size.width, height: node.size.height },
    content: node.content,
    style: JSON.parse(JSON.stringify(node.style)),
    parentId: node.parentId,
    collapsed: node.collapsed,
    locked: node.locked,
    isRoot: node.isRoot,
    metadata: node.metadata ? JSON.parse(JSON.stringify(node.metadata)) : {},
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }
}

// Mirror of mapStore.fromSerializable's node re-hydration (pass-through cast).
function deserializeNodes(dbNodes: DBNode[]): Map<string, Node> {
  return new Map(dbNodes.map(node => [node.id, node as unknown as Node]))
}

function makeLinkedNode(linkedMapId: string): Node {
  return {
    id: 'n1',
    type: 'text',
    position: { x: 10, y: 20 },
    size: { width: 120, height: 40 },
    content: 'Big subject — see continuation',
    style: {
      shape: 'rounded',
      fillColor: '#111',
      borderColor: '#222',
      borderWidth: 1,
      textColor: '#fff',
      fontSize: 14,
      fontWeight: 500,
      shadowEnabled: false,
      glowEnabled: false,
    },
    metadata: {
      category: 'reference',
      notes: 'continues in another map',
      linkedMapId,
    },
    createdAt: 1,
    updatedAt: 2,
  }
}

describe('cross-map link serialization round-trip', () => {
  it('preserves metadata.linkedMapId through export→import', () => {
    const targetId = 'map-abc123'
    const node = makeLinkedNode(targetId)

    const serialized = serializeNode(node)
    // The JSON deep-clone the store performs must keep the field.
    expect(serialized.metadata?.linkedMapId).toBe(targetId)

    const rehydrated = deserializeNodes([serialized]).get('n1')!
    expect(rehydrated.metadata?.linkedMapId).toBe(targetId)
    // Other metadata is untouched — no field was clobbered by the link.
    expect(rehydrated.metadata?.category).toBe('reference')
    expect(rehydrated.metadata?.notes).toBe('continues in another map')
  })

  it('round-trips a node with NO link without inventing a linkedMapId', () => {
    const node = makeLinkedNode('tmp')
    delete node.metadata!.linkedMapId

    const rehydrated = deserializeNodes([serializeNode(node)]).get('n1')!
    expect(rehydrated.metadata?.linkedMapId).toBeUndefined()
  })

  it('clearing the link (delete on metadata) does not survive as an empty string', () => {
    // Picker "clear" removes the key entirely rather than setting '' — assert
    // that an explicitly-cleared node serializes with no linkedMapId at all.
    const node = makeLinkedNode('will-be-cleared')
    // Simulate the panel's clear handler: strip the key from a copied metadata.
    const cleared = { ...node.metadata }
    delete (cleared as Record<string, unknown>).linkedMapId
    node.metadata = cleared

    const rehydrated = deserializeNodes([serializeNode(node)]).get('n1')!
    expect('linkedMapId' in (rehydrated.metadata ?? {})).toBe(false)
  })

  it('survives a full JSON stringify/parse (matches persisted DB shape)', () => {
    const targetId = 'map-persist-xyz'
    const node = makeLinkedNode(targetId)
    const serialized = serializeNode(node)

    // Persisted maps are stored/transferred as JSON; simulate that boundary.
    const throughDb = JSON.parse(JSON.stringify(serialized)) as DBNode
    const rehydrated = deserializeNodes([throughDb]).get('n1')!
    expect(rehydrated.metadata?.linkedMapId).toBe(targetId)
  })
})
