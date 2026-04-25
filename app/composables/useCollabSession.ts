import { shallowRef, ref, type Ref } from 'vue'
import type * as Y from 'yjs'
import YProvider from 'y-partykit/provider'

export interface CollabSessionOpts {
  ydoc: Y.Doc
  wsUrl: string         // wss://host/parties/main/<mapId>
  mapId: string
  jwt: string
  role: 'viewer' | 'editor'
  sessionId: string
  displayName: string
  color: string
}

export interface RemoteUser {
  sessionId: string
  displayName: string
  color: string
  cursor: { x: number; y: number } | null
  selection: string[]
}

export interface CollabSession {
  provider: YProvider
  role: Ref<'viewer' | 'editor'>
  remotes: Ref<RemoteUser[]>
  setCursor: (xy: { x: number; y: number } | null) => void
  setSelection: (ids: string[]) => void
  dispose: () => void
}

export function useCollabSession(opts: CollabSessionOpts): CollabSession {
  const url = new URL(opts.wsUrl)
  const host = url.host
  const provider = new YProvider(host, opts.mapId, opts.ydoc, {
    params: { token: opts.jwt }
  })

  const role = ref(opts.role)
  const remotes = shallowRef<RemoteUser[]>([])

  provider.awareness.setLocalStateField('user', {
    sessionId: opts.sessionId,
    displayName: opts.displayName,
    color: opts.color
  })
  provider.awareness.setLocalStateField('cursor', null)
  provider.awareness.setLocalStateField('selection', [])

  const refreshRemotes = () => {
    const all: RemoteUser[] = []
    for (const [, state] of provider.awareness.getStates()) {
      const s = state as {
        user?: { sessionId: string; displayName: string; color: string }
        cursor?: { x: number; y: number } | null
        selection?: string[]
      }
      if (!s.user || s.user.sessionId === opts.sessionId) continue
      all.push({
        sessionId: s.user.sessionId,
        displayName: s.user.displayName,
        color: s.user.color,
        cursor: s.cursor ?? null,
        selection: s.selection ?? []
      })
    }
    remotes.value = all
  }
  provider.awareness.on('change', refreshRemotes)

  return {
    provider,
    role,
    remotes,
    setCursor(xy) {
      provider.awareness.setLocalStateField('cursor', xy)
    },
    setSelection(ids) {
      provider.awareness.setLocalStateField('selection', ids)
    },
    dispose() {
      provider.awareness.off('change', refreshRemotes)
      provider.destroy()
    }
  }
}
