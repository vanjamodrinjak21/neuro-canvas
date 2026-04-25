import { nanoid } from 'nanoid'
import { prisma } from './prisma'
import { signCollabJwt, type CollabRole } from './collabJwt'

export class TokenError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export interface MintInput {
  mapId: string
  authedUserId: string | null
  shareToken: string | null
  jwtSecret: string
  ttlSeconds: number
}

export interface MintResult {
  jwt: string
  role: CollabRole
  sessionId: string
  displayName: string
  expiresInSeconds: number
}

/**
 * Resolve who is connecting and mint a JWT for the PartyKit room.
 *
 * - Owner of the map: editor role, sessionId = `user:<authedUserId>`.
 * - Authed user with a viewer/editor share: that share's role.
 * - Anonymous user with a viewer share: viewer, sessionId = `guest:<nanoid>`.
 * - Anonymous user with an editor share: 401 — editor links require sign-in.
 * - Anyone else: 403.
 */
export async function mintCollabToken(input: MintInput): Promise<MintResult> {
  const { mapId, authedUserId, shareToken, jwtSecret, ttlSeconds } = input
  if (!jwtSecret) throw new TokenError(500, 'JWT secret not configured')

  const map = await prisma.map.findUnique({
    where: { id: mapId },
    select: { id: true, userId: true }
  })
  if (!map) throw new TokenError(404, 'Map not found')

  let role: CollabRole = 'viewer'
  let sessionId: string
  let displayName: string

  if (authedUserId && authedUserId === map.userId) {
    role = 'editor'
    sessionId = `user:${authedUserId}`
    displayName = 'You'
  } else if (shareToken) {
    const share = await prisma.mapShare.findUnique({ where: { token: shareToken } })
    if (!share || share.mapId !== mapId) throw new TokenError(404, 'Share link not found')
    if (share.revokedAt) throw new TokenError(410, 'Share link revoked')
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) throw new TokenError(410, 'Share link expired')

    const wantedRole: CollabRole = share.role === 'EDITOR' ? 'editor' : 'viewer'
    if (wantedRole === 'editor' && !authedUserId) {
      throw new TokenError(401, 'Editor links require sign-in')
    }
    role = wantedRole

    if (authedUserId) {
      sessionId = `user:${authedUserId}`
      displayName = 'Signed-in user'
    } else {
      sessionId = `guest:${nanoid(10)}`
      displayName = `Guest ${sessionId.slice(-4)}`
    }

    await prisma.mapShare.update({
      where: { id: share.id },
      data: { lastUsedAt: new Date() }
    })
  } else {
    throw new TokenError(403, 'Not allowed')
  }

  const jwt = await signCollabJwt({ mapId, sessionId, role }, jwtSecret, ttlSeconds)
  return { jwt, role, sessionId, displayName, expiresInSeconds: ttlSeconds }
}
