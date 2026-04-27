/**
 * Wires a mapStore-shaped surface to a Y.Doc bidirectionally.
 *
 *   mapStore  --[ debounced .$subscribe -> syncStateIntoYDoc ]-->  Y.Doc
 *   mapStore  <--[ Y.Doc.on('update') -> applySnapshot ]----  Y.Doc
 *
 * The LOCAL_ORIGIN tag on the outgoing transactions lets the inverse path
 * recognise its own echo and skip it, preventing feedback loops, AND lets
 * the bundled Y.UndoManager track only local edits — Ctrl-Z never reverts
 * a remote collaborator's change.
 *
 * The "store surface" is intentionally narrow: anything providing `state`
 * (a reactive MapDocument), `$subscribe(fn)` (returns dispose), and
 * `applySnapshot(doc)` works — including a Pinia store or a unit-test stub.
 */
import { ref, type Ref } from 'vue'
import * as Y from 'yjs'
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
  undo: () => void
  redo: () => void
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
}

export interface BridgeOptions {
  debounceMs?: number
  /** Window in which consecutive local edits collapse into one undo step. */
  captureTimeoutMs?: number
}

export function useMapYDocBridge(ydoc: Y.Doc, surface: MapStoreSurface, opts: BridgeOptions = {}): MapYDocBridge {
  const debounceMs = opts.debounceMs ?? 50
  const captureTimeoutMs = opts.captureTimeoutMs ?? 500
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

  // ─── Y.UndoManager scoped to local-origin transactions ───
  // typeScope must reference the top-level types we mutate. Tracked origin
  // restricts capture to outgoing (LOCAL_ORIGIN) transactions so remote
  // edits never enter the local stack.
  const undoManager = new Y.UndoManager(
    [ydoc.getMap('nodes'), ydoc.getMap('edges'), ydoc.getMap('meta')],
    {
      captureTimeout: captureTimeoutMs,
      trackedOrigins: new Set<unknown>([LOCAL_ORIGIN])
    }
  )

  const canUndo = ref(false)
  const canRedo = ref(false)
  const refreshFlags = () => {
    canUndo.value = undoManager.undoStack.length > 0
    canRedo.value = undoManager.redoStack.length > 0
  }
  // Y.UndoManager fires these on every push/pop/clear.
  undoManager.on('stack-item-added', refreshFlags)
  undoManager.on('stack-item-popped', refreshFlags)
  undoManager.on('stack-cleared', refreshFlags)

  return {
    flushNow,
    dispose() {
      if (disposed) return
      disposed = true
      if (pushTimer) clearTimeout(pushTimer)
      unsubscribeStore()
      ydoc.off('update', onUpdate)
      undoManager.off('stack-item-added', refreshFlags)
      undoManager.off('stack-item-popped', refreshFlags)
      undoManager.off('stack-cleared', refreshFlags)
      undoManager.destroy()
    },
    undo() {
      if (disposed) return
      // Capture any pending local edit (still in the debounce window) into
      // the stack before stepping back. Skip when no edit is pending —
      // calling syncStateIntoYDoc on a no-diff state would otherwise emit
      // a spurious LOCAL_ORIGIN transaction and clear the redo stack.
      if (pushTimer) flushNow()
      undoManager.undo()
    },
    redo() {
      if (disposed) return
      if (pushTimer) flushNow()
      undoManager.redo()
    },
    canUndo,
    canRedo
  }
}
