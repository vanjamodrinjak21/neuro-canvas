import { prisma } from './prisma'

/**
 * Single source of truth for "does this user own this map".
 *
 * Services translate OwnershipError into their own error classes
 * (ShareError, VersionError) so existing API catch-sites keep their
 * statusCode mapping unchanged.
 */
export class OwnershipError extends Error {
  constructor(public reason: 'not_found' | 'forbidden') {
    super(reason === 'not_found' ? 'Map not found' : 'Not the map owner')
  }
}

/**
 * Throws OwnershipError('not_found') for a missing map and
 * OwnershipError('forbidden') for a non-owner. Returns the map row with the
 * version fields versionsService needs; other callers can ignore them.
 */
export async function assertMapOwnership(mapId: string, userId: string) {
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    select: { id: true, userId: true, ydocVersion: true, syncVersion: true }
  })
  if (!map) throw new OwnershipError('not_found')
  if (map.userId !== userId) throw new OwnershipError('forbidden')
  return map
}
