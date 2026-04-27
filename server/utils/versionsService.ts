/**
 * Version-history service. Owner-only access; decodes the Y.Doc binary stored
 * on each MapVersion row to support listing, previewing, restoring, and
 * diffing checkpoints. Restore swaps Map.ydoc and bumps Map.ydocVersion so
 * connected clients catch the change on next sync (and a separate broadcast
 * forces them to reload — see /reload kick).
 */
import * as Y from 'yjs'
import { prisma } from './prisma'
import { yDocToMapDocument } from '../../app/utils/ydocConverter'
import { cache, cacheKeys } from './redis'

export class VersionError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export interface ListVersionsOptions {
  limit?: number
  cursor?: string | null
}

export interface VersionListItem {
  id: string
  version: number
  byteSize: number
  authorId: string | null
  createdAt: Date
}

export interface VersionListResult {
  items: VersionListItem[]
  nextCursor: string | null
  total: number
}

export interface NodeSnapshot {
  id: string
  type: string
  content: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  [key: string]: unknown
}

export interface EdgeSnapshot {
  id: string
  sourceId: string
  targetId: string
  [key: string]: unknown
}

export interface VersionSnapshot {
  nodes: Map<string, NodeSnapshot>
  edges: Map<string, EdgeSnapshot>
  meta: Record<string, unknown>
}

export interface VersionDiff {
  nodes: {
    added: NodeSnapshot[]
    removed: NodeSnapshot[]
    updated: { id: string; fields: string[] }[]
  }
  edges: {
    added: EdgeSnapshot[]
    removed: EdgeSnapshot[]
    updated: { id: string; fields: string[] }[]
  }
}

async function assertOwnership(mapId: string, userId: string) {
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    select: { id: true, userId: true, ydocVersion: true }
  })
  if (!map) throw new VersionError(404, 'Map not found')
  if (map.userId !== userId) throw new VersionError(403, 'Not the map owner')
  return map
}

export async function listVersions(
  mapId: string,
  ownerUserId: string,
  opts: ListVersionsOptions
): Promise<VersionListResult> {
  await assertOwnership(mapId, ownerUserId)
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const cursor = opts.cursor ?? null

  const items = await prisma.mapVersion.findMany({
    where: { mapId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, version: true, byteSize: true, authorId: true, createdAt: true }
  })

  const hasMore = items.length > limit
  const trimmed = hasMore ? items.slice(0, limit) : items
  const total = await prisma.mapVersion.count({ where: { mapId } })

  return {
    items: trimmed,
    nextCursor: hasMore ? trimmed[trimmed.length - 1]!.id : null,
    total
  }
}

function decodeVersionDoc(bin: Uint8Array): Y.Doc {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, bin)
  return ydoc
}

function snapshotFromDoc(ydoc: Y.Doc): VersionSnapshot {
  const nodes = new Map<string, NodeSnapshot>()
  const edges = new Map<string, EdgeSnapshot>()
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges')

  ynodes.forEach((entry, id) => {
    const obj: Record<string, unknown> = { id }
    entry.forEach((v, k) => {
      obj[k] = v instanceof Y.Text ? v.toString() : v
    })
    nodes.set(id, obj as NodeSnapshot)
  })
  yedges.forEach((entry, id) => {
    const obj: Record<string, unknown> = { id }
    entry.forEach((v, k) => { obj[k] = v })
    edges.set(id, obj as EdgeSnapshot)
  })

  const ymeta = ydoc.getMap<unknown>('meta')
  const meta: Record<string, unknown> = {}
  ymeta.forEach((v, k) => { meta[k] = v })

  return { nodes, edges, meta }
}

export async function previewVersion(
  mapId: string,
  ownerUserId: string,
  versionId: string
): Promise<VersionSnapshot> {
  await assertOwnership(mapId, ownerUserId)
  const row = await prisma.mapVersion.findFirst({
    where: { id: versionId, mapId },
    select: { id: true, ydocBinary: true }
  })
  if (!row) throw new VersionError(404, 'Version not found')
  if (!row.ydocBinary) throw new VersionError(404, 'Version has no Y.Doc snapshot')
  return snapshotFromDoc(decodeVersionDoc(new Uint8Array(row.ydocBinary)))
}

