import { prisma } from '../../utils/prisma'
import { cache, cacheKeys, checkRateLimit, syncStateCache, trackSyncMetric } from '../../utils/redis'
import { requireAuthSession, generateChecksum, computeByteSize } from '../../utils/syncHelpers'
import { validateBody, syncBulkPushSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const body = validateBody(syncBulkPushSchema, await readBody(event))

  const { allowed } = await checkRateLimit(userId, 120, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const results: Array<{ mapId: string; action: string; syncVersion?: number }> = []

  for (const map of body.maps) {
    try {
      const existing = await prisma.map.findFirst({
        where: { id: map.mapId, userId },
        select: { syncVersion: true, checksum: true }
      })

      const serverChecksum = generateChecksum(map.data)
      const byteSize = computeByteSize(map.data)

      if (existing && existing.checksum === serverChecksum) {
        results.push({ mapId: map.mapId, action: 'skipped', syncVersion: existing.syncVersion })
        continue
      }

      const maxVersion = await prisma.mapVersion.aggregate({
        where: { mapId: map.mapId },
        _max: { version: true }
      })
      const newVersion = (maxVersion._max.version ?? 0) + 1

      if (!existing) {
        await prisma.map.create({
          data: {
            id: map.mapId,
            userId,
            title: map.title,
            data: map.data as any,
            checksum: serverChecksum,
            preview: map.preview || null,
            syncVersion: newVersion,
            byteSize,
            tags: map.tags || []
          }
        })
      } else {
        await prisma.map.update({
          where: { id: map.mapId },
          data: {
            title: map.title,
            data: map.data as any,
            checksum: serverChecksum,
            preview: map.preview || null,
            syncVersion: newVersion,
            byteSize,
            tags: map.tags || [],
            deletedAt: null
          }
        })
      }

      await prisma.mapVersion.create({
        data: {
          mapId: map.mapId,
          version: newVersion,
          data: map.data as any,
          checksum: serverChecksum,
          deviceId: body.deviceId || null,
          byteSize
        }
      })

      await cache.set(cacheKeys.mapMeta(map.mapId), { syncVersion: newVersion, checksum: serverChecksum }, 3600)
      results.push({ mapId: map.mapId, action: existing ? 'updated' : 'created', syncVersion: newVersion })
    } catch (err) {
      console.error(`Bulk push error for map ${map.mapId}:`, err)
      results.push({ mapId: map.mapId, action: 'error' })
    }
  }

  const totalMaps = await prisma.map.count({ where: { userId, deletedAt: null } })
  await syncStateCache.update(userId, {
    lastSyncAt: new Date().toISOString(),
    lastDeviceId: body.deviceId || '',
    totalMaps
  })

  await prisma.syncState.upsert({
    where: { userId },
    create: { userId, lastDeviceId: body.deviceId, totalMaps },
    update: { lastSyncAt: new Date(), lastDeviceId: body.deviceId, totalMaps }
  })

  await trackSyncMetric('bulk_pushes')

  return { ok: true, results }
})
