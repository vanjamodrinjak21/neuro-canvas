import { SignJWT, jwtVerify } from 'jose'

export type CollabRole = 'viewer' | 'commenter' | 'editor'

export interface CollabJwtPayload {
  mapId: string
  sessionId: string  // opaque per-connection id, not the auth userId
  role: CollabRole
}

export async function signCollabJwt(payload: CollabJwtPayload, secret: string, ttlSeconds: number): Promise<string> {
  const key = new TextEncoder().encode(secret)
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({ ...payload })
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
  return { mapId: payload.mapId, sessionId: payload.sessionId, role: payload.role }
}
