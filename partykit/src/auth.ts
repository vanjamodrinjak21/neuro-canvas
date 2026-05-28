import { jwtVerify } from 'jose'

export interface ConnectionPayload {
  mapId: string
  sessionId: string
  role: 'viewer' | 'commenter' | 'editor'
  userId: string | null
  shareToken: string | null
  jti: string | null
}

/**
 * Verify the JWT supplied as a query string parameter on connect, and assert
 * that its `mapId` claim matches the room id (defence in depth — without this
 * a leaked JWT for one map could be replayed against another room).
 *
 * Returns the optional `userId`, `shareToken`, and `jti` claims so the room
 * can stash them on `conn.setState({...})` and the /kick endpoint can scope
 * close() calls to a specific share, user, or token id.
 */
export async function verifyConnectionJwt(
  token: string,
  secret: string,
  expectedMapId: string
): Promise<ConnectionPayload> {
  const key = new TextEncoder().encode(secret)
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
  if (payload.mapId !== expectedMapId) throw new Error('mapId mismatch')
  if (typeof payload.sessionId !== 'string') throw new Error('Missing sessionId')
  if (payload.role !== 'viewer' && payload.role !== 'commenter' && payload.role !== 'editor') {
    throw new Error('Invalid role')
  }
  return {
    mapId: payload.mapId,
    sessionId: payload.sessionId,
    role: payload.role,
    userId: typeof payload.userId === 'string' ? payload.userId : null,
    shareToken: typeof payload.shareToken === 'string' ? payload.shareToken : null,
    jti: typeof payload.jti === 'string' ? payload.jti : null,
  }
}
