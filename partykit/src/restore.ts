/**
 * Server-side reconcile that makes a live room Y.Doc equal a restored snapshot.
 *
 * Why this exists: y-partykit keeps the authoritative Y.Doc in memory for the
 * room's lifetime (with `persist: false` it is never evicted while the Durable
 * Object stays warm). Restoring a version by rewriting Map.ydoc in Postgres
 * therefore never reaches the live doc — reconnecting clients just merge back
 * to the newer in-memory state. The only CRDT-correct way to "revert" is to
 * apply *forward* operations (delete what's gone, set what changed) onto the
 * live doc; y-partykit then broadcasts the delta to every connected client and
 * the in-memory doc becomes the restored state.
 *
 * The Y.Doc layout mirrors app/utils/ydocConverter.ts and app/utils/ydocBridge.ts:
 *   nodes: Y.Map<id, Y.Map>   // per-attribute; `content` is a Y.Text
 *   edges: Y.Map<id, Y.Map>   // per-attribute, all plain values
 *   meta:  Y.Map              // camera, settings, rootNodeId
 * Kept self-contained (no cross-tree imports) so the PartyKit bundle stays
 * hermetic, matching partykit/src/auth.ts.
 */
import * as Y from 'yjs'

export interface RestoreSnapshot {
  nodes: Array<Record<string, unknown> & { id: string }>
  edges: Array<Record<string, unknown> & { id: string }>
  camera?: unknown
  settings?: unknown
  rootNodeId?: string | null
}

const RESTORE_ORIGIN = 'server-restore'

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // Cheap structural compare for the plain objects we store (position, size,
  // style, metadata). JSON ordering is stable enough for our writers.
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** Reconcile a single per-entity Y.Map (edge, or a node's non-content attrs). */
function upsertScalars(entry: Y.Map<unknown>, source: Record<string, unknown>, skip: Set<string>) {
  const keep = new Set(Object.keys(source))
  for (const k of Array.from(entry.keys())) {
    if (skip.has(k)) continue
    if (!keep.has(k)) entry.delete(k)
  }
  for (const [k, v] of Object.entries(source)) {
    if (skip.has(k)) continue
    if (!eq(entry.get(k), v)) entry.set(k, v)
  }
}

function applyNode(entry: Y.Map<unknown>, node: Record<string, unknown>) {
  // `content` is collaborative text — edit the Y.Text in place so concurrent
  // editors are not clobbered, exactly like the client bridge does.
  let text = entry.get('content')
  if (!(text instanceof Y.Text)) {
    text = new Y.Text()
    entry.set('content', text)
  }
  const current = (text as Y.Text).toString()
  const next = String(node.content ?? '')
  if (current !== next) {
    if (current.length) (text as Y.Text).delete(0, current.length)
    if (next) (text as Y.Text).insert(0, next)
  }
  upsertScalars(entry, node, new Set(['id', 'content']))
}

/**
 * Make `doc` match `snap`. Runs in a single transaction tagged with
 * RESTORE_ORIGIN so the broadcast/flush observers fire exactly once.
 */
export function applyRestoreSnapshot(doc: Y.Doc, snap: RestoreSnapshot): void {
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes')
  const yedges = doc.getMap<Y.Map<unknown>>('edges')
  const ymeta = doc.getMap<unknown>('meta')

  const nodeById = new Map((snap.nodes ?? []).map((n) => [n.id, n]))
  const edgeById = new Map((snap.edges ?? []).map((e) => [e.id, e]))

  doc.transact(() => {
    for (const id of Array.from(ynodes.keys())) {
      if (!nodeById.has(id)) ynodes.delete(id)
    }
    for (const [id, node] of nodeById) {
      let entry = ynodes.get(id)
      if (!(entry instanceof Y.Map)) {
        entry = new Y.Map()
        ynodes.set(id, entry)
      }
      applyNode(entry, node)
    }

    for (const id of Array.from(yedges.keys())) {
      if (!edgeById.has(id)) yedges.delete(id)
    }
    for (const [id, edge] of edgeById) {
      let entry = yedges.get(id)
      if (!(entry instanceof Y.Map)) {
        entry = new Y.Map()
        yedges.set(id, entry)
      }
      upsertScalars(entry, edge, new Set(['id']))
    }

    ymeta.set('camera', snap.camera ?? { x: 0, y: 0, zoom: 1 })
    if (snap.settings !== undefined) ymeta.set('settings', snap.settings)
    if (snap.rootNodeId == null) ymeta.delete('rootNodeId')
    else ymeta.set('rootNodeId', snap.rootNodeId)
  }, RESTORE_ORIGIN)
}
