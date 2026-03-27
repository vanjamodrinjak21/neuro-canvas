import { prisma } from '../../utils/prisma'
import { syncStream } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const query = getQuery(event)

  const lastStreamId = query.lastStreamId ? String(query.lastStreamId) : undefined
  const since = query.since ? new Date(String(query.since)) : undefined

  // Primary: Redis stream
  if (lastStreamId) {
    const entries = await syncStream.readSince(userId, lastStreamId)
    if (entries.length > 0) {
      return { entries, source: 'stream' as const }
    }
  }

  // Fallback: PostgreSQL MapVersion table
  if (since) {
    const versions = await prisma.mapVersion.findMany({
      where: {
        map: { userId },
        createdAt: { gte: since }
      },
      select: {
        id: true,
        mapId: true,
        version: true,
        deviceId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' },
      take: 100
    })

    return {
      entries: versions.map(v => ({
        id: v.id,
        data: {
          mapId: v.mapId,
          syncVersion: String(v.version),
          action: 'push',
          deviceId: v.deviceId || '',
          timestamp: v.createdAt.toISOString()
        }
      })),
      source: 'postgres' as const
    }
  }

  return { entries: [], source: 'empty' as const }
})
