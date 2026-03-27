import { prisma } from '../../utils/prisma'
import { syncStateCache } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // Fast path: Redis hash
  const cached = await syncStateCache.get(userId)
  if (cached) {
    return {
      lastSyncAt: cached.lastSyncAt || null,
      lastDeviceId: cached.lastDeviceId || null,
      totalMaps: parseInt(cached.totalMaps || '0', 10),
      pendingSyncs: 0
    }
  }

  // Fallback: PostgreSQL
  const state = await prisma.syncState.findUnique({
    where: { userId },
    select: { lastSyncAt: true, lastDeviceId: true, totalMaps: true }
  })

  if (state) {
    // Warm Redis cache
    await syncStateCache.update(userId, {
      lastSyncAt: state.lastSyncAt.toISOString(),
      lastDeviceId: state.lastDeviceId || '',
      totalMaps: state.totalMaps
    })

    return {
      lastSyncAt: state.lastSyncAt,
      lastDeviceId: state.lastDeviceId,
      totalMaps: state.totalMaps,
      pendingSyncs: 0
    }
  }

  return {
    lastSyncAt: null,
    lastDeviceId: null,
    totalMaps: 0,
    pendingSyncs: 0
  }
})
