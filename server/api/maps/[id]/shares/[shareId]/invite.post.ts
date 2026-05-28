import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { requireAuthSession } from '../../../../../utils/syncHelpers'
import { checkRateLimit } from '../../../../../utils/redis'
import { sendEmail, buildInviteEmail } from '../../../../../utils/email'

const MAX_RECIPIENTS_PER_REQUEST = 20

const inviteSchema = z.object({
  recipients: z.array(z.email()).min(1).max(MAX_RECIPIENTS_PER_REQUEST),
  personalNote: z.string().max(500).optional(),
})

/**
 * Send an existing share's `/s/{token}` URL to one or more email
 * recipients. Only the share owner can invite. Rate-limited per user
 * to prevent the endpoint from being used as a spam relay.
 */
export default defineEventHandler(async (event) => {
  const { userId, email: inviterEmail } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  const shareId = getRouterParam(event, 'shareId')
  if (!mapId || !shareId) {
    throw createError({ statusCode: 400, statusMessage: 'mapId and shareId required' })
  }

  // 10 invite requests / hour / user. Each request can carry up to 20
  // recipients, so an hourly ceiling of 200 invited addresses per user
  // — enough for real workflows, low enough to neutralise abuse.
  const { allowed } = await checkRateLimit(`share:invite:${userId}`, 10, 3600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many invite requests — try again later' })
  }

  const parsed = inviteSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid invite payload' })
  }
  const { recipients, personalNote } = parsed.data

  // Deduplicate, normalise to lowercase, drop the inviter's own email
  // (no point in self-invites).
  const normalized = Array.from(new Set(
    recipients
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e !== inviterEmail.toLowerCase()),
  ))
  if (normalized.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid recipients' })
  }

  // Verify the share belongs to a map this user owns + isn't revoked.
  const share = await prisma.mapShare.findUnique({
    where: { id: shareId },
    select: {
      id: true,
      token: true,
      role: true,
      revokedAt: true,
      expiresAt: true,
      mapId: true,
      map: { select: { id: true, userId: true, title: true } },
    },
  })
  if (!share || share.mapId !== mapId) {
    throw createError({ statusCode: 404, statusMessage: 'Share not found' })
  }
  if (share.map.userId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'You do not own this map' })
  }
  if (share.revokedAt) {
    throw createError({ statusCode: 410, statusMessage: 'Share link has been revoked' })
  }
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'Share link has expired' })
  }

  // Build the URL from server-side config, NOT request headers. Using
  // Origin / X-Forwarded-Host / Host here would let an attacker forge a
  // request that emails the recipient a phishing link on a domain they
  // control. AUTH_ORIGIN is set at deploy time per environment.
  const origin = useRuntimeConfig(event).public.authOrigin
  if (!origin || !/^https?:\/\//.test(origin)) {
    throw createError({ statusCode: 500, statusMessage: 'Server misconfigured: AUTH_ORIGIN missing' })
  }
  const shareUrl = `${origin.replace(/\/+$/, '')}/s/${encodeURIComponent(share.token)}`

  // Look up the inviter's display name once.
  const inviter = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })
  const inviterName = inviter?.name || inviter?.email || 'A NeuroCanvas user'

  const { subject, html } = buildInviteEmail({
    mapTitle: share.map.title || 'Untitled map',
    inviterName,
    role: share.role,
    shareUrl,
    personalNote,
  })

  // Fan out sends in parallel but bound concurrency so a 20-recipient
  // request can't open 20 simultaneous Resend connections.
  const results = await Promise.all(
    normalized.map(to => sendEmail({ to, subject, html, replyTo: inviter?.email || undefined })),
  )

  const sent = results.filter(r => r.ok).length
  const failed = results.length - sent

  // Track lastUsedAt so the share list reflects real activity.
  if (sent > 0) {
    await prisma.mapShare.update({
      where: { id: shareId },
      data: { lastUsedAt: new Date() },
    })
  }

  return {
    ok: failed === 0,
    sent,
    failed,
    recipients: normalized.length,
  }
})
