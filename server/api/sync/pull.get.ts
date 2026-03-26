import { prisma } from '../../utils/prisma'
import { cache, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const query = getQuery(event)

  const since = query.since ? new Date(String(query.since)) : undefined
  const mapId = query.mapId ? String(query.mapId) : undefined

  // Validate date format
  if (since && isNaN(since.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid since parameter — must be ISO 8601 date' })
  }

  // Validate mapId length
  if (mapId && mapId.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid mapId parameter' })
  }

  // Single map pull
  if (mapId) {
    // Try Redis cache first
    const cached = await cache.get<{ data: unknown; title: string; tags: string[] }>(cacheKeys.mapData(mapId))
    const cachedMeta = await cache.get<{ syncVersion: number; checksum: string }>(cacheKeys.mapMeta(mapId))

    if (cached && cachedMeta) {
      return {
        maps: [{
          id: mapId,
          title: cached.title,
          data: cached.data,
          syncVersion: cachedMeta.syncVersion,
          checksum: cachedMeta.checksum,
          tags: cached.tags || [],
          updatedAt: new Date().toISOString()
        }],
        deleted: []
      }
    }

    // Fallback to PG
    const map = await prisma.map.findFirst({
      where: { id: mapId, userId },
      select: {
        id: true, title: true, data: true, checksum: true,
        syncVersion: true, tags: true, preview: true,
        byteSize: true, deletedAt: true, createdAt: true, updatedAt: true
      }
    })

    if (!map) {
      return { maps: [], deleted: [] }
    }

    if (map.deletedAt) {
      return { maps: [], deleted: [map.id] }
    }

    // Warm cache
    await cache.set(cacheKeys.mapMeta(map.id), { syncVersion: map.syncVersion, checksum: map.checksum }, 3600)
    await cache.set(cacheKeys.mapData(map.id), { data: map.data, title: map.title, tags: map.tags }, 3600)

    return {
      maps: [{
        id: map.id,
        title: map.title,
        data: map.data,
        syncVersion: map.syncVersion,
        checksum: map.checksum,
        tags: map.tags,
        preview: map.preview,
        byteSize: map.byteSize,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt
      }],
      deleted: []
    }
  }

  // Bulk pull — all maps updated since timestamp
  const where: Record<string, unknown> = { userId }
  if (since) {
    where.updatedAt = { gte: since }
  }

  const maps = await prisma.map.findMany({
    where: { userId, deletedAt: null, ...(since ? { updatedAt: { gte: since } } : {}) },
    select: {
      id: true, title: true, data: true, checksum: true,
      syncVersion: true, tags: true, preview: true,
      byteSize: true, createdAt: true, updatedAt: true
    },
    orderBy: { updatedAt: 'desc' }
  })

  // Also get soft-deleted maps so client can remove them
  const deleted = since
    ? await prisma.map.findMany({
        where: { userId, deletedAt: { not: null, gte: since } },
        select: { id: true }
      })
    : []

  return {
    maps: maps.map(m => ({
      id: m.id,
      title: m.title,
      data: m.data,
      syncVersion: m.syncVersion,
      checksum: m.checksum,
      tags: m.tags,
      preview: m.preview,
      byteSize: m.byteSize,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt
    })),
    deleted: deleted.map(d => d.id)
  }
})
