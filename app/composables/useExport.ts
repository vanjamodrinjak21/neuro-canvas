import { toRaw } from 'vue'
import type { MapStore } from '~/stores/mapStore'
import type { DBNode } from '~/composables/useDatabase'
import { useGuestMode } from '~/composables/useGuestMode'
import { getCanvasColors } from '~/composables/useCanvasTheme'
import { readCurrentTextScale } from '~/composables/useTextScale'
import { computeContentBounds, computeExportFit } from '~/utils/exportFit'
import { lerpColor } from '~/utils/color'
import { drawNode } from '~/components/canvas/renderers/drawNode'
import { drawEdge } from '~/components/canvas/renderers/drawEdge'
import { drawRootIndicator } from '~/components/canvas/renderers/drawOverlays'

/** Raster formats supported by the image export path. */
type RasterFormat = 'png' | 'jpg'

interface RasterFormatSpec {
  mime: string
  extensions: string[]
  filterName: string
  /** Encoder quality (JPEG only). */
  quality?: number
}

const RASTER_FORMATS: Record<RasterFormat, RasterFormatSpec> = {
  png: { mime: 'image/png', extensions: ['png'], filterName: 'PNG Image' },
  jpg: { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], filterName: 'JPEG Image', quality: 0.92 },
}

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
  function _isCapacitor(): boolean {
    return typeof window !== 'undefined'
      && 'Capacitor' in window
      && !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  }

  /** Uint8Array → base64 (chunked, avoids call-stack limits on large maps). */
  function uint8ToBase64(bytes: Uint8Array): string {
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  }

  // ── Raster export (PNG / JPG) ───────────────────────────────────────
  // Offscreen render of the FULL map, independent of the current camera,
  // zoom, screen DPR and the 360px detail-panel overlay. The previous
  // implementation blobbed the live canvas element, so exports were plain
  // viewport screenshots: off-screen nodes were cut off and the output
  // resolution was whatever the window happened to be. This path computes
  // the content bounding box of every node + edge, fits it (plus padding)
  // into a supersampled canvas, and re-draws the map with the same pure
  // renderers the live canvas uses.

  /** Render the whole map to an image blob at export quality. */
  async function renderMapToBlob(mapStore: MapStore, format: RasterFormat): Promise<Blob> {
    // toRaw: iterating reactive Maps costs ~15x native and export touches
    // every node/edge. Same underlying objects, so nothing goes stale.
    const nodes = toRaw(mapStore.nodes)
    const edges = toRaw(mapStore.edges)
    const rootNodeId = mapStore.rootNodeId

    // Empty map → framed blank canvas rather than a failure.
    const bounds = computeContentBounds(nodes, edges.values())
      ?? { minX: 0, minY: 0, maxX: 800, maxY: 600 }
    const fit = computeExportFit(bounds, {
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    })

    const isLight = typeof document !== 'undefined'
      && document.documentElement.classList.contains('light')
    const colors = getCanvasColors(isLight)
    const textScale = readCurrentTextScale()

    // Node text renders in the app font — wait for it so glyphs rasterize
    // crisp instead of falling back to a default font mid-export.
    if (typeof document !== 'undefined' && 'fonts' in document) {
      try {
        await document.fonts.ready
      } catch { /* non-fatal: fall back to whatever is loaded */ }
    }

    const canvas = document.createElement('canvas')
    canvas.width = fit.width
    canvas.height = fit.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    // JPEG has no alpha channel — paint the active theme's canvas bg token
    // first so transparency never collapses to black (PNG gets the exact
    // same background the app shows).
    ctx.fillStyle = colors.canvasBg
    ctx.fillRect(0, 0, fit.width, fit.height)

    // Content-space → supersampled pixels. Everything below draws in the
    // same world coordinates the live renderers use.
    ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.translateX, fit.translateY)

    const noSelection = new Set<string>()

    for (const edge of edges.values()) {
      drawEdge(ctx, edge, nodes, noSelection, noSelection, colors)
    }

    for (const node of nodes.values()) {
      const isRoot = node.isRoot || node.id === rootNodeId
      const parentNode = node.parentId ? nodes.get(node.parentId) : null
      const parentIsRoot = !!(parentNode && (parentNode.isRoot || parentNode.id === rootNodeId))
      drawNode(
        ctx, node, 'normal', colors,
        false, false, isRoot,
        lerpColor,
        undefined,
        isLight,
        parentIsRoot,
        textScale,
      )
    }

    // Root badge on top, matching the live render order.
    for (const node of nodes.values()) {
      if (node.isRoot || node.id === rootNodeId) {
        drawRootIndicator(ctx, node, colors)
      }
    }

    const spec = RASTER_FORMATS[format]
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error(`Canvas toBlob (${spec.mime}) failed`))
        },
        spec.mime,
        spec.quality,
      )
    })
  }

  async function exportAsImage(mapStore: MapStore, title: string, format: RasterFormat) {
    if (!guest.requireFeature('export')) return
    try {
      const spec = RASTER_FORMATS[format]
      const blob = await renderMapToBlob(mapStore, format)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      await saveFile(bytes, `${sanitizeFilename(title)}.${spec.extensions[0]}`, [
        { name: spec.filterName, extensions: [...spec.extensions] }
      ])
    } catch (e) {
      console.error('[Export] Raster export failed:', e)
    }
  }

  function exportAsPng(mapStore: MapStore, title: string) {
    return exportAsImage(mapStore, title, 'png')
  }

  function exportAsJpg(mapStore: MapStore, title: string) {
    return exportAsImage(mapStore, title, 'jpg')
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

  // ── PDF export ──────────────────────────────────────────────────────
  // A clean, readable outline document of the map. Works on every platform
  // (no canvas dependency — mobile has no canvas to rasterize). jsPDF is
  // lazy-loaded so it only ships when the user actually exports.
  async function exportAsPdf(mapStore: MapStore, title: string) {
    if (!guest.requireFeature('export')) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 48
    let y = margin

    const heading = String(title || '').trim() || 'Mind map'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text(heading, margin, y)
    y += 30
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)

    for (const { depth, text } of buildOutline(mapStore)) {
      const indent = margin + depth * 16
      const wrapped = doc.splitTextToSize('• ' + text, pageW - indent - margin) as string[]
      for (const line of wrapped) {
        if (y > pageH - margin) { doc.addPage(); y = margin }
        doc.text(line, indent, y)
        y += 16
      }
    }

    const bytes = new Uint8Array(doc.output('arraybuffer'))
    await saveFile(bytes, sanitizeFilename(title) + '.pdf', [
      { name: 'PDF', extensions: ['pdf'] }
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

    // Capacitor (iOS/Android): write the file then open the native share sheet.
    // The web <a download> path below is a SILENT no-op inside WKWebView, which
    // is why editor exports "did nothing" on the phone. Write base64 (no
    // encoding) so binary (PNG) and text (JSON/MD) both round-trip correctly.
    if (_isCapacitor()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')
        const res = await Filesystem.writeFile({
          path: defaultFilename,
          data: uint8ToBase64(data),
          directory: Directory.Documents,
        })
        await Share.share({ title: defaultFilename, files: [res.uri] })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!/cancel|abort|dismiss/i.test(msg)) {
          console.error('[Export] Capacitor save/share failed:', e)
          try {
            const { Dialog } = await import('@capacitor/dialog')
            await Dialog.alert({ title: 'Export failed', message: msg.slice(0, 300) })
          } catch { /* dialog unavailable */ }
        }
      }
      return
    }

    // Web fallback: blob download via <a> element
    const blob = new Blob([data as unknown as BlobPart])
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

  /** Flatten the map into an indented {depth,text} outline (for the PDF). */
  function buildOutline(mapStore: MapStore): Array<{ depth: number; text: string }> {
    const doc = mapStore.toSerializable()
    const nodeById = new Map(doc.nodes.map((n) => [n.id, n]))
    const childrenOf = new Map<string, string[]>()
    for (const edge of doc.edges) {
      const list = childrenOf.get(edge.sourceId) || []
      list.push(edge.targetId)
      childrenOf.set(edge.sourceId, list)
    }
    const out: Array<{ depth: number; text: string }> = []
    const visited = new Set<string>()
    function walk(id: string, depth: number) {
      if (visited.has(id)) return
      visited.add(id)
      const node = nodeById.get(id)
      if (!node) return
      out.push({ depth, text: String(node.content || '').replace(/\s+/g, ' ').trim() || '(empty)' })
      for (const childId of (childrenOf.get(id) || [])) walk(childId, depth + 1)
    }
    if (doc.rootNodeId && nodeById.has(doc.rootNodeId)) walk(doc.rootNodeId, 0)
    for (const node of doc.nodes) if (!visited.has(node.id)) walk(node.id, 0)
    return out
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
    exportAsJpg,
    exportAsJson,
    exportAsMarkdown,
    exportAsPdf,
    shareAsText
  }
}
