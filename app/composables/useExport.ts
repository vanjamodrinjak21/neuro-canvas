import type { MapStore } from '~/stores/mapStore'
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

  /** Convert the mind map tree into an indented markdown outline. */
  function mapToMarkdown(mapStore: MapStore): string {
    const title = String(mapStore.title)
    const nodes = mapStore.nodes
    const edges = mapStore.edges
    const rootNodeId = mapStore.rootNodeId

    const lines: string[] = [`# ${title}`, '']

    // Build adjacency list (parent → children) from edges
    const childrenOf = new Map<string, string[]>()
    for (const edge of edges.values()) {
      const list = childrenOf.get(edge.sourceId) || []
      list.push(edge.targetId)
      childrenOf.set(edge.sourceId, list)
    }

    // Track which nodes have been visited
    const visited = new Set<string>()

    /** Recursively walk the tree from a node, building indented lines. */
    function walk(nodeId: string, depth: number) {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const node = nodes.get(nodeId)
      if (!node) return

      const indent = '  '.repeat(depth)
      lines.push(`${indent}- ${node.content}`)

      const children = childrenOf.get(nodeId) || []
      for (const childId of children) {
        walk(childId, depth + 1)
      }
    }

    // Start from root if available
    if (rootNodeId && nodes.has(rootNodeId)) {
      walk(rootNodeId, 0)
    }

    // Collect any orphan nodes not reached from root
    for (const node of nodes.values()) {
      if (!visited.has(node.id)) {
        walk(node.id, 0)
      }
    }

    return lines.join('\n') + '\n'
  }

  return {
    exportAsPng,
    exportAsJson,
    exportAsMarkdown,
    shareAsText
  }
}
