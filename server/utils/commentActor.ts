/**
 * Resolve the calling identity for the comments endpoints. Mirrors the
 * tier-resolution logic in collabTokenMint.ts but produces a CommentActor
 * suitable for commentsService instead of a JWT.
 *
 * Order of precedence:
 *   1. Authed user who owns the map  → editor + isOwner=true
 *   2. Authed user with a non-owner share → that share's role (or 403 if no share)
 *   3. Guest with a viewer share token → viewer (read-only)
 *   4. Guest with a commenter/editor share token → commenter (editor links would need sign-in upstream)
 *   5. Anyone else → 403
 */
import { nanoid } from 'nanoid'
import { getToken } from '#auth'
import type { H3Event } from 'h3'
import { prisma } from './prisma'
import { CommentError, type CommentActor, type CommentRole } from './commentsService'

const SHARE_ROLE_TO_COMMENT_ROLE: Record<string, CommentRole> = {
  VIEWER: 'viewer',
  COMMENTER: 'commenter',
  EDITOR: 'editor'
}

export async function resolveCommentActor(event: H3Event, mapId: string): Promise<CommentActor> {
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    select: { id: true, userId: true }
  })
  if (!map) throw new CommentError(404, 'Map not found')

  const token = await getToken({ event })
  const authedUserId = (token?.id as string | undefined) ?? null
  const authedEmail = (token?.email as string | undefined) ?? ''

  if (authedUserId && authedUserId === map.userId) {
    return {
      id: authedUserId,
      name: authedEmail || 'Owner',
      color: '#FAFAFA',
      role: 'editor',
      isOwner: true
    }
  }

  const shareToken = (getQuery(event)?.via as string | undefined) ?? null
  if (shareToken) {
    const share = await prisma.mapShare.findUnique({ where: { token: shareToken } })
    if (!share || share.mapId !== mapId) throw new CommentError(404, 'Share link not found')
    if (share.revokedAt) throw new CommentError(410, 'Share link revoked')
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) throw new CommentError(410, 'Share link expired')

    const role = SHARE_ROLE_TO_COMMENT_ROLE[share.role] ?? 'viewer'
    if (role === 'editor' && !authedUserId) {
      throw new CommentError(401, 'Editor links require sign-in')
    }

    if (authedUserId) {
      return { id: authedUserId, name: authedEmail || 'User', color: '#3DD9D6', role, isOwner: false }
    }
    return {
      id: `guest:${nanoid(10)}`,
      name: 'Guest',
      color: '#A1A1AA',
      role,
      isOwner: false
    }
  }

  throw new CommentError(403, 'Not allowed')
}
