import { describe, it, expect } from 'vitest'
import { parseLosslessMarkdown, parseMapJson, MapImportError } from '../mapImport'
import type { DBMapDocument } from '~/composables/useDatabase'

const sampleDoc: DBMapDocument = {
  id: 'map_test123',
  title: 'Round-Trip Test',
  nodes: [
    {
      id: 'n1', type: 'text',
      position: { x: 100, y: 200 }, size: { width: 150, height: 50 },
      content: 'Root\nwith newline',
      style: { shape: 'rounded', fillColor: '#111', borderColor: '#222', borderWidth: 1, textColor: '#fff', fontSize: 14, fontWeight: 500, shadowEnabled: true, glowEnabled: false },
      isRoot: true,
      metadata: { category: 'idea' },
      createdAt: 1000, updatedAt: 2000
    },
    {
      id: 'n2', type: 'text',
      position: { x: 300, y: 400 }, size: { width: 120, height: 40 },
      content: 'Child <with> "quotes" & \\backslash',
      style: { shape: 'rounded', fillColor: '#111', borderColor: '#222', borderWidth: 1, textColor: '#fff', fontSize: 14, fontWeight: 500, shadowEnabled: true, glowEnabled: false },
      parentId: 'n1', collapsed: false, locked: false,
      createdAt: 1500, updatedAt: 2500
    }
  ],
  edges: [
    {
      id: 'e1', sourceId: 'n1', targetId: 'n2',
      style: { type: 'bezier', strokeColor: '#aaa', strokeWidth: 2, arrowStart: 'none', arrowEnd: 'arrow', animated: true },
      label: 'leads to',
      createdAt: 1100, updatedAt: 1100
    }
  ],
  camera: { x: 50, y: 60, zoom: 1.25 },
  rootNodeId: 'n1',
  settings: {
    gridEnabled: true, gridSize: 32, snapToGrid: true,
    backgroundColor: '#0D0D0F',
    defaultNodeStyle: {}, defaultEdgeStyle: {}
  },
  createdAt: 500, updatedAt: 3000,
  tags: ['demo', 'test']
}

// Inline copy of mapToMarkdown so the parser test stays standalone — the
// real exporter is in app/composables/useExport.ts which depends on Vue.
function exportMarkdown(doc: DBMapDocument): string {
  const lines: string[] = []
  const meta = {
    'nc-version': 1, id: doc.id, title: doc.title,
    createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    camera: doc.camera, rootNodeId: doc.rootNodeId ?? null,
    settings: doc.settings, tags: doc.tags ?? []
  }
  lines.push(`<!--nc-document ${JSON.stringify(meta)}-->`)
  lines.push('')
  lines.push(`# ${doc.title}`)
  lines.push('')
  const childrenOf = new Map<string, string[]>()
  for (const e of doc.edges) {
    const list = childrenOf.get(e.sourceId) || []
    list.push(e.targetId)
    childrenOf.set(e.sourceId, list)
  }
  const visited = new Set<string>()
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  const escapeContent = (c: string) => c.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '')
  function payload(n: typeof doc.nodes[number]) {
    const p: Record<string, unknown> = {
      id: n.id, type: n.type, x: n.position.x, y: n.position.y,
      w: n.size.width, h: n.size.height, style: n.style,
      createdAt: n.createdAt, updatedAt: n.updatedAt
    }
    if (n.parentId !== undefined) p.parent = n.parentId
    if (n.collapsed !== undefined) p.collapsed = n.collapsed
    if (n.locked !== undefined) p.locked = n.locked
    if (n.isRoot !== undefined) p.isRoot = n.isRoot
    if (n.metadata !== undefined) p.metadata = n.metadata
    return JSON.stringify(p)
  }
  function walk(id: string, depth: number) {
    if (visited.has(id)) return
    visited.add(id)
    const n = byId.get(id)
    if (!n) return
    lines.push(`${'  '.repeat(depth)}- ${escapeContent(n.content)} <!--nc ${payload(n)}-->`)
    for (const c of childrenOf.get(id) || []) walk(c, depth + 1)
  }
  if (doc.rootNodeId && byId.has(doc.rootNodeId)) walk(doc.rootNodeId, 0)
  for (const n of doc.nodes) if (!visited.has(n.id)) walk(n.id, 0)
  lines.push('')
  lines.push(`<!--nc-edges ${JSON.stringify(doc.edges)}-->`)
  return lines.join('\n') + '\n'
}

describe('parseLosslessMarkdown', () => {
  it('round-trips a full DBMapDocument exactly', () => {
    const md = exportMarkdown(sampleDoc)
    const restored = parseLosslessMarkdown(md)!
    expect(restored).toBeTruthy()
    // Compare via JSON so Map/Set ordering and undefined fields are
    // normalised consistently.
    expect(JSON.parse(JSON.stringify(restored))).toEqual(JSON.parse(JSON.stringify(sampleDoc)))
  })

  it('preserves multi-line content via \\n encoding', () => {
    const md = exportMarkdown(sampleDoc)
    const restored = parseLosslessMarkdown(md)!
    expect(restored.nodes[0].content).toBe('Root\nwith newline')
  })

  it('preserves special characters in content', () => {
    const md = exportMarkdown(sampleDoc)
    const restored = parseLosslessMarkdown(md)!
    expect(restored.nodes[1].content).toBe('Child <with> "quotes" & \\backslash')
  })

  it('returns null when nc-document marker is missing', () => {
    const legacy = '# Title\n- bullet one\n  - bullet two\n'
    expect(parseLosslessMarkdown(legacy)).toBeNull()
  })

  it('throws MapImportError on malformed nc-document JSON', () => {
    const broken = '<!--nc-document {not valid json}-->\n# Title\n'
    expect(() => parseLosslessMarkdown(broken)).toThrow(MapImportError)
  })
})

describe('parseMapJson', () => {
  it('round-trips the JSON export shape', () => {
    const json = JSON.stringify(sampleDoc)
    const restored = parseMapJson(json)
    expect(restored).toEqual(sampleDoc)
  })

  it('rejects non-JSON', () => {
    expect(() => parseMapJson('not json')).toThrow(MapImportError)
  })

  it('rejects when required fields are missing', () => {
    expect(() => parseMapJson(JSON.stringify({ id: 'x' }))).toThrow(MapImportError)
  })

  it('forgives missing createdAt/updatedAt by backfilling now', () => {
    const minimal = {
      id: 'm', title: 't', nodes: [], edges: [],
      camera: { x: 0, y: 0, zoom: 1 },
      settings: { gridEnabled: false, gridSize: 24, snapToGrid: false, backgroundColor: '#000', defaultNodeStyle: {}, defaultEdgeStyle: {} }
    }
    const restored = parseMapJson(JSON.stringify(minimal))
    expect(typeof restored.createdAt).toBe('number')
    expect(typeof restored.updatedAt).toBe('number')
  })
})
