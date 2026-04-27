/**
 * Comments / annotations service. Threads are denormalised across messages —
 * the first message of a thread reuses its own id as `threadId`, and replies
 * carry the same `threadId`. Anchor (node id or canvas point) is set on the
 * first message and inherited by every reply.
 *
 * Authorisation:
 *   - listComments: any actor with viewer-or-higher access.
 *   - createComment: commenter-or-higher.
 *   - updateComment: author only.
 *   - deleteComment: author OR map owner.
 *   - resolve / reopen: commenter-or-higher; owner can also resolve anyone's.
 */
import { nanoid } from 'nanoid'
import { prisma } from './prisma'
import type { Comment } from '../generated/prisma'

export class CommentError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export type CommentRole = 'viewer' | 'commenter' | 'editor'

export interface CommentActor {
  id: string             // user id or `guest:<nanoid>`
  name: string
  color: string
  role: CommentRole
  isOwner: boolean
}

export interface CreateCommentInput {
  body: string
  threadId: string | null
  anchorNodeId: string | null
  anchorX: number | null
  anchorY: number | null
  mentions: string[]
}

export interface UpdateCommentInput {
  body: string
}

const MAX_BODY_LENGTH = 4000

function requireWrite(actor: CommentActor): void {
  if (actor.role === 'viewer') {
    throw new CommentError(403, 'Comment access required')
  }
}

export async function listComments(mapId: string, _actor: CommentActor): Promise<Comment[]> {
  // Any actor reaching this point has at least viewer access (the calling
  // endpoint must have validated it). Return everything in chronological
  // order so the client can group by threadId.
  return prisma.comment.findMany({
    where: { mapId },
    orderBy: { createdAt: 'asc' }
  })
}

export async function createComment(
  mapId: string,
  actor: CommentActor,
  input: CreateCommentInput
): Promise<Comment> {
  requireWrite(actor)
  const body = input.body.trim()
  if (!body) throw new CommentError(400, 'Comment body cannot be empty')
  if (body.length > MAX_BODY_LENGTH) throw new CommentError(400, 'Comment body too long')

  let anchorNodeId = input.anchorNodeId
  let anchorX = input.anchorX
  let anchorY = input.anchorY

  if (input.threadId) {
    // Reply — inherit anchor from the thread's first message and ignore
    // anything the client tried to override.
    const head = await prisma.comment.findFirst({
      where: { threadId: input.threadId, mapId },
      orderBy: { createdAt: 'asc' },
      select: { threadId: true, anchorNodeId: true, anchorX: true, anchorY: true }
    })
    if (!head) throw new CommentError(404, 'Thread not found')
    anchorNodeId = head.anchorNodeId
    anchorX = head.anchorX
    anchorY = head.anchorY
  }

  // Generate the message id ourselves so the first message of a new thread
  // can use it as the threadId in a single insert (no two-step write).
  const id = nanoid(16)
  return prisma.comment.create({
    data: {
      id,
      mapId,
      threadId: input.threadId ?? id,
      authorId: actor.id,
      authorName: actor.name,
      authorColor: actor.color,
      body,
      anchorNodeId: anchorNodeId,
      anchorX: anchorX,
      anchorY: anchorY
    }
  })
}

export async function updateComment(
  mapId: string,
  actor: CommentActor,
  commentId: string,
  input: UpdateCommentInput
): Promise<Comment> {
  const existing = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!existing || existing.mapId !== mapId) throw new CommentError(404, 'Comment not found')
  if (existing.authorId !== actor.id) throw new CommentError(403, 'Only the author can edit')

  const body = input.body.trim()
  if (!body) throw new CommentError(400, 'Comment body cannot be empty')
  if (body.length > MAX_BODY_LENGTH) throw new CommentError(400, 'Comment body too long')

  return prisma.comment.update({
    where: { id: commentId },
    data: { body }
  })
}

export async function deleteComment(
  mapId: string,
  actor: CommentActor,
  commentId: string
): Promise<{ id: string }> {
  const existing = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!existing || existing.mapId !== mapId) throw new CommentError(404, 'Comment not found')
  // Author or map owner can delete; everyone else 403.
  if (existing.authorId !== actor.id && !actor.isOwner) {
    throw new CommentError(403, 'Cannot delete this comment')
  }
  await prisma.comment.delete({ where: { id: commentId } })
  return { id: commentId }
}

export async function resolveThread(
  mapId: string,
  actor: CommentActor,
  threadId: string
): Promise<{ count: number }> {
  requireWrite(actor)
  const result = await prisma.comment.updateMany({
    where: { mapId, threadId, resolvedAt: null },
    data: { resolvedAt: new Date() }
  })
  if (result.count === 0) throw new CommentError(404, 'Thread not found or already resolved')
  return result
}

export async function reopenThread(
  mapId: string,
  actor: CommentActor,
  threadId: string
): Promise<{ count: number }> {
  requireWrite(actor)
  const result = await prisma.comment.updateMany({
    where: { mapId, threadId, resolvedAt: { not: null } },
    data: { resolvedAt: null }
  })
  return result
}
