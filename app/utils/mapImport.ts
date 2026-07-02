/**
 * Import helpers for NeuroCanvas mind-map files.
 *
 * Lossless (NeuroCanvas-native) formats:
 *   - JSON: produced by `useExport().exportAsJson` — already lossless;
 *     parseMapJson validates shape.
 *   - Markdown (lossless): produced by `useExport().exportAsMarkdown` —
 *     contains <!--nc-document …-->, per-bullet <!--nc …-->, and
 *     <!--nc-edges …--> trailer. parseLosslessMarkdown reconstructs the
 *     full DBMapDocument byte-for-byte.
 *
 * Generic (foreign) formats — migration tooling for Workflowy /
 * OmniOutliner / Obsidian / OPML podcast exports:
 *   - OPML: parseOpml maps <outline> nesting → node hierarchy.
 *   - Markdown outline: parseMarkdownOutline maps ATX headings and
 *     indented bullet lists → node hierarchy.
 *
 * Both generic parsers synthesise a fresh DBMapDocument (new ids, tidy
 * tree layout, default styles) exactly as the store would, so downstream
 * rendering/sizing behaves identically to a hand-built map.
 *
 * If a markdown file does NOT contain the nc-document marker,
 * parseLosslessMarkdown returns null so the caller can fall back to the
 * generic parseMarkdownOutline.
 */
import { nanoid } from 'nanoid'
import type { DBMapDocument, DBNode, DBEdge } from '~/composables/useDatabase'
import type { Anchor, Camera, MapSettings, NodeStyle, EdgeStyle } from '~/types'
import { measureNodeSize } from '~/utils/nodeSizing'

const NC_DOCUMENT_RE = /<!--nc-document ([\s\S]+?)-->/
const NC_EDGES_RE = /<!--nc-edges ([\s\S]+?)-->/

export class MapImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MapImportError'
  }
}

// ── Shared defaults ──────────────────────────────────────────────────
// Kept in sync with mapStore's DEFAULT_* constants so a node/edge/doc
// synthesised here is indistinguishable from one built via the store.
// (mapStore is a Vue-pinned module and can't be imported into a plain
// util, so the small style seeds are mirrored rather than re-exported.)

const DEFAULT_NODE_STYLE: NodeStyle = {
  shape: 'rounded',
  fillColor: '#111113',
  borderColor: '#27272A',
  borderWidth: 1.5,
  textColor: '#FAFAFA',
  fontSize: 14,
  fontWeight: 500,
  shadowEnabled: true,
  glowEnabled: false
}

const DEFAULT_EDGE_STYLE: EdgeStyle = {
  type: 'bezier',
  strokeColor: '#2A2A30',
  strokeWidth: 2,
  arrowStart: 'none',
  arrowEnd: 'arrow',
  animated: false
}

function defaultSettings(): MapSettings {
  return {
    gridEnabled: true,
    gridSize: 32,
    snapToGrid: true,
    backgroundColor: '#0D0D0F',
    defaultNodeStyle: { ...DEFAULT_NODE_STYLE },
    defaultEdgeStyle: { ...DEFAULT_EDGE_STYLE }
  }
}

function defaultCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 }
}

/**
 * Hard cap on how many nodes a generic import may produce. Mirrors the
 * upper bound the AI generator and the store's load-time cap respect, so
 * an enormous OPML/outline can't lock up the reactive store or canvas.
 */
export const MAX_IMPORT_NODES = 10000

/**
 * A single parsed outline item before it becomes a DBNode: its text and
 * its depth in the hierarchy (0 = top level). Ordering is preserved.
 */
interface OutlineItem {
  content: string
  depth: number
}

/**
 * Turn an ordered, depth-tagged outline into a laid-out DBMapDocument.
 *
 * Layout mirrors the legacy `createMapFromNodes` tidy layout used by the
 * dashboard: x grows with depth (indent columns), y advances top-to-bottom
 * by each node's measured height. Parent/child edges are added via a depth
 * stack. Every node gets fresh ids, `now` timestamps, the default style,
 * and `type: 'text'` — matching mapStore.addNode exactly.
 *
 * Throws MapImportError when the outline is empty (nothing importable) or
 * exceeds MAX_IMPORT_NODES (matches how the JSON importer refuses to load
 * an oversize map rather than silently truncating).
 */