export async function restoreVersion(
  mapId: string,
  ownerUserId: string,
  versionId: string
) {
  const map = await assertOwnership(mapId, ownerUserId)
  const row = await prisma.mapVersion.findFirst({
    where: { id: versionId, mapId },
    select: { id: true, ydocBinary: true, version: true }
  })
  if (!row) throw new VersionError(404, 'Version not found')
  if (!row.ydocBinary) throw new VersionError(404, 'Version has no Y.Doc snapshot')

  // Regenerate the JSON snapshot so the existing /api/sync/pull path returns
  // consistent state immediately after restore. Mirrors collabFlush.applyFlush.
  const ydoc = decodeVersionDoc(new Uint8Array(row.ydocBinary))
  const json = yDocToMapDocument(ydoc, {
    id: mapId,
    title: '',
    createdAt: 0,
    updatedAt: Date.now()
  })
  const dataJson = {
    nodes: Array.from(json.nodes.values()),
    edges: Array.from(json.edges.values()),
    camera: json.camera,
    rootNodeId: json.rootNodeId ?? null,
    settings: json.settings
  }

  const nextVersion = (map.ydocVersion ?? 0) + 1
  const updated = await prisma.map.update({
    where: { id: mapId },
    data: {
      ydoc: row.ydocBinary,
      ydocVersion: nextVersion,
      data: dataJson as object,
      updatedAt: new Date()
    }
  })

  // Bust the per-user JSON cache so the next /api/sync/pull doesn't hand
  // out the pre-restore snapshot.
  await Promise.all([
    cache.del(cacheKeys.mapData(mapId, ownerUserId)),
    cache.del(cacheKeys.mapMeta(mapId, ownerUserId))
  ]).catch(() => { /* cache best-effort */ })

  return { id: updated.id, ydocVersion: updated.ydocVersion, restoredFromVersion: row.version }
}

function diffMaps<T extends { id: string }>(
  fromMap: Map<string, T>,
  toMap: Map<string, T>,
  scalarFields: readonly string[]
): { added: T[]; removed: T[]; updated: { id: string; fields: string[] }[] } {
  const added: T[] = []
  const removed: T[] = []
  const updated: { id: string; fields: string[] }[] = []

  toMap.forEach((to, id) => {
    const from = fromMap.get(id)
    if (!from) { added.push(to); return }
    const fields: string[] = []
    for (const k of scalarFields) {
      const a = (from as Record<string, unknown>)[k]
      const b = (to as Record<string, unknown>)[k]
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) fields.push(k)
    }
    if (fields.length) updated.push({ id, fields })
  })
  fromMap.forEach((from, id) => {
    if (!toMap.has(id)) removed.push(from)
  })

  return { added, removed, updated }
}

const NODE_DIFF_FIELDS = ['type', 'content', 'position', 'size', 'style', 'parentId', 'collapsed', 'locked', 'metadata'] as const
const EDGE_DIFF_FIELDS = ['sourceId', 'targetId', 'label', 'style', 'sourceAnchor', 'targetAnchor'] as const

export async function diffVersions(
  mapId: string,
  ownerUserId: string,
  fromVersionId: string,
  toVersionId: string
): Promise<VersionDiff> {
  await assertOwnership(mapId, ownerUserId)
  const [fromRow, toRow] = await Promise.all([
    prisma.mapVersion.findFirst({ where: { id: fromVersionId, mapId }, select: { id: true, ydocBinary: true } }),
    prisma.mapVersion.findFirst({ where: { id: toVersionId, mapId }, select: { id: true, ydocBinary: true } })
  ])
  if (!fromRow?.ydocBinary || !toRow?.ydocBinary) {
    throw new VersionError(404, 'Both versions must have Y.Doc snapshots to diff')
  }

  const fromSnap = snapshotFromDoc(decodeVersionDoc(new Uint8Array(fromRow.ydocBinary)))
  const toSnap = snapshotFromDoc(decodeVersionDoc(new Uint8Array(toRow.ydocBinary)))

  return {
    nodes: diffMaps(fromSnap.nodes, toSnap.nodes, NODE_DIFF_FIELDS),
    edges: diffMaps(fromSnap.edges, toSnap.edges, EDGE_DIFF_FIELDS)
  }
}
