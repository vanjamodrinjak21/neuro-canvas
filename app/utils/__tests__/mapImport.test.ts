import { describe, it, expect } from 'vitest'
import {
  parseLosslessMarkdown,
  parseMapJson,
  parseOpml,
  parseMarkdownOutline,
  MapImportError,
  MAX_IMPORT_NODES
} from '../mapImport'
import type { DBMapDocument, DBNode } from '~/composables/useDatabase'

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
    expect(restored.nodes[0]!.content).toBe('Root\nwith newline')
  })

  it('preserves special characters in content', () => {
    const md = exportMarkdown(sampleDoc)
    const restored = parseLosslessMarkdown(md)!
    expect(restored.nodes[1]!.content).toBe('Child <with> "quotes" & \\backslash')
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

// ── Shared helpers for the generic-outline importers ─────────────────

/** Index nodes by id for parent-chain assertions. */
function byId(doc: DBMapDocument): Map<string, DBNode> {
  return new Map(doc.nodes.map(n => [n.id, n]))
}

/** Resolve a node's parent chain of *content* labels, root-first. */
function ancestryOf(doc: DBMapDocument, content: string): string[] {
  const index = byId(doc)
  let node = doc.nodes.find(n => n.content === content)
  const chain: string[] = []
  while (node) {
    chain.unshift(node.content)
    node = node.parentId ? index.get(node.parentId) : undefined
  }
  return chain
}

/** Assert every node/edge/doc field matches how mapStore would build them. */
function assertWellFormed(doc: DBMapDocument): void {
  expect(typeof doc.id).toBe('string')
  expect(doc.id.length).toBeGreaterThan(0)
  expect(doc.camera).toEqual({ x: 0, y: 0, zoom: 1 })
  expect(doc.settings.gridSize).toBe(32)
  expect(Array.isArray(doc.tags)).toBe(true)
  // Exactly one root.
  const roots = doc.nodes.filter(n => n.isRoot)
  expect(roots).toHaveLength(1)
  expect(doc.rootNodeId).toBe(roots[0]!.id)
  const ids = new Set(doc.nodes.map(n => n.id))
  expect(ids.size).toBe(doc.nodes.length) // ids unique
  for (const n of doc.nodes) {
    expect(n.type).toBe('text')
    expect(n.style.shape).toBe('rounded')
    expect(n.style.fontSize).toBe(14)
    expect(n.size.width).toBeGreaterThan(0)
    expect(n.size.height).toBeGreaterThan(0)
    expect(typeof n.createdAt).toBe('number')
    if (n.parentId) expect(ids.has(n.parentId)).toBe(true)
  }
  // Every edge connects real nodes and mirrors a parentId relation.
  for (const e of doc.edges) {
    expect(ids.has(e.sourceId)).toBe(true)
    expect(ids.has(e.targetId)).toBe(true)
    const child = doc.nodes.find(n => n.id === e.targetId)!
    expect(child.parentId).toBe(e.sourceId)
  }
}

describe('parseOpml', () => {
  it('maps nested outlines to a node hierarchy', () => {
    const opml = `<?xml version="1.0"?>
<opml version="2.0">
  <head><title>My Outline</title></head>
  <body>
    <outline text="Root">
      <outline text="Child A">
        <outline text="Grandchild"/>
      </outline>
      <outline text="Child B"/>
    </outline>
  </body>
</opml>`
    const doc = parseOpml(opml)
    assertWellFormed(doc)
    expect(doc.nodes).toHaveLength(4)
    expect(doc.nodes[0]!.content).toBe('Root')
    expect(doc.nodes[0]!.isRoot).toBe(true)
    expect(ancestryOf(doc, 'Grandchild')).toEqual(['Root', 'Child A', 'Grandchild'])
    expect(ancestryOf(doc, 'Child B')).toEqual(['Root', 'Child B'])
    // 3 parent→child edges for 4 nodes in a single tree.
    expect(doc.edges).toHaveLength(3)
  })

  it('falls back to the title attribute when text is absent', () => {
    const opml = `<opml><head><title>T</title></head><body>
      <outline title="Only Title"/>
    </body></opml>`
    const doc = parseOpml(opml)
    expect(doc.nodes[0]!.content).toBe('Only Title')
  })

  it('synthesises a root from the head title for multi-root OPML', () => {
    const opml = `<opml><head><title>Podcast Feed</title></head><body>
      <outline text="Episode 1"/>
      <outline text="Episode 2"/>
      <outline text="Episode 3"/>
    </body></opml>`
    const doc = parseOpml(opml)
    assertWellFormed(doc)
    expect(doc.nodes).toHaveLength(4) // synthetic root + 3 episodes
    expect(doc.nodes[0]!.content).toBe('Podcast Feed')
    expect(doc.nodes[0]!.isRoot).toBe(true)
    expect(ancestryOf(doc, 'Episode 2')).toEqual(['Podcast Feed', 'Episode 2'])
  })

  it('uses the head title as the document title', () => {
    const opml = `<opml><head><title>Trip Plan</title></head><body>
      <outline text="Only one"/>
    </body></opml>`
    expect(parseOpml(opml).title).toBe('Trip Plan')
  })

  it('grafts children of a textless separator onto the current depth', () => {
    const opml = `<opml><head><title>T</title></head><body>
      <outline text="Root">
        <outline>
          <outline text="Deep child"/>
        </outline>
      </outline>
    </body></opml>`
    const doc = parseOpml(opml)
    // The empty <outline> is skipped but its child is not orphaned.
    expect(ancestryOf(doc, 'Deep child')).toEqual(['Root', 'Deep child'])
  })

  it('rejects malformed (non-well-formed) OPML', () => {
    expect(() => parseOpml('<opml><body><outline text="a"></body></opml>')).toThrow(MapImportError)
  })

  it('rejects a non-OPML root element', () => {
    expect(() => parseOpml('<html><body>hi</body></html>')).toThrow(MapImportError)
  })

  it('rejects OPML with a body but no outline text', () => {
    const opml = '<opml><head><title>T</title></head><body><outline/></body></opml>'
    expect(() => parseOpml(opml)).toThrow(MapImportError)
  })

  it('rejects empty input', () => {
    expect(() => parseOpml('   ')).toThrow(MapImportError)
  })
})

describe('parseMarkdownOutline', () => {
  it('builds a hierarchy from ATX headings', () => {
    const md = `# Title
## Section A
### Sub A1
## Section B`
    const doc = parseMarkdownOutline(md)
    assertWellFormed(doc)
    expect(doc.nodes.map(n => n.content)).toEqual(['Title', 'Section A', 'Sub A1', 'Section B'])
    expect(ancestryOf(doc, 'Sub A1')).toEqual(['Title', 'Section A', 'Sub A1'])
    expect(ancestryOf(doc, 'Section B')).toEqual(['Title', 'Section B'])
  })

  it('nests indented bullet lists by indentation depth', () => {
    const md = `# Root
- One
  - One A
    - One A i
- Two`
    const doc = parseMarkdownOutline(md)
    assertWellFormed(doc)
    expect(ancestryOf(doc, 'One A i')).toEqual(['Root', 'One', 'One A', 'One A i'])
    expect(ancestryOf(doc, 'Two')).toEqual(['Root', 'Two'])
  })

  it('attaches bullets beneath the nearest preceding heading', () => {
    const md = `# Doc
## Fruits
- Apple
- Banana
## Veg
- Carrot`
    const doc = parseMarkdownOutline(md)
    expect(ancestryOf(doc, 'Apple')).toEqual(['Doc', 'Fruits', 'Apple'])
    expect(ancestryOf(doc, 'Carrot')).toEqual(['Doc', 'Veg', 'Carrot'])
  })

  it('handles a mix of *, +, - and ordered markers', () => {
    const md = `# Mixed
* Star
+ Plus
1. First
2) Second`
    const doc = parseMarkdownOutline(md)
    expect(doc.nodes.map(n => n.content)).toEqual(['Mixed', 'Star', 'Plus', 'First', 'Second'])
    for (const label of ['Star', 'Plus', 'First', 'Second']) {
      expect(ancestryOf(doc, label)).toEqual(['Mixed', label])
    }
  })

  it('treats tab indentation as one level', () => {
    const md = `# Root
- Parent
\t- Tabbed child`
    const doc = parseMarkdownOutline(md)
    expect(ancestryOf(doc, 'Tabbed child')).toEqual(['Root', 'Parent', 'Tabbed child'])
  })

  it('synthesises a single root when bullets have no heading', () => {
    const md = `- Alpha
- Beta
- Gamma`
    const doc = parseMarkdownOutline(md)
    assertWellFormed(doc)
    // One synthetic root + three siblings under it.
    expect(doc.nodes).toHaveLength(4)
    expect(doc.nodes[0]!.isRoot).toBe(true)
    expect(ancestryOf(doc, 'Beta')).toEqual([doc.nodes[0]!.content, 'Beta'])
  })

  it('keeps a single top-level bullet as the root directly', () => {
    const md = `- Solo
  - Child`
    const doc = parseMarkdownOutline(md)
    expect(doc.nodes[0]!.content).toBe('Solo')
    expect(ancestryOf(doc, 'Child')).toEqual(['Solo', 'Child'])
  })

  it('ignores fenced code blocks and prose lines', () => {
    const md = `# Root
Some prose that is not a node.
\`\`\`
- this is code, not a bullet
# not a heading
\`\`\`
- Real bullet`
    const doc = parseMarkdownOutline(md)
    expect(doc.nodes.map(n => n.content)).toEqual(['Root', 'Real bullet'])
  })

  it('rejects an outline with no headings or bullets', () => {
    expect(() => parseMarkdownOutline('just some prose\nand more prose')).toThrow(MapImportError)
  })

  it('rejects empty input', () => {
    expect(() => parseMarkdownOutline('')).toThrow(MapImportError)
  })
})

describe('generic-outline node cap', () => {
  it('rejects an OPML larger than MAX_IMPORT_NODES', () => {
    const count = MAX_IMPORT_NODES + 5
    const items = Array.from({ length: count }, (_, i) => `<outline text="n${i}"/>`).join('')
    const opml = `<opml><head><title>Big</title></head><body>${items}</body></opml>`
    // Multi-root adds a synthetic node, pushing it well over the cap.
    expect(() => parseOpml(opml)).toThrow(MapImportError)
  })

  it('accepts an outline exactly at the cap', () => {
    // Single root chain of exactly MAX_IMPORT_NODES headings is impractical;
    // use a flat heading + bullets to reach the cap precisely.
    const bullets = Array.from({ length: MAX_IMPORT_NODES - 1 }, (_, i) => `- item ${i}`).join('\n')
    const md = `# Root\n${bullets}`
    const doc = parseMarkdownOutline(md)
    expect(doc.nodes).toHaveLength(MAX_IMPORT_NODES)
  })

  it('rejects an outline one over the cap', () => {
    const bullets = Array.from({ length: MAX_IMPORT_NODES }, (_, i) => `- item ${i}`).join('\n')
    const md = `# Root\n${bullets}` // root + MAX bullets = MAX + 1
    expect(() => parseMarkdownOutline(md)).toThrow(MapImportError)
  })
})
