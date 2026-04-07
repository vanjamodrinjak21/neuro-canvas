import type { MapStore } from '~/stores/mapStore'
import { useGuestMode } from '~/composables/useGuestMode'

/**
 * Mind map export & share utilities.
 * Pure functions — no UI, no side effects beyond download / clipboard.
 */
export function useExport() {
  const guest = useGuestMode()

  // ── PNG export ──────────────────────────────────────────────────────
  function exportAsPng(canvasEl: HTMLCanvasElement, title: string) {
    if (!guest.requireFeature('export')) return
    canvasEl.toBlob((blob) => {
      if (blob) downloadBlob(blob, sanitizeFilename(title) + '.png')
    }, 'image/png')
  }

  // ── JSON export ─────────────────────────────────────────────────────
  function exportAsJson(mapStore: MapStore, title: string) {
    if (!guest.requireFeature('export')) return
    const data = mapStore.toSerializable()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    downloadBlob(blob, sanitizeFilename(title) + '.json')
  }

  // ── Markdown export ─────────────────────────────────────────────────
  function exportAsMarkdown(mapStore: MapStore, title: string) {
    if (!guest.requireFeature('export')) return
    const md = mapToMarkdown(mapStore)
    const blob = new Blob([md], { type: 'text/markdown' })
    downloadBlob(blob, sanitizeFilename(title) + '.md')
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

  /** Download a Blob as a file via a temporary <a> element. */
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
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