function buildDocFromOutline(items: OutlineItem[], title: string): DBMapDocument {
  const cleaned = items
    .map(it => ({ content: it.content.trim(), depth: Math.max(0, it.depth) }))
    .filter(it => it.content.length > 0)

  if (cleaned.length === 0) {
    throw new MapImportError('No importable content found')
  }
  if (cleaned.length > MAX_IMPORT_NODES) {
    throw new MapImportError(
      `Outline has ${cleaned.length} items, which exceeds the ${MAX_IMPORT_NODES}-node import limit`
    )
  }

  const now = Date.now()
  const nodes: DBNode[] = []
  const edges: DBEdge[] = []
  // Stack of { id, depth } for the current ancestor chain.
  const stack: { id: string; depth: number }[] = []
  const xSpacing = 200
  let currentY = 100
  let rootNodeId: string | null = null

  for (const item of cleaned) {
    const style: NodeStyle = { ...DEFAULT_NODE_STYLE }
    const size = measureNodeSize(item.content, style.fontSize, style.fontWeight, style.shape)
    const id = nanoid()
    const isRoot = nodes.length === 0
    const x = 100 + item.depth * xSpacing

    nodes.push({
      id,
      type: 'text',
      position: { x, y: currentY },
      size,
      content: item.content,
      style,
      collapsed: false,
      locked: false,
      isRoot,
      metadata: {},
      createdAt: now,
      updatedAt: now
    })
    if (isRoot) rootNodeId = id
    currentY += size.height + 30

    // Pop ancestors at or deeper than this item so the parent is the
    // nearest shallower node.
    while (stack.length > 0 && (stack[stack.length - 1]?.depth ?? -1) >= item.depth) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]
    if (parent) {
      const node = nodes[nodes.length - 1]!
      node.parentId = parent.id
      edges.push({
        id: nanoid(),
        sourceId: parent.id,
        targetId: id,
        style: { ...DEFAULT_EDGE_STYLE },
        createdAt: now,
        updatedAt: now
      })
    }
    stack.push({ id, depth: item.depth })
  }

  return {
    id: nanoid(),
    title: title.trim() || 'Imported Map',
    nodes,
    edges,
    camera: defaultCamera(),
    settings: defaultSettings(),
    rootNodeId: rootNodeId ?? undefined,
    createdAt: now,
    updatedAt: now,
    tags: []
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

// ── OPML ─────────────────────────────────────────────────────────────

/**
 * Parse an OPML outline (Workflowy, OmniOutliner, podcast tools, generic
 * feed readers) into a fresh DBMapDocument.
 *
 * `<outline>` nesting becomes the node hierarchy; each outline's `text`
 * (falling back to `title`) attribute becomes the node content. The map
 * title comes from `<head><title>`, falling back to a default.
 *
 * The top-level outline(s) become root node(s). When there is more than
 * one top-level outline, a synthetic root (named from the OPML `<title>`)
 * is inserted so the map has a single connected root — the store and
 * canvas assume one primary topic.
 *
 * Rejects malformed OPML (unparseable XML, missing `<body>`, or no usable
 * outline text) with MapImportError.
 */
export function parseOpml(text: string): DBMapDocument {
  if (typeof DOMParser === 'undefined') {
    throw new MapImportError('OPML import requires a DOM environment')
  }
  const trimmed = text.trim()
  if (!trimmed) throw new MapImportError('OPML file is empty')

  const doc = new DOMParser().parseFromString(trimmed, 'text/xml')

  // Browsers surface XML parse failures via a <parsererror> element rather
  // than throwing; treat its presence as malformed input.
  if (doc.querySelector('parsererror')) {
    throw new MapImportError('OPML is not well-formed XML')
  }
  const root = doc.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'opml') {
    throw new MapImportError('Not an OPML document (missing <opml> root)')
  }

  const body = doc.querySelector('body')
  if (!body) throw new MapImportError('OPML has no <body>')

  const headTitle = doc.querySelector('head > title')?.textContent?.trim() || ''

  const outlineText = (el: Element): string =>
    (el.getAttribute('text') ?? el.getAttribute('title') ?? '').trim()

  const items: OutlineItem[] = []

  // Depth-first walk that preserves document order. `:scope > outline`
  // keeps us to direct children so nesting maps to depth 1:1.
  const walk = (el: Element, depth: number): void => {
    const children = Array.from(el.children).filter(
      c => c.nodeName.toLowerCase() === 'outline'
    )
    for (const child of children) {
      const content = outlineText(child)
      // Skip contentless separators but still descend so their children
      // aren't orphaned — they graft onto the current depth.
      if (content) {
        items.push({ content, depth })
        walk(child, depth + 1)
      } else {
        walk(child, depth)
      }
    }
  }

  const topLevel = Array.from(body.children).filter(
    c => c.nodeName.toLowerCase() === 'outline'
  )
  const topWithText = topLevel.filter(el => outlineText(el))

  if (topWithText.length === 0) {
    throw new MapImportError('OPML contains no outline items with text')
  }

  const mapTitle = headTitle || 'Imported OPML'

  if (topWithText.length === 1) {
    // Single natural root — use it directly.
    walk(body, 0)
  } else {
    // Multiple roots — synthesise one from the head title so the map is
    // singly-rooted and everything hangs beneath it.
    items.push({ content: mapTitle, depth: 0 })
    walk(body, 1)
  }

  return buildDocFromOutline(items, mapTitle)
}

