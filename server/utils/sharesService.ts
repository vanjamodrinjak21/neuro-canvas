import { nanoid } from 'nanoid'
import { prisma } from './prisma'
import type { ShareRole } from '../generated/prisma'

export class ShareError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export interface CreateShareInput {
  role: 'viewer' | 'editor'
  label: string | null
  expiresAt: Date | null
}

export interface UpdateShareInput {
  role?: 'viewer' | 'editor'
  label?: string | null
  expiresAt?: Date | null
}

const ROLE_TO_ENUM: Record<string, ShareRole> = { viewer: 'VIEWER', editor: 'EDITOR' }

async function assertOwnership(mapId: string, userId: string): Promise<void> {
  const map = await prisma.map.findUnique({ where: { id: mapId }, select: { id: true, userId: true } })
  if (!map) throw new ShareError(404, 'Map not found')
  if (map.userId !== userId) throw new ShareError(403, 'Not the map owner')
}

export async function listShares(mapId: string, ownerUserId: string) {
  await assertOwnership(mapId, ownerUserId)
  return prisma.mapShare.findMany({
    where: { mapId },
    orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }]
  })
}

export async function createShare(mapId: string, ownerUserId: string, input: CreateShareInput) {
  await assertOwnership(mapId, ownerUserId)
  const role = ROLE_TO_ENUM[input.role]
  if (!role) throw new ShareError(400, 'Invalid role')

  const token = nanoid(16)
  return prisma.mapShare.create({
    data: {
      mapId,
      token,
      createdBy: ownerUserId,
      role,
      label: input.label,
      expiresAt: input.expiresAt
    }
  })
}

export async function updateShare(
  mapId: string,
  ownerUserId: string,
  shareId: string,
  input: UpdateShareInput
) {
  await assertOwnership(mapId, ownerUserId)
  const share = await prisma.mapShare.findFirst({ where: { id: shareId, mapId } })
  if (!share) throw new ShareError(404, 'Share not found')

  const data: { role?: ShareRole; label?: string | null; expiresAt?: Date | null } = {}
  if (input.role !== undefined) {
    const role = ROLE_TO_ENUM[input.role]
    if (!role) throw new ShareError(400, 'Invalid role')
    data.role = role
  }
  if (input.label !== undefined) data.label = input.label
  if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt

  return prisma.mapShare.update({ where: { id: shareId }, data })
}

/**
 * Soft-revoke. Idempotent: a second revoke returns the existing record without
 * touching the database, so PartyKit kicks aren't replayed on no-op revokes.
 */
export async function revokeShare(mapId: string, ownerUserId: string, shareId: string) {
  await assertOwnership(mapId, ownerUserId)
  const share = await prisma.mapShare.findFirst({ where: { id: shareId, mapId } })
  if (!share) throw new ShareError(404, 'Share not found')
  if (share.revokedAt) return share
  return prisma.mapShare.update({
    where: { id: shareId },
    data: { revokedAt: new Date() }
  })
}
