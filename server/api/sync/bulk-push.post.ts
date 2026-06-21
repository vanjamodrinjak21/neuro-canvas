import { prisma } from '../../utils/prisma'
import { cache, cacheKeys, checkRateLimit, syncStateCache, trackSyncMetric } from '../../utils/redis'
import { requireAuthSession, generateChecksum, computeByteSize } from '../../utils/syncHelpers'
import { validateBody, syncBulkPushSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const body = validateBody(syncBulkPushSchema, await readBody(event))

  const { allowed } = await checkRateLimit(cacheKeys.syncRate(userId), 120, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const incoming = body.maps
  if (incoming.length === 0) {
    return { ok: true, results: [] as Array<{ mapId: string; action: string; syncVersion?: number }> }
  }

  const ids = incoming.map(m => m.mapId)

  // ─── Batch the existence + ownership + version lookups ──────────
  // Previously each map cost 2-3 serial round-trips (findFirst → findUnique
  // → aggregate). Folding them into 2 set-based queries cuts the N-map
  // case from O(3N) to O(2) round-trips for the read phase, and removes
  // the cross-user `findUnique` from the hot loop entirely.
  const [ownedRows, foreignRows, maxVersions] = await Promise.all([
    prisma.map.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, syncVersion: true, checksum: true },
    }),
    prisma.map.findMany({
      where: { id: { in: ids }, userId: { not: userId } },
      select: { id: true },
    }),
    prisma.mapVersion.groupBy({
      by: ['mapId'],
      where: { mapId: { in: ids } },
      _max: { version: true },
    }),
  ])

  const ownedById = new Map(ownedRows.map(r => [r.id, r]))
  const foreignIds = new Set(foreignRows.map(r => r.id))
  const maxVersionById = new Map(
    maxVersions.map(v => [v.mapId, v._max.version ?? 0]),
  )

  const results: Array<{ mapId: string; action: string; syncVersion?: number }> = []

  for (const map of incoming) {
    try {
      const existing = ownedById.get(map.mapId) ?? null

      // Defense-in-depth: foreign-owned mapId — refuse without leaking
      // P2002 unique-violation through Prisma.
      if (!existing && foreignIds.has(map.mapId)) {
        results.push({ mapId: map.mapId, action: 'forbidden' })
        continue
      }

      const serverChecksum = generateChecksum(map.data)
      const byteSize = computeByteSize(map.data)

      if (existing && existing.checksum === serverChecksum) {
        results.push({ mapId: map.mapId, action: 'skipped', syncVersion: existing.syncVersion })
        continue
      }

      // Reject stale syncVersion writes — mirrors the single-map push
      // path so two devices can't silently clobber each other's state.
      if (existing && typeof map.syncVersion === 'number' && map.syncVersion < existing.syncVersion) {
        results.push({ mapId: map.mapId, action: 'conflict', syncVersion: existing.syncVersion })
        continue
      }

      const newVersion = (maxVersionById.get(map.mapId) ?? 0) + 1

      // Wrap each map's two writes in a transaction so a partial failure
      // (Map create succeeds, MapVersion create fails) can't leave a row
      // without its corresponding version snapshot.
      if (!existing) {
        await prisma.$transaction([
          prisma.map.create({
            data: {
              id: map.mapId,
              userId,
              title: map.title,
              data: map.data as any,
              checksum: serverChecksum,
              preview: map.preview || null,
              syncVersion: newVersion,
              byteSize,
              tags: map.tags || [],
            },
          }),
          prisma.mapVersion.create({
            data: {
              mapId: map.mapId,
              version: newVersion,
              data: map.data as any,
              checksum: serverChecksum,
              deviceId: body.deviceId || null,
              byteSize,
            },
          }),
        ])
      } else {
        await prisma.$transaction([
          prisma.map.update({
            where: { id: map.mapId },
            data: {
              title: map.title,
              data: map.data as any,
              checksum: serverChecksum,
              preview: map.preview || null,
              syncVersion: newVersion,
              byteSize,
              tags: map.tags || [],
              deletedAt: null,
            },
          }),
          prisma.mapVersion.create({
            data: {
              mapId: map.mapId,
              version: newVersion,
              data: map.data as any,
              checksum: serverChecksum,
              deviceId: body.deviceId || null,
              byteSize,
            },
          }),
        ])
      }

      await cache.set(cacheKeys.mapMeta(map.mapId, userId), { syncVersion: newVersion, checksum: serverChecksum }, 3600)
      results.push({ mapId: map.mapId, action: existing ? 'updated' : 'created', syncVersion: newVersion })
    } catch (err) {
      // Log just the code / error name — never the raw message, which
      // can contain SQL fragments, constraint names, or value snippets.
      const code = (err as { code?: string })?.code
      const name = (err as Error)?.name
      console.error('bulk push failed', { mapId: map.mapId, code, name })
      results.push({ mapId: map.mapId, action: 'error' })
    }
  }

  // syncState + metric in parallel — neither depends on the other.
  const totalMaps = await prisma.map.count({ where: { userId, deletedAt: null } })
  await Promise.all([
    syncStateCache.update(userId, {
      lastSyncAt: new Date().toISOString(),
      lastDeviceId: body.deviceId || '',
      totalMaps,
    }),
    prisma.syncState.upsert({
      where: { userId },
      create: { userId, lastDeviceId: body.deviceId, totalMaps },
      update: { lastSyncAt: new Date(), lastDeviceId: body.deviceId, totalMaps },
    }),
    trackSyncMetric('bulk_pushes'),
  ])

  return { ok: true, results }
})
