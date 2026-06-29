import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { useMapStore } from '~/stores/mapStore'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { parseLosslessMarkdown, parseMapJson, MapImportError } from '~/utils/mapImport'

/** A heading/outline node parsed from Markdown or OPML. */
interface OutlineNode {
  content: string
  level: number
}

/**
 * File import + parsing for the dashboard.
 *
 * Extracted from `dashboard.vue` so the page component stays focused on
 * presentation. Handles three formats:
 *   - `.json` — full lossless restore
 *   - `.md`   — lossless export first, falling back to a heading outline
 *   - `.opml` — nested outline
 *
 * On success the reconstructed map is persisted to IndexedDB, queued for a
 * sync push, and the app navigates to the new map. Modal/UI state is left to
 * the caller — this composable only owns parsing + persistence.
 */
export function useMapImport() {
  const db = useDatabase()
  const mapStore = useMapStore()
  const syncEngine = useSyncEngine()

  function parseMarkdownOutline(text: string): OutlineNode[] {
    const lines = text.split('\n')
    const nodes: OutlineNode[] = []
    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        const hashes = headerMatch[1] ?? ''
        const content = headerMatch[2] ?? ''
        nodes.push({ content, level: hashes.length })
      }
    }
    return nodes
  }

  function parseOPML(text: string): OutlineNode[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/xml')
    const nodes: OutlineNode[] = []
    function traverse(element: Element, level: number) {
      const outlines = element.querySelectorAll(':scope > outline')
      outlines.forEach(outline => {
        const nodeText = outline.getAttribute('text') || outline.getAttribute('title') || ''
        if (nodeText) {
          nodes.push({ content: nodeText, level })
          traverse(outline, level + 1)
        }
      })
    }
    const body = doc.querySelector('body')
    if (body) traverse(body, 1)
    return nodes
  }

  async function createMapFromNodes(nodes: OutlineNode[], title: string) {
    mapStore.newDocument()
    mapStore.setTitle(title)
    const nodeStack: { id: string; level: number }[] = []
    let currentY = 100
    const xSpacing = 200
    const levelIndices: Record<number, number> = {}
    for (const node of nodes) {
      const level = node.level
      levelIndices[level] = (levelIndices[level] || 0)
      const xPos = 100 + (level - 1) * xSpacing
      const yPos = currentY
      const newNode = mapStore.addNode({
        content: node.content,
        position: { x: xPos, y: yPos }
      })
      while (nodeStack.length > 0) {
        const top = nodeStack[nodeStack.length - 1]
        if (!top || top.level < level) break
        nodeStack.pop()
      }
      const parent = nodeStack[nodeStack.length - 1]
      if (parent) {
        mapStore.addEdge(parent.id, newNode.id)
      }
      nodeStack.push({ id: newNode.id, level })
      levelIndices[level]++
      currentY += newNode.size.height + 30
    }
    mapStore.resolveOverlaps()
    const doc = mapStore.toSerializable()
    await db.saveMap(doc)
    if (syncEngine.isSyncEnabled.value) syncEngine.debouncedPush(doc.id)
    await navigateTo(`/map/${doc.id}`)
  }

  /**
   * Persist a fully reconstructed DBMapDocument (from JSON or lossless MD).
   * If a map with the same id already exists locally, overwrite it — the user
   * asked for an exact restore. The id is preserved so subsequent server
   * pushes update the same row.
   */
  async function importLosslessDoc(doc: DBMapDocument) {
    const now = Date.now()
    const finalDoc: DBMapDocument = {
      ...doc,
      updatedAt: now,
      userId: undefined  // re-tagged by db.saveMap with the current user
    }
    await db.saveMap(finalDoc)
    if (syncEngine.isSyncEnabled.value) syncEngine.debouncedPush(finalDoc.id)
    await navigateTo(`/map/${finalDoc.id}`)
  }

  async function processImportedFile(file: File) {
    const text = await file.text()
    const ext = file.name.split('.').pop()?.toLowerCase()

    // ── JSON: full lossless restore via mapStore.fromSerializable ─────
    if (ext === 'json') {
      try {
        const doc = parseMapJson(text)
        await importLosslessDoc(doc)
      } catch (err) {
        const msg = err instanceof MapImportError ? err.message : 'Failed to import JSON'
        alert(`Could not import JSON: ${msg}`)
      }
      return
    }

    // ── Markdown: try lossless first, fall back to legacy outline parser ─
    if (ext === 'md') {
      try {
        const lossless = parseLosslessMarkdown(text)
        if (lossless) {
          await importLosslessDoc(lossless)
          return
        }
      } catch (err) {
        const msg = err instanceof MapImportError ? err.message : 'Markdown is not a NeuroCanvas export'
        alert(`Could not parse markdown export: ${msg}`)
        return
      }
      const nodes = parseMarkdownOutline(text)
      if (nodes.length === 0) {
        alert('No content found in file.')
        return
      }
      const title = file.name.replace(/\.[^/.]+$/, '')
      await createMapFromNodes(nodes, title)
      return
    }

    if (ext === 'opml') {
      const nodes = parseOPML(text)
      if (nodes.length === 0) { alert('No content found in file.'); return }
      const title = file.name.replace(/\.[^/.]+$/, '')
      await createMapFromNodes(nodes, title)
      return
    }

    alert('Unsupported file type. Please use .json, .md, or .opml')
  }

  return { processImportedFile }
}
