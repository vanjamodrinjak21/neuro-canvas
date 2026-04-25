/**
 * Wires a mapStore-shaped surface to a Y.Doc bidirectionally.
 *
 *   mapStore  --[ debounced .$subscribe -> syncStateIntoYDoc ]-->  Y.Doc
 *   mapStore  <--[ Y.Doc.on('update') -> applySnapshot ]----  Y.Doc
 *
 * The LOCAL_ORIGIN tag on the outgoing transactions lets the inverse path
 * recognise its own echo and skip it, preventing feedback loops.
 *
 * The "store surface" is intentionally narrow: anything providing `state`
 * (a reactive MapDocument), `$subscribe(fn)` (returns dispose), and
 * `applySnapshot(doc)` works — including a Pinia store or a unit-test stub.
 */
import type * as Y from 'yjs'
import type { MapDocument } from '~/types'
import { syncStateIntoYDoc, LOCAL_ORIGIN } from '~/utils/ydocBridge'
import { yDocToMapDocument } from '~/utils/ydocConverter'

export interface MapStoreSurface {
  state: MapDocument
  $subscribe: (fn: () => void) => () => void
  applySnapshot: (snap: MapDocument) => void
}

export interface MapYDocBridge {
  flushNow: () => void
  dispose: () => void
}

export interface BridgeOptions {
  debounceMs?: number
}

export function useMapYDocBridge(ydoc: Y.Doc, surface: MapStoreSurface, opts: BridgeOptions = {}): MapYDocBridge {
  const debounceMs = opts.debounceMs ?? 50
  let isApplyingRemote = false
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const flushNow = () => {
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
    if (disposed) return
    if (isApplyingRemote) return
    syncStateIntoYDoc(ydoc, surface.state)
  }

  const unsubscribeStore = surface.$subscribe(() => {
    if (disposed || isApplyingRemote) return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      pushTimer = null
      flushNow()
    }, debounceMs)
  })

  const onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (disposed) return
    if (origin === LOCAL_ORIGIN) return
    isApplyingRemote = true
    try {
      const next = yDocToMapDocument(ydoc, {
        id: surface.state.id,
        title: surface.state.title,
        createdAt: surface.state.createdAt,
        updatedAt: Date.now()
      })
      surface.applySnapshot(next)
    } finally {
      isApplyingRemote = false
    }
  }
  ydoc.on('update', onUpdate)

  return {
    flushNow,
    dispose() {
      disposed = true
      if (pushTimer) clearTimeout(pushTimer)
      unsubscribeStore()
      ydoc.off('update', onUpdate)
    }
  }
}
