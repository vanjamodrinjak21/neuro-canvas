import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  resolveThread,
  reopenThread,
  CommentError,
  type CommentActor
} from '../commentsService'

vi.mock('../prisma', () => ({
  prisma: {
    map: { findUnique: vi.fn() },
    mapShare: { findUnique: vi.fn() },
    comment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn()
    },
    commentMention: { createMany: vi.fn() },
    $transaction: vi.fn()
  }
}))

const ownerActor: CommentActor = { id: 'owner1', name: 'Owner', color: '#abc', isOwner: true, role: 'editor' }
const commenterActor: CommentActor = { id: 'guest:abc', name: 'Guest', color: '#def', isOwner: false, role: 'commenter' }
const viewerActor: CommentActor = { id: 'guest:xyz', name: 'Guest', color: '#fff', isOwner: false, role: 'viewer' }

describe('commentsService', () => {
  beforeEach(() => vi.resetAllMocks())

  describe('listComments', () => {
    it('returns rows for any actor with at least viewer access', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', threadId: 't1', body: 'hi', resolvedAt: null }
      ])
      const out = await listComments('m1', viewerActor)
      expect(out).toHaveLength(1)
    })
  })

  describe('createComment', () => {
    it('rejects viewer (needs commenter+)', async () => {
      await expect(
        createComment('m1', viewerActor, { body: 'hi', threadId: null, anchorNodeId: null, anchorX: null, anchorY: null, mentions: [] })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('lets a commenter create a new thread when no threadId is given', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
        Promise.resolve({ ...data })
      )
      const out = await createComment('m1', commenterActor, {
        body: 'hello', threadId: null, anchorNodeId: 'n1', anchorX: null, anchorY: null, mentions: []
      })
      expect(out.body).toBe('hello')
      expect(out.threadId).toBe(out.id) // first message uses its own id as threadId
      expect(out.anchorNodeId).toBe('n1')
    })

    it('rejects empty body', async () => {
      await expect(
        createComment('m1', commenterActor, { body: '   ', threadId: null, anchorNodeId: null, anchorX: null, anchorY: null, mentions: [] })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('reuses provided threadId for replies', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        threadId: 't1', mapId: 'm1', anchorNodeId: 'n2', anchorX: null, anchorY: null, resolvedAt: null
      })
      ;(prisma.comment.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
        Promise.resolve({ ...data })
      )
      const out = await createComment('m1', commenterActor, {
        body: 'reply', threadId: 't1', anchorNodeId: null, anchorX: null, anchorY: null, mentions: []
      })
      expect(out.threadId).toBe('t1')
      expect(out.anchorNodeId).toBe('n2') // anchor inherited from first message of the thread
    })
  })

  describe('updateComment', () => {
    it('lets the author edit their own message', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'c1', mapId: 'm1', authorId: 'guest:abc', body: 'old'
      })
      ;(prisma.comment.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'c1', ...data })
      )
      const out = await updateComment('m1', commenterActor, 'c1', { body: 'new' })
      expect(out.body).toBe('new')
    })

    it('rejects edits by a different author', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'c1', mapId: 'm1', authorId: 'someone-else', body: 'old'
      })
      await expect(updateComment('m1', commenterActor, 'c1', { body: 'new' })).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('deleteComment', () => {
    it('lets the author delete their own message', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'c1', mapId: 'm1', authorId: 'guest:abc'
      })
      ;(prisma.comment.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' })
      await expect(deleteComment('m1', commenterActor, 'c1')).resolves.toMatchObject({ id: 'c1' })
    })

    it('lets the owner delete anyone else\'s message', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'c1', mapId: 'm1', authorId: 'someone-else'
      })
      ;(prisma.comment.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' })
      await expect(deleteComment('m1', ownerActor, 'c1')).resolves.toMatchObject({ id: 'c1' })
    })

    it('rejects a non-owner trying to delete another author\'s message', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'c1', mapId: 'm1', authorId: 'someone-else'
      })
      await expect(deleteComment('m1', commenterActor, 'c1')).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('resolveThread / reopenThread', () => {
    it('owner can resolve any thread', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 })
      const out = await resolveThread('m1', ownerActor, 't1')
      expect(out.count).toBe(3)
    })

    it('reopenThread clears resolvedAt', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.comment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 })
      await reopenThread('m1', ownerActor, 't1')
      const updateCall = (prisma.comment.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(updateCall.data.resolvedAt).toBeNull()
    })

    it('viewer cannot resolve', async () => {
      await expect(resolveThread('m1', viewerActor, 't1')).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  it('CommentError is exported and a subclass of Error', () => {
    expect(new CommentError(404, 'x')).toBeInstanceOf(Error)
  })
})
