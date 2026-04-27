/**
 * Lossless import helpers for NeuroCanvas mind-map files.
 *
 * Two formats are supported:
 *   - JSON: produced by `useExport().exportAsJson` — already lossless;
 *     parseMapJson validates shape.
 *   - Markdown (lossless): produced by `useExport().exportAsMarkdown` —
 *     contains <!--nc-document …-->, per-bullet <!--nc …-->, and
 *     <!--nc-edges …--> trailer. parseLosslessMarkdown reconstructs the
 *     full DBMapDocument byte-for-byte.
 *
 * If a markdown file does NOT contain the nc-document marker, callers
 * should fall back to the legacy outline parser in dashboard.vue.
 */
import type { DBMapDocument, DBNode, DBEdge } from '~/composables/useDatabase'
import type { Anchor, Camera, MapSettings } from '~/types'

const NC_DOCUMENT_RE = /<!--nc-document ([\s\S]+?)-->/
const NC_EDGES_RE = /<!--nc-edges ([\s\S]+?)-->/

export class MapImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MapImportError'
  }
}

/** Parse a JSON export produced by `mapStore.toSerializable()`. */
export function parseMapJson(text: string): DBMapDocument {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new MapImportError('File is not valid JSON')
  }
  if (!raw || typeof raw !== 'object') throw new MapImportError('Top-level value must be an object')
  const doc = raw as Partial<DBMapDocument>
  if (typeof doc.id !== 'string') throw new MapImportError('Missing "id"')
  if (typeof doc.title !== 'string') throw new MapImportError('Missing "title"')
  if (!Array.isArray(doc.nodes)) throw new MapImportError('"nodes" must be an array')
  if (!Array.isArray(doc.edges)) throw new MapImportError('"edges" must be an array')
  if (!doc.camera || typeof doc.camera !== 'object') throw new MapImportError('Missing "camera"')
  if (!doc.settings || typeof doc.settings !== 'object') throw new MapImportError('Missing "settings"')
  // createdAt/updatedAt absence is forgiven — backfill with now to keep
  // older exports importable.
  const now = Date.now()
  return {
    id: doc.id,
    title: doc.title,
    nodes: doc.nodes as DBNode[],
    edges: doc.edges as DBEdge[],
    camera: doc.camera as Camera,
    settings: doc.settings as MapSettings,
    rootNodeId: doc.rootNodeId,
    createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : now,
    updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : now,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    preview: typeof doc.preview === 'string' ? doc.preview : undefined
  }
}

interface NodePayload {
  id: string
  type: DBNode['type']
  x: number
  y: number
  w: number
  h: number
  style: DBNode['style']
  parent?: string
  collapsed?: boolean
  locked?: boolean
  isRoot?: boolean
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

interface DocumentMeta {
  'nc-version': number
  id: string
  title: string
  createdAt: number
  updatedAt: number
  camera: Camera
  rootNodeId: string | null
  settings: MapSettings
  tags: string[]
}

function unescapeContent(s: string): string {
  // Inverse of the export-time encoding in useExport.mapToMarkdown.
  // The order matters — reverse the escape sequence first so a real `\n`
  // produced by an unescaped backslash isn't double-handled.
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\' && i + 1 < s.length) {
      const next = s[i + 1]
      if (next === 'n') { out += '\n'; i++; continue }
      if (next === '\\') { out += '\\'; i++; continue }
    }
    out += ch
  }
  return out.trimEnd()
}

/**
 * Lossless markdown parse. Returns null when the file is not a NeuroCanvas
 * lossless markdown export (no nc-document marker found) so the caller can
 * fall back to the legacy outline parser.
 */
export function parseLosslessMarkdown(text: string): DBMapDocument | null {
  const docMatch = text.match(NC_DOCUMENT_RE)
  if (!docMatch) return null
  let meta: DocumentMeta
  try {
    meta = JSON.parse(docMatch[1]!) as DocumentMeta
  } catch {
    throw new MapImportError('nc-document metadata block is not valid JSON')
  }
  if (typeof meta.id !== 'string') throw new MapImportError('nc-document metadata missing "id"')
  if (typeof meta.title !== 'string') throw new MapImportError('nc-document metadata missing "title"')

  // Per-bullet nodes — order of appearance is preserved so the file can be
  // visually re-edited and re-imported predictably.
  const nodes: DBNode[] = []
  const nodeIds = new Set<string>()

  // We need to walk lines to associate each <!--nc--> with its bullet
  // text. The HTML comment must immediately follow the bullet content on
  // the same line (with one space).
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    // Match `  - <content> <!--nc {...}-->`
    const bulletMatch = line.match(/^[ \t]*- (.*?) <!--nc (.+?)-->\s*$/)
    if (!bulletMatch) continue
    const content = unescapeContent(bulletMatch[1]!)
    let payload: NodePayload
    try {
      payload = JSON.parse(bulletMatch[2]!) as NodePayload
    } catch {
      throw new MapImportError(`Per-node metadata is not valid JSON: ${bulletMatch[2]}`)
    }
    if (typeof payload.id !== 'string') throw new MapImportError('Per-node metadata missing "id"')
    if (nodeIds.has(payload.id)) continue
    nodeIds.add(payload.id)
    const node: DBNode = {
      id: payload.id,
      type: payload.type,
      position: { x: payload.x, y: payload.y },
      size: { width: payload.w, height: payload.h },
      content,
      style: payload.style,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt
    }
    if (payload.parent !== undefined) node.parentId = payload.parent
    if (payload.collapsed !== undefined) node.collapsed = payload.collapsed
    if (payload.locked !== undefined) node.locked = payload.locked
    if (payload.isRoot !== undefined) node.isRoot = payload.isRoot
    if (payload.metadata !== undefined) node.metadata = payload.metadata
    nodes.push(node)
  }

  let edges: DBEdge[] = []
  const edgesMatch = text.match(NC_EDGES_RE)
  if (edgesMatch) {
    try {
      const arr = JSON.parse(edgesMatch[1]!)
      if (!Array.isArray(arr)) throw new Error('not an array')
      edges = arr as DBEdge[]
    } catch {
      throw new MapImportError('nc-edges block is not a valid JSON array')
    }
  }

  return {
    id: meta.id,
    title: meta.title,
    nodes,
    edges,
    camera: meta.camera,
    settings: meta.settings,
    rootNodeId: meta.rootNodeId ?? undefined,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    tags: Array.isArray(meta.tags) ? meta.tags : []
  }
}

// Re-export Anchor for parser consumers (avoids dead-code linter issues).
export type { Anchor }
