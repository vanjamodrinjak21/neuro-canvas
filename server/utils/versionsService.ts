/**
 * Version-history service. Owner-only access; decodes the Y.Doc binary stored
 * on each MapVersion row to support listing, previewing, restoring, and
 * diffing checkpoints. Restore swaps Map.ydoc and bumps Map.ydocVersion so
 * connected clients catch the change on next sync (and a separate broadcast
 * forces them to reload — see /reload kick).
 */
import { createHash } from 'node:crypto'
import * as Y from 'yjs'
import { prisma } from './prisma'
import { assertMapOwnership, OwnershipError } from './ownership'
import { yDocToMapDocument, mapDocumentToYDoc } from '../../app/utils/ydocConverter'
import { cache, cacheKeys } from './redis'
import type { MapDocument, Node, Edge, Camera, MapSettings } from '../../app/types'

// Inlined from syncHelpers (which pulls #auth into its module graph) so this
// service stays import-light and unit-testable. Same algorithm, so the value
// is interchangeable with the plain-sync push path.
function checksumOf(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex')
}
function byteSizeOf(data: unknown): number {
  return Buffer.byteLength(JSON.stringify(data), 'utf8')
}

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
  /** Display name from User.name (preferred). Null for guests, missing users, or legacy rows. */
  authorName: string | null
  /** Email fallback only when User.name is missing — never exposed if name is present. */
  authorEmail: string | null
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
  try {
    return await assertMapOwnership(mapId, userId)
  } catch (err) {
    if (err instanceof OwnershipError) {
      throw new VersionError(err.reason === 'not_found' ? 404 : 403, err.message)
    }
    throw err
  }
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

  // Enrich each row with the author's display name (and email as a fallback)
  // so the Version History panel can show "Vanja Modrinjak" instead of "clx9a2".
  // MapVersion has no direct user relation, so we do a manual lookup.
  // Guest authors (id starts with "guest:") and unknown ids stay null on both fields.
  const realUserIds = Array.from(
    new Set(
      trimmed
        .map(v => v.authorId)
        .filter((id): id is string => !!id && !id.startsWith('guest:'))
    )
  )
  const users = realUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: realUserIds } },
        select: { id: true, name: true, email: true }
      })
    : []
  const byId = new Map(users.map(u => [u.id, u]))

  const enriched: VersionListItem[] = trimmed.map(v => {
    const u = v.authorId ? byId.get(v.authorId) : undefined
    return {
      id: v.id,
      version: v.version,
      byteSize: v.byteSize,
      authorId: v.authorId,
      // Prefer User.name to avoid leaking emails. Only fall back to email
      // when name is empty/null. Guests and unknown authors get null/null.
      authorName: u?.name ?? null,
      authorEmail: u?.name ? null : (u?.email ?? null),
      createdAt: v.createdAt
    }
  })

  return {
    items: enriched,
    nextCursor: hasMore ? enriched[enriched.length - 1]!.id : null,
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

/** The plain-JSON shape persisted to Map.data and MapVersion.data. */
export interface RestoreSnapshot {
  nodes: Node[]
  edges: Edge[]
  camera: Camera
  rootNodeId: string | null
  settings: MapSettings
}

/**
 * Rebuild a MapVersion into a MapDocument plus a canonical Y.Doc binary.
 *
 * Collab checkpoints carry a `ydocBinary`; plain-sync checkpoints (created by
 * /api/sync/push) only carry the JSON `data` blob and never have a Y.Doc
 * snapshot. We accept either source so *every* listed version is restorable —
 * previously a JSON-only version threw 404 "Version has no Y.Doc snapshot",
 * which is the common case for solo editing without realtime collab.
 */
function reconstructVersionDoc(
  mapId: string,
  row: { ydocBinary: Uint8Array | null; data: unknown }
): { mapDoc: MapDocument; ydocBinary: Uint8Array } {
  if (row.ydocBinary) {
    const ydoc = decodeVersionDoc(new Uint8Array(row.ydocBinary))
    const mapDoc = yDocToMapDocument(ydoc, { id: mapId, title: '', createdAt: 0, updatedAt: Date.now() })
    return { mapDoc, ydocBinary: new Uint8Array(row.ydocBinary) }
  }
  const mapDoc = mapDocumentFromData(mapId, row.data)
  return { mapDoc, ydocBinary: Y.encodeStateAsUpdate(mapDocumentToYDoc(mapDoc)) }
}

/** Fallback canvas settings, mirroring app/utils/ydocConverter's defaults. */
function defaultSettings(): MapSettings {
  return {
    gridEnabled: true,
    gridSize: 24,
    snapToGrid: false,
    backgroundColor: '#09090B',
    defaultNodeStyle: {},
    defaultEdgeStyle: {}
  }
}

/** Coerce a stored `data` blob ({ nodes:[], edges:[], camera, ... }) into a MapDocument. */
function mapDocumentFromData(mapId: string, data: unknown): MapDocument {
  const d = (data ?? {}) as {
    nodes?: unknown
    edges?: unknown
    camera?: Camera
    settings?: MapSettings
    rootNodeId?: string | null
  }
  const nodesArr = (Array.isArray(d.nodes) ? d.nodes : Object.values(d.nodes ?? {})) as Node[]
  const edgesArr = (Array.isArray(d.edges) ? d.edges : Object.values(d.edges ?? {})) as Edge[]
  const nodes = new Map<string, Node>()
  for (const n of nodesArr) if (n && n.id) nodes.set(n.id, n)
  const edges = new Map<string, Edge>()
  for (const e of edgesArr) if (e && e.id) edges.set(e.id, e)
  return {
    id: mapId,
    title: '',
    nodes,
    edges,
    camera: d.camera ?? { x: 0, y: 0, zoom: 1 },
    rootNodeId: d.rootNodeId ?? undefined,
    createdAt: 0,
    updatedAt: Date.now(),
    settings: d.settings ?? defaultSettings()
  }
}

export async function restoreVersion(
  mapId: string,
  ownerUserId: string,
  versionId: string
) {
  const map = await assertOwnership(mapId, ownerUserId)
  const row = await prisma.mapVersion.findFirst({
    where: { id: versionId, mapId },
    select: { id: true, ydocBinary: true, version: true, data: true }
  })
  if (!row) throw new VersionError(404, 'Version not found')
  if (!row.ydocBinary && row.data == null) {
    throw new VersionError(404, 'Version has no restorable snapshot')
  }

  // Rebuild from the Y.Doc snapshot when present, else from the JSON blob.
  const { mapDoc, ydocBinary } = reconstructVersionDoc(mapId, row)
  const snapshot: RestoreSnapshot = {
    nodes: Array.from(mapDoc.nodes.values()),
    edges: Array.from(mapDoc.edges.values()),
    camera: mapDoc.camera,
    rootNodeId: mapDoc.rootNodeId ?? null,
    settings: mapDoc.settings
  }

  // Recompute checksum/byteSize so the plain-sync layer (/api/sync/pull, which
  // keys on syncVersion + checksum) treats this as a fresh change, and bump
  // both version counters so every client — collab or plain-sync — picks it up.
  const checksum = checksumOf(snapshot)
  const byteSize = byteSizeOf(snapshot)
  const updated = await prisma.map.update({
    where: { id: mapId },
    data: {
      ydoc: ydocBinary as unknown as Uint8Array<ArrayBuffer>,
      ydocVersion: (map.ydocVersion ?? 0) + 1,
      syncVersion: (map.syncVersion ?? 0) + 1,
      data: snapshot as object,
      checksum,
      byteSize,
      updatedAt: new Date()
    },
    select: { id: true, ydocVersion: true, syncVersion: true }
  })

  // Bust the per-user JSON cache so the next /api/sync/pull doesn't hand
  // out the pre-restore snapshot.
  await Promise.all([
    cache.del(cacheKeys.mapData(mapId, ownerUserId)),
    cache.del(cacheKeys.mapMeta(mapId, ownerUserId))
  ]).catch(() => { /* cache best-effort */ })

  return {
    id: updated.id,
    ydocVersion: updated.ydocVersion,
    syncVersion: updated.syncVersion,
    restoredFromVersion: row.version,
    snapshot
  }
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
