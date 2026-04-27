import type { MapStore } from '~/stores/mapStore'
import type { DBNode } from '~/composables/useDatabase'
import { useGuestMode } from '~/composables/useGuestMode'

/**
 * Mind map export & share utilities.
 * Platform-aware: uses native file save dialog on Tauri, browser download on web.
 */
export function useExport() {
  const guest = useGuestMode()

  // ── Platform detection ──────────────────────────────────────────────
  function _isTauri(): boolean {
    return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
  }

  // ── PNG export ──────────────────────────────────────────────────────
  function exportAsPng(canvasEl: HTMLCanvasElement, title: string) {
    if (!guest.requireFeature('export')) return
    canvasEl.toBlob(async (blob) => {
      if (blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        await saveFile(bytes, sanitizeFilename(title) + '.png', [
          { name: 'PNG Image', extensions: ['png'] }
        ])
      }
    }, 'image/png')
  }

  // ── JSON export ─────────────────────────────────────────────────────
  async function exportAsJson(mapStore: MapStore, title: string) {
    if (!guest.requireFeature('export')) return
    const data = mapStore.toSerializable()
    const json = JSON.stringify(data, null, 2)
    const bytes = new TextEncoder().encode(json)
    await saveFile(bytes, sanitizeFilename(title) + '.json', [
      { name: 'JSON File', extensions: ['json'] }
    ])
  }

  // ── Markdown export ─────────────────────────────────────────────────
  async function exportAsMarkdown(mapStore: MapStore, title: string) {
    if (!guest.requireFeature('export')) return
    const md = mapToMarkdown(mapStore)
    const bytes = new TextEncoder().encode(md)
    await saveFile(bytes, sanitizeFilename(title) + '.md', [
      { name: 'Markdown', extensions: ['md'] }
    ])
  }

  // ── Share (clipboard / native share sheet) ──────────────────────────
  async function shareAsText(
    mapStore: MapStore,
    platform: ReturnType<typeof usePlatform>
  ): Promise<boolean> {
    if (!guest.requireFeature('share')) return false
    const md = mapToMarkdown(mapStore)

    // Native share on mobile platforms
    if (platform.isMobile.value && await platform.share.canShare()) {
      await platform.share.share({
        title: String(mapStore.title),
        text: md
      })
      return true
    }

    // Fallback: clipboard
    await navigator.clipboard.writeText(md)
    return true
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Save file: Tauri uses native dialog + fs, web uses blob download. */
  async function saveFile(
    data: Uint8Array,
    defaultFilename: string,
    filters: Array<{ name: string; extensions: string[] }>
  ) {
    if (_isTauri()) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        const filePath = await save({ defaultPath: defaultFilename, filters })
        if (filePath) {
          await writeFile(filePath, data)
        }
        return
      } catch (e) {
        console.error('[Export] Tauri save failed, falling back to browser download:', e)
      }
    }

    // Web fallback: blob download via <a> element
    const blob = new Blob([data.buffer])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /** Strip characters unsafe for filenames. */
  function sanitizeFilename(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'mind-map'
  }

  /**
   * Convert the mind map into a lossless markdown document. Output is
   * structured so that:
   *   1. A human reads a clean indented outline.
   *   2. The full MapDocument can be reconstructed byte-for-byte by the
   *      paired parser via three machine-readable HTML-comment regions:
   *        - <!--nc-document {...map metadata}-->  at the top
   *        - inline trailing comments per bullet line carry per-node fields
   *        - <!--nc-edges [...]-->                 trailer carries every edge
   *
   * Tree edges drive the bullet hierarchy purely for readability; on import
   * the edges are reconstructed only from the trailer block (so labels,
   * styles and control points round-trip).
   */
  function mapToMarkdown(mapStore: MapStore): string {
    const doc = mapStore.toSerializable()
    const title = String(doc.title)
    const nodeArr = doc.nodes
    const edgeArr = doc.edges
    const rootNodeId = doc.rootNodeId
    const nodeById = new Map(nodeArr.map((n) => [n.id, n]))

    const meta = {
      'nc-version': 1,
      id: doc.id,
      title: doc.title,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      camera: doc.camera,
      rootNodeId: doc.rootNodeId ?? null,
      settings: doc.settings,
      tags: doc.tags ?? []
    }

    const lines: string[] = []
    lines.push(`<!--nc-document ${JSON.stringify(meta)}-->`)
    lines.push('')
    lines.push(`# ${title}`)
    lines.push('')

    // Adjacency from edges. Source → targets. The outline tree uses these
    // to indent children, but the trailer is the source of truth on import.
    const childrenOf = new Map<string, string[]>()
    for (const edge of edgeArr) {
      const list = childrenOf.get(edge.sourceId) || []
      list.push(edge.targetId)
      childrenOf.set(edge.sourceId, list)
    }

    const visited = new Set<string>()

    function nodeMetaJson(node: DBNode): string {
      // Compact per-node payload — every field needed to reconstruct the
      // Node in mapStore.fromSerializable.
      const payload: Record<string, unknown> = {
        id: node.id,
        type: node.type,
        x: node.position.x,
        y: node.position.y,
        w: node.size.width,
        h: node.size.height,
        style: node.style,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt
      }
      if (node.parentId !== undefined) payload.parent = node.parentId
      if (node.collapsed !== undefined) payload.collapsed = node.collapsed
      if (node.locked !== undefined) payload.locked = node.locked
      if (node.isRoot !== undefined) payload.isRoot = node.isRoot
      if (node.metadata !== undefined) payload.metadata = node.metadata
      return JSON.stringify(payload)
    }

    function escapeContent(content: string): string {
      // Bullets are single-line — encode any newlines so the file remains
      // line-addressable. The parser reverses this.
      return content.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '')
    }

    function walk(nodeId: string, depth: number) {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const node = nodeById.get(nodeId)
      if (!node) return

      const indent = '  '.repeat(depth)
      lines.push(`${indent}- ${escapeContent(node.content)} <!--nc ${nodeMetaJson(node)}-->`)

      const children = childrenOf.get(nodeId) || []
      for (const childId of children) walk(childId, depth + 1)
    }

    if (rootNodeId && nodeById.has(rootNodeId)) walk(rootNodeId, 0)
    for (const node of nodeArr) {
      if (!visited.has(node.id)) walk(node.id, 0)
    }

    lines.push('')
    lines.push(`<!--nc-edges ${JSON.stringify(edgeArr)}-->`)
    return lines.join('\n') + '\n'
  }

  return {
    exportAsPng,
    exportAsJson,
    exportAsMarkdown,
    shareAsText
  }
}