// ── Generic Markdown outline ─────────────────────────────────────────

// Content is trimmed downstream, so we capture greedily and let the
// trailing whitespace fall inside the group (avoids `.*\S` + `\s*$`
// backtracking overlap). Group 1 = markers/indent, group 2 = text.
const HEADING_RE = /^(#{1,6})[ \t]+(\S.*)$/
// Bullet list item: capture leading indent (marker non-capturing) and text.
const BULLET_RE = /^([ \t]*)[-*+][ \t]+(\S.*)$/
// Ordered list item: `1.` / `2)` etc.
const ORDERED_RE = /^([ \t]*)\d+[.)][ \t]+(\S.*)$/

/** Convert a leading-whitespace run to a bullet indent level (tab or 2 spaces = 1). */
function indentLevel(indent: string): number {
  let cols = 0
  for (const ch of indent) cols += ch === '\t' ? 2 : 1
  return Math.floor(cols / 2)
}

/**
 * Parse a generic Markdown outline (Obsidian notes, plain outlines,
 * exported bullet trees) into a fresh DBMapDocument.
 *
 * Hierarchy rules:
 *   - ATX headings (`#`..`######`) set the structural spine: `#` is depth
 *     0, `##` depth 1, and so on. A heading nests under the nearest
 *     shallower heading.
 *   - Bullet / ordered list items (`-`, `*`, `+`, `1.`) attach under the
 *     most recent heading, with their own indentation adding depth beneath
 *     it. With no preceding heading they hang off the first item as root.
 *   - Blank lines, code fences, and non-list prose are ignored.
 *
 * Rejects an empty/unparseable outline with MapImportError so the
 * dashboard fallback chain can surface a clean message.
 */
export function parseMarkdownOutline(text: string): DBMapDocument {
  const lines = text.split(/\r?\n/)
  const items: OutlineItem[] = []
  // Depth of the most recent heading (list items nest beneath it).
  let headingBaseDepth = -1
  let sawHeading = false
  let inFence = false

  for (const line of lines) {
    // Toggle fenced code blocks (``` or ~~~) — their contents are literal.
    const fence = line.trim()
    if (/^(?:```|~~~)/.test(fence)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const heading = line.match(HEADING_RE)
    if (heading) {
      const depth = heading[1]!.length - 1 // '#' → 0, '######' → 5
      items.push({ content: heading[2]!.trim(), depth })
      headingBaseDepth = depth
      sawHeading = true
      continue
    }

    const bullet = line.match(BULLET_RE) ?? line.match(ORDERED_RE)
    if (bullet) {
      const indent = indentLevel(bullet[1]!)
      // List items sit one level below the current heading (if any).
      const depth = headingBaseDepth + 1 + indent
      items.push({ content: bullet[2]!.trim(), depth })
      continue
    }
    // Everything else (blank lines, prose, tables) is skipped.
  }

  if (items.length === 0) {
    throw new MapImportError('No headings or list items found in Markdown outline')
  }

  // With no heading spine, several top-level bullets would each become a
  // disconnected root. Synthesise a single root so the map is connected —
  // mirrors the multi-root OPML handling.
  if (!sawHeading) {
    const topLevel = items.filter(it => it.depth === 0).length
    if (topLevel > 1) {
      for (const it of items) it.depth += 1
      items.unshift({ content: 'Imported Outline', depth: 0 })
    }
  }

  return buildDocFromOutline(items, 'Imported Outline')
}

// Re-export Anchor for parser consumers (avoids dead-code linter issues).
export type { Anchor }
