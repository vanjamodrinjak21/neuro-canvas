import { prisma } from '../../utils/prisma'
import { redis, cache, cacheKeys, syncLock, checkRateLimit, syncStream, syncStateCache, trackSyncMetric } from '../../utils/redis'
import { requireAuthSession, generateChecksum, computeByteSize } from '../../utils/syncHelpers'
import { validateBody, syncPushSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const body = validateBody(syncPushSchema, await readBody(event))

  // 1. Rate limit
  const { allowed, remaining } = await checkRateLimit(userId)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded. Try again later.' })
  }
  setResponseHeader(event, 'X-RateLimit-Remaining', String(remaining))

  // 2. Acquire distributed lock
  const lockAcquired = await syncLock.acquire(body.mapId, body.deviceId || 'unknown')
  if (!lockAcquired) {
    throw createError({ statusCode: 423, statusMessage: 'Map is locked by another sync operation' })
  }

  try {
    // Handle soft-delete
    if (body.action === 'delete') {
      const deleted = await prisma.map.updateMany({
        where: { id: body.mapId, userId },
        data: { deletedAt: new Date() }
      })

      if (deleted.count === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Map not found' })
      }

      await redis.publish(cacheKeys.syncChannel(userId), JSON.stringify({
        mapId: body.mapId,
        action: 'delete',
        deviceId: body.deviceId
      }))

      await trackSyncMetric('deletes')
      return { ok: true }
    }

    // 3. Read current state for checksum comparison only
    let currentChecksum: string | null = null

    const cachedMeta = await cache.get<{ syncVersion: number; checksum: string }>(cacheKeys.mapMeta(body.mapId, userId))
    if (cachedMeta) {
      currentChecksum = cachedMeta.checksum
    } else {
      const existing = await prisma.map.findFirst({
        where: { id: body.mapId, userId },
        select: { checksum: true }
      })
      if (existing) {
        currentChecksum = existing.checksum
      }
    }

    // 4. Skip if checksums match (no actual change)
    const serverChecksum = generateChecksum(body.data)
    if (currentChecksum === serverChecksum) {
      const existingVersion = cachedMeta?.syncVersion || (await prisma.map.findFirst({
        where: { id: body.mapId, userId },
        select: { syncVersion: true }
      }))?.syncVersion || 0
      return { ok: true, syncVersion: existingVersion, noChange: true }
    }

    // 5. Conflict detection — reject stale pushes
    const byteSize = computeByteSize(body.data)

    const existing = await prisma.map.findFirst({
      where: { id: body.mapId, userId },
      select: { syncVersion: true }
    })

    if (existing && body.syncVersion && body.syncVersion < existing.syncVersion) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict: server has a newer version. Pull first.'
      })
    }

    // Ownership guard: check if map exists and belongs to a different user
    const anyExisting = await prisma.map.findUnique({
      where: { id: body.mapId },
      select: { userId: true }
    })
    if (anyExisting && anyExisting.userId !== userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Map belongs to another user'
      })
    }

    const maxVersion = await prisma.mapVersion.aggregate({
      where: { mapId: body.mapId },
      _max: { version: true }
    })
    const dbMaxVersion = maxVersion._max.version ?? 0
    const newVersion = dbMaxVersion + 1

    await prisma.map.upsert({
      where: { id: body.mapId },
      create: {
        id: body.mapId,
        userId,
        title: body.title,
        data: body.data as any,
        checksum: serverChecksum,
        preview: body.preview || null,
        syncVersion: newVersion,
        byteSize,
        tags: body.tags || []
      },
      update: {
        title: body.title,
        data: body.data as any,
        checksum: serverChecksum,
        preview: body.preview || null,
        syncVersion: newVersion,
        byteSize,
        tags: body.tags || [],
        deletedAt: null
      }
    })

    // 6. Insert MapVersion (keep last 20)
    await prisma.mapVersion.upsert({
      where: {
        mapId_version: { mapId: body.mapId, version: newVersion }
      },
      create: {
        mapId: body.mapId,
        version: newVersion,
        data: body.data as any,
        checksum: serverChecksum,
        deviceId: body.deviceId || null,
        byteSize
      },
      update: {
        data: body.data as any,
        checksum: serverChecksum,
        deviceId: body.deviceId || null,
        byteSize
      }
    })

    // Prune old versions
    const oldVersions = await prisma.mapVersion.findMany({
      where: { mapId: body.mapId },
      orderBy: { version: 'desc' },
      skip: 20,
      select: { id: true }
    })
    if (oldVersions.length > 0) {
      await prisma.mapVersion.deleteMany({
        where: { id: { in: oldVersions.map(v => v.id) } }
      })
    }

    // 7. Cache — scoped by userId
    await cache.set(cacheKeys.mapMeta(body.mapId, userId), { syncVersion: newVersion, checksum: serverChecksum }, 3600)
    await cache.set(cacheKeys.mapData(body.mapId, userId), { data: body.data, title: body.title, tags: body.tags || [] }, 3600)

    // 8. Publish
    await redis.publish(cacheKeys.syncChannel(userId), JSON.stringify({
      mapId: body.mapId,
      syncVersion: newVersion,
      action: 'update',
      deviceId: body.deviceId
    }))

    // 9. Stream log
    await syncStream.addEntry(userId, {
      mapId: body.mapId,
      syncVersion: String(newVersion),
      action: 'push',
      deviceId: body.deviceId || '',
      timestamp: new Date().toISOString()
    })

    // 10. Sync state
    await syncStateCache.update(userId, {
      lastSyncAt: new Date().toISOString(),
      lastDeviceId: body.deviceId || '',
      totalMaps: String(await prisma.map.count({ where: { userId, deletedAt: null } }))
    })

    await prisma.syncState.upsert({
      where: { userId },
      create: { userId, lastDeviceId: body.deviceId, totalMaps: 1, totalByteSize: BigInt(byteSize) },
      update: { lastSyncAt: new Date(), lastDeviceId: body.deviceId }
    })

    await trackSyncMetric('pushes')
    await trackSyncMetric('bytes_pushed', byteSize)

    return { ok: true, syncVersion: newVersion }
  } finally {
    await syncLock.release(body.mapId, body.deviceId || 'unknown')
  }
})
