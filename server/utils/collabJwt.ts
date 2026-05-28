import { SignJWT, jwtVerify } from 'jose'

export type CollabRole = 'viewer' | 'commenter' | 'editor'

export interface CollabJwtPayload {
  mapId: string
  sessionId: string  // opaque per-connection id, not the auth userId
  role: CollabRole
  // Optional revocation handles — used by the PartyKit /kick endpoint
  // to close only the connections we want to terminate (a specific
  // share, or all of a user's sessions) instead of nuking the whole room.
  userId?: string | null
  shareToken?: string | null
  jti?: string
}

export async function signCollabJwt(payload: CollabJwtPayload, secret: string, ttlSeconds: number): Promise<string> {
  const key = new TextEncoder().encode(secret)
  const now = Math.floor(Date.now() / 1000)
  const body: Record<string, unknown> = {
    mapId: payload.mapId,
    sessionId: payload.sessionId,
    role: payload.role,
  }
  if (payload.userId) body.userId = payload.userId
  if (payload.shareToken) body.shareToken = payload.shareToken
  if (payload.jti) body.jti = payload.jti
  return await new SignJWT(body)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key)
}

export async function verifyCollabJwt(token: string, secret: string): Promise<CollabJwtPayload> {
  const key = new TextEncoder().encode(secret)
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
  if (
    typeof payload.mapId !== 'string' ||
    typeof payload.sessionId !== 'string' ||
    (payload.role !== 'viewer' && payload.role !== 'commenter' && payload.role !== 'editor')
  ) {
    throw new Error('Malformed collab JWT')
  }
  return {
    mapId: payload.mapId,
    sessionId: payload.sessionId,
    role: payload.role,
    userId: typeof payload.userId === 'string' ? payload.userId : null,
    shareToken: typeof payload.shareToken === 'string' ? payload.shareToken : null,
    jti: typeof payload.jti === 'string' ? payload.jti : undefined,
  }
}
