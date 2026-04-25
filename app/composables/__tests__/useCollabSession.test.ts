// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'

class MockAwareness {
  states = new Map<number, unknown>()
  setLocalStateField = vi.fn()
  getStates = () => this.states
  on = vi.fn()
  off = vi.fn()
}
class MockYProvider {
  awareness = new MockAwareness()
  destroy = vi.fn()
  constructor(public host: string, public room: string, public doc: Y.Doc, public opts: { params: Record<string, string> }) {}
}

vi.mock('y-partykit/provider', () => ({ default: MockYProvider }))

const { useCollabSession } = await import('../useCollabSession')

describe('useCollabSession', () => {
  it('connects with the JWT in URL params', () => {
    const ydoc = new Y.Doc()
    const session = useCollabSession({
      ydoc,
      wsUrl: 'wss://nc-collab.partykit.dev/parties/main/m1',
      mapId: 'm1',
      jwt: 'jwt-abc',
      role: 'editor',
      sessionId: 's1',
      displayName: 'Sarah',
      color: '#A78BFA'
    })
    const provider = session.provider as unknown as MockYProvider
    expect(provider.opts.params.token).toBe('jwt-abc')
    expect(session.role.value).toBe('editor')
    session.dispose()
  })

  it('publishes the user identity through awareness', () => {
    const ydoc = new Y.Doc()
    const session = useCollabSession({
      ydoc, wsUrl: 'wss://x/parties/main/m1', mapId: 'm1', jwt: 't', role: 'editor',
      sessionId: 's1', displayName: 'Sarah', color: '#A78BFA'
    })
    const provider = session.provider as unknown as MockYProvider
    expect(provider.awareness.setLocalStateField).toHaveBeenCalledWith('user', expect.objectContaining({ sessionId: 's1', displayName: 'Sarah', color: '#A78BFA' }))
    session.dispose()
  })

  it('clears awareness state on dispose', () => {
    const ydoc = new Y.Doc()
    const session = useCollabSession({
      ydoc, wsUrl: 'wss://x/parties/main/m1', mapId: 'm1', jwt: 't', role: 'editor',
      sessionId: 's1', displayName: 'Sarah', color: '#A78BFA'
    })
    const provider = session.provider as unknown as MockYProvider
    session.dispose()
    expect(provider.destroy).toHaveBeenCalled()
  })
})
