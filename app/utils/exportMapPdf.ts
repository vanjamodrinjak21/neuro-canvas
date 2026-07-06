// Print-ready VECTOR PDF export of the map (AER-76).
//
// Strategy: drive the exact same pure canvas renderers the live map uses
// (drawEdge / drawNode / drawRootIndicator, supplied as a `drawScene`
// closure by useExport) through a CanvasRenderingContext2D→SVG shim
// (canvas2svg), then convert that SVG into true vector geometry + real
// selectable text with jsPDF + svg2pdf.js. No drawing code is duplicated,
// so the PDF has 1:1 parity with the on-screen map.
//
// canvas2svg@1.0.16 predates several ctx APIs the renderers rely on, so this
// module polyfills them on the shim instance:
//   - `roundRect`                    → traced with moveTo/lineTo/arc
//   - `setLineDash`/`lineDashOffset` → stroke-dasharray/-dashoffset attrs
//   - Path2D args to fill/stroke/clip → a RecordingPath2D subclass is swapped
//     in for the global Path2D while the scene draws, and recorded commands
//     are replayed into the shim (canvas2svg ignores Path2D arguments)
//   - textBaseline ≠ 'alphabetic'    → svg2pdf ignores dominant-baseline, so
//     fillText is re-based onto the alphabetic baseline using real
//     TextMetrics (pixel-exact, no reliance on either library's baseline
//     handling)
//   - font weights are snapped to the four embedded Inter faces so svg2pdf
//     never falls back to a core PDF font
//
// Inter (SIL OFL 1.1 — embedding allowed) is fetched lazily from bundled
// assets and registered with jsPDF so text stays REAL text: selectable,
// searchable and razor sharp at any print size.
//
// This module must only ever be loaded via dynamic import() (see
// useExport.exportAsMapPdf) so jspdf, canvas2svg, svg2pdf.js and the font
// binaries stay out of the main chunk.

import C2S from 'canvas2svg'
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import type { ContentBounds, PdfPageLayout } from '~/utils/exportFit'
import { computePdfPageLayout, EXPORT_PADDING } from '~/utils/exportFit'
import interRegularAsset from '~/assets/fonts/Inter-Regular.ttf'
import interMediumAsset from '~/assets/fonts/Inter-Medium.ttf'
import interSemiBoldAsset from '~/assets/fonts/Inter-SemiBold.ttf'
import interBoldAsset from '~/assets/fonts/Inter-Bold.ttf'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MapVectorPdfArgs {
  /** Content bounding box of the map (nodes + edge geometry). */
  bounds: ContentBounds
  /** Document title (PDF metadata). */
  title: string
  /** Canvas background color — painted across the full page. */
  background: string
  /**
   * Draws the whole scene (edges → nodes → root badge) in content-space
   * coordinates. The same closure the raster export path uses, so vector and
   * raster output are guaranteed to match.
   */
  drawScene: (ctx: CanvasRenderingContext2D) => void
}

/**
 * Render the map as a fully vector, print-ready A4 PDF (auto orientation,
 * ~10 mm margins, map scaled to fit the page, light palette).
 *
 * Throws when any part of the vector pipeline fails — callers fall back to
 * {@link renderMapRasterPdf} so the user always gets a valid PDF.
 */
export async function renderMapVectorPdf(args: MapVectorPdfArgs): Promise<Uint8Array> {
  const layout = computePdfPageLayout(args.bounds)

  // Glyphs are measured through a real 2D context — make sure Inter is
  // resolvable in the DOM first (same guard the raster export uses).
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready
    } catch { /* non-fatal — measure with whatever is loaded */ }
  }

  const svg = renderSceneToSvg(args, layout)

  const doc = createPdfDoc(layout, args.title, args.background)
  await registerInterFonts(doc)

  await svg2pdf(svg, doc, {
    x: layout.offsetXPt,
    y: layout.offsetYPt,
    width: layout.placedWidthPt,
    height: layout.placedHeightPt,
  })

  return new Uint8Array(doc.output('arraybuffer'))
}

/**
 * Fallback: place a pre-rendered PNG of the map (light palette) on the same
 * A4 page layout the vector path would have used. Raster, but never broken.
 */
export async function renderMapRasterPdf(
  png: Blob,
  bounds: ContentBounds,
  title: string,
  background: string,
): Promise<Uint8Array> {
  const layout = computePdfPageLayout(bounds)
  const doc = createPdfDoc(layout, title, background)
  const bytes = new Uint8Array(await png.arrayBuffer())
  doc.addImage(
    bytes,
    'PNG',
    layout.offsetXPt,
    layout.offsetYPt,
    layout.placedWidthPt,
    layout.placedHeightPt,
  )
  return new Uint8Array(doc.output('arraybuffer'))
}

// ---------------------------------------------------------------------------
// PDF document setup
// ---------------------------------------------------------------------------

function createPdfDoc(layout: PdfPageLayout, title: string, background: string): jsPDF {
  const doc = new jsPDF({
    orientation: layout.orientation,
    unit: 'pt',
    format: 'a4',
    compress: true,
  })
  doc.setDocumentProperties({
    title: title.trim() || 'Mind map',
    creator: 'NeuroCanvas',
  })
  // Full-bleed canvas background so the placed map blends seamlessly into
  // the page (light palette paper #FAFAF9 — effectively white in print).
  doc.setFillColor(background)
  doc.rect(0, 0, layout.pageWidthPt, layout.pageHeightPt, 'F')
  return doc
}

// ── Inter font embedding (SIL OFL 1.1) ─────────────────────────────────────
// The four faces match the weights the node properties panel offers
// (400/500/600/700). Assets resolve to hashed URLs in this lazy chunk and are
// only fetched when an export actually runs.

const INTER_FACES = [
  { asset: interRegularAsset, vfs: 'Inter-Regular.ttf', weight: 400 },
  { asset: interMediumAsset, vfs: 'Inter-Medium.ttf', weight: 500 },
  { asset: interSemiBoldAsset, vfs: 'Inter-SemiBold.ttf', weight: 600 },
  { asset: interBoldAsset, vfs: 'Inter-Bold.ttf', weight: 700 },
] as const

/** Weights actually embedded in the PDF — see {@link snapFontWeights}. */
const REGISTERED_WEIGHTS: readonly number[] = INTER_FACES.map((f) => f.weight)

async function registerInterFonts(doc: jsPDF): Promise<void> {
  const buffers = await Promise.all(
    INTER_FACES.map(async (face) => {
      const res = await fetch(face.asset)
      if (!res.ok) {
        throw new Error(`[Export] Failed to load font asset ${face.vfs} (HTTP ${res.status})`)
      }
      return res.arrayBuffer()
    }),
  )
  INTER_FACES.forEach((face, i) => {
    const buffer = buffers[i]
    if (!buffer) throw new Error(`[Export] Missing font buffer for ${face.vfs}`)
    doc.addFileToVFS(face.vfs, bytesToBase64(new Uint8Array(buffer)))
    // jsPDF stores this as fontStyle '500normal'/'600normal'/'bold'/… — the
    // exact keys svg2pdf's combineFontStyleAndFontWeight() looks up.
    doc.addFont(face.vfs, 'Inter', 'normal', face.weight)
  })
}

/** Uint8Array → base64 (chunked, avoids call-stack limits on ~330 KB fonts). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ---------------------------------------------------------------------------
// Scene → SVG via the canvas2svg shim
// ---------------------------------------------------------------------------

function renderSceneToSvg(args: MapVectorPdfArgs, layout: PdfPageLayout): SVGSVGElement {
  if (typeof document === 'undefined') {
    throw new TypeError('[Export] Vector PDF export requires a DOM')
  }
  const NativePath2D = globalThis.Path2D
  if (typeof NativePath2D !== 'function') {
    throw new TypeError('[Export] Path2D is unavailable — cannot record renderer paths')
  }

  const width = layout.contentWidthPx
  const height = layout.contentHeightPx
  const shim = new C2S({ width, height })
  const RecordingPath2D = makeRecordingPath2D(NativePath2D)
  installShimPolyfills(shim, RecordingPath2D)

  // The renderers construct `new Path2D()` internally (getShapePath), so the
  // global is swapped for a recording subclass strictly for the synchronous
  // draw pass, then restored — drawScene never awaits, so nothing else can
  // observe the swap.
  globalThis.Path2D = RecordingPath2D
  try {
    shim.fillStyle = args.background
    shim.fillRect(0, 0, width, height)
    // Content-space → SVG user units. canvas2svg's setTransform is a no-op,
    // so the offset is applied with translate(); scaling to page points
    // happens later in svg2pdf via the viewBox (vector: lossless).
    shim.translate(EXPORT_PADDING - args.bounds.minX, EXPORT_PADDING - args.bounds.minY)
    args.drawScene(shim as unknown as CanvasRenderingContext2D)
  } finally {
    globalThis.Path2D = NativePath2D
  }

  const svg = shim.getSvg()
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  return svg
}

// ---------------------------------------------------------------------------
// Path2D recording — canvas2svg ignores Path2D arguments entirely, so while
// the scene draws, `new Path2D()` produces instances that remember their
// commands; fill/stroke/clip replay them into the shim's current path.
// ---------------------------------------------------------------------------

type RoundRectRadii = number | DOMPointInit | Array<number | DOMPointInit>

type RecordedPathOp =
  | { readonly m: 'moveTo' | 'lineTo'; readonly a: readonly [number, number] }
  | { readonly m: 'closePath' }
  | { readonly m: 'rect'; readonly a: readonly [number, number, number, number] }
  | { readonly m: 'quadraticCurveTo'; readonly a: readonly [number, number, number, number] }
  | { readonly m: 'arcTo'; readonly a: readonly [number, number, number, number, number] }
  | { readonly m: 'bezierCurveTo'; readonly a: readonly [number, number, number, number, number, number] }
  | { readonly m: 'arc'; readonly a: readonly [number, number, number, number, number, boolean] }
  | { readonly m: 'roundRect'; readonly a: readonly [number, number, number, number]; readonly r?: RoundRectRadii }
  | { readonly m: 'unsupported'; readonly name: string }

interface RecordingPath2DInstance extends Path2D {
  readonly __ops: readonly RecordedPathOp[]
}

interface RecordingPath2DCtor {
  new (path?: Path2D | string): RecordingPath2DInstance
}

function makeRecordingPath2D(Native: typeof Path2D): RecordingPath2DCtor {
  class RecordingPath2D extends Native implements RecordingPath2DInstance {
    readonly __ops: RecordedPathOp[] = []

    override moveTo(x: number, y: number): void {
      this.__ops.push({ m: 'moveTo', a: [x, y] })
      super.moveTo(x, y)
    }

    override lineTo(x: number, y: number): void {
      this.__ops.push({ m: 'lineTo', a: [x, y] })
      super.lineTo(x, y)
    }

    override closePath(): void {
      this.__ops.push({ m: 'closePath' })
      super.closePath()
    }

    override rect(x: number, y: number, w: number, h: number): void {
      this.__ops.push({ m: 'rect', a: [x, y, w, h] })
      super.rect(x, y, w, h)
    }

    override quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
      this.__ops.push({ m: 'quadraticCurveTo', a: [cpx, cpy, x, y] })
      super.quadraticCurveTo(cpx, cpy, x, y)
    }

    override arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
      this.__ops.push({ m: 'arcTo', a: [x1, y1, x2, y2, radius] })
      super.arcTo(x1, y1, x2, y2, radius)
    }

    override bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
      this.__ops.push({ m: 'bezierCurveTo', a: [cp1x, cp1y, cp2x, cp2y, x, y] })
      super.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
    }

    override arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
      this.__ops.push({ m: 'arc', a: [x, y, radius, startAngle, endAngle, counterclockwise === true] })
      super.arc(x, y, radius, startAngle, endAngle, counterclockwise)
    }

    override roundRect(x: number, y: number, w: number, h: number, radii?: RoundRectRadii): void {
      this.__ops.push({ m: 'roundRect', a: [x, y, w, h], r: radii })
      super.roundRect(x, y, w, h, radii)
    }

    override ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
      // canvas2svg has no ellipse — recorded as unsupported so the replay
      // throws a descriptive error and the caller falls back to raster.
      this.__ops.push({ m: 'unsupported', name: 'ellipse' })
      super.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise)
    }

    override addPath(path: Path2D, transform?: DOMMatrix2DInit): void {
      this.__ops.push({ m: 'unsupported', name: 'addPath' })
      super.addPath(path, transform)
    }
  }
  return RecordingPath2D
}

function replayRecordedPath(shim: C2S, ops: readonly RecordedPathOp[]): void {
  shim.beginPath()
  for (const op of ops) {
    switch (op.m) {
      case 'moveTo': shim.moveTo(...op.a); break
      case 'lineTo': shim.lineTo(...op.a); break
      case 'closePath': shim.closePath(); break
      case 'rect': shim.rect(...op.a); break
      case 'quadraticCurveTo': shim.quadraticCurveTo(...op.a); break
      case 'arcTo': shim.arcTo(...op.a); break
      case 'bezierCurveTo': shim.bezierCurveTo(...op.a); break
      case 'arc': shim.arc(...op.a); break
      case 'roundRect': traceRoundRect(shim, op.a[0], op.a[1], op.a[2], op.a[3], op.r); break
      case 'unsupported':
        throw new Error(`[Export] Path2D.${op.name}() is not supported by the SVG shim`)
    }
  }
}

// ---------------------------------------------------------------------------
// Shim polyfills
// ---------------------------------------------------------------------------

function installShimPolyfills(shim: C2S, RecordingPath2D: RecordingPath2DCtor): void {
  const measureCtx = shim.__ctx

  // ── roundRect (missing upstream) ─────────────────────────────────────
  shim.roundRect = (x, y, w, h, radii) => {
    traceRoundRect(shim, x, y, w, h, radii)
  }

  // ── setLineDash / lineDashOffset (missing upstream) ──────────────────
  let lineDash: number[] = []
  shim.lineDashOffset = 0
  shim.setLineDash = (segments) => {
    lineDash = segments.slice()
  }
  shim.getLineDash = () => lineDash.slice()

  // ── Path2D-aware fill / stroke / clip ────────────────────────────────
  const origFill = shim.fill
  const origStroke = shim.stroke
  const origClip = shim.clip

  const replayIfPath = (path: Path2D | CanvasFillRule | undefined): void => {
    if (path === undefined || typeof path === 'string') return
    if (!(path instanceof RecordingPath2D)) {
      throw new TypeError('[Export] Received a Path2D created outside the recording window')
    }
    replayRecordedPath(shim, path.__ops)
  }

  shim.fill = (pathOrRule?: Path2D | CanvasFillRule, fillRule?: CanvasFillRule): void => {
    replayIfPath(pathOrRule)
    origFill.call(shim)
    const rule = typeof pathOrRule === 'string' ? pathOrRule : fillRule
    if (rule) shim.__currentElement.setAttribute('fill-rule', rule)
  }

  shim.stroke = (path?: Path2D): void => {
    replayIfPath(path)
    origStroke.call(shim)
    if (lineDash.length > 0) {
      shim.__currentElement.setAttribute('stroke-dasharray', lineDash.join(','))
      if (shim.lineDashOffset !== 0) {
        shim.__currentElement.setAttribute('stroke-dashoffset', String(shim.lineDashOffset))
      }
    }
  }

  shim.clip = (pathOrRule?: Path2D | CanvasFillRule, fillRule?: CanvasFillRule): void => {
    replayIfPath(pathOrRule)
    origClip.call(shim)
    void fillRule
  }

  // ── Baseline normalization for text ──────────────────────────────────
  // canvas2svg encodes textBaseline as dominant-baseline, which svg2pdf
  // ignores completely — every <text> lands on the alphabetic baseline. So
  // non-alphabetic baselines are converted to an exact alphabetic-baseline
  // y using real TextMetrics for the very string being drawn.
  const origFillText = shim.fillText
  const origStrokeText = shim.strokeText

  const rebasedText = (
    draw: (text: string, x: number, y: number) => void,
  ) => (text: string, x: number, y: number): void => {
    const baseline = shim.textBaseline
    if (baseline === 'alphabetic') {
      draw(text, x, y)
      return
    }
    const dy = alphabeticBaselineDelta(measureCtx, shim.font, baseline, text)
    shim.textBaseline = 'alphabetic'
    try {
      draw(text, x, y + dy)
    } finally {
      shim.textBaseline = baseline
    }
  }

  shim.fillText = rebasedText((text, x, y) => origFillText.call(shim, text, x, y))
  shim.strokeText = rebasedText((text, x, y) => origStrokeText.call(shim, text, x, y))

  // ── Font-weight snapping ─────────────────────────────────────────────
  // Only four Inter faces are embedded. An unmatched weight would make
  // svg2pdf fall back to a core PDF font (Times!), so weights are snapped
  // to the nearest embedded face. measureText flows through the same
  // property, keeping wrapping consistent with the rendered glyphs.
  let fontString = shim.font
  Object.defineProperty(shim, 'font', {
    configurable: true,
    enumerable: true,
    get: () => fontString,
    set: (value: string) => {
      fontString = snapFontWeights(String(value))
    },
  })
}

/**
 * Exact vertical delta from `baseline` to the alphabetic baseline for the
 * given font + string, measured on a real 2D context. Falls back to
 * font-size heuristics only when TextMetrics lacks actualBoundingBoxAscent
 * (decade-old engines).
 */
function alphabeticBaselineDelta(
  measureCtx: CanvasRenderingContext2D,
  font: string,
  baseline: CanvasTextBaseline,
  text: string,
): number {
  const prevFont = measureCtx.font
  const prevBaseline = measureCtx.textBaseline
  try {
    measureCtx.font = font
    measureCtx.textBaseline = baseline
    const from = measureCtx.measureText(text).actualBoundingBoxAscent
    measureCtx.textBaseline = 'alphabetic'
    const to = measureCtx.measureText(text).actualBoundingBoxAscent
    if (Number.isFinite(from) && Number.isFinite(to)) {
      // Same glyph top in both frames: y_alpha = y_from + (to - from).
      return to - from
    }
  } finally {
    measureCtx.font = prevFont
    measureCtx.textBaseline = prevBaseline
  }
  const size = Number.parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? '10')
  switch (baseline) {
    case 'middle': return size * 0.35
    case 'top':
    case 'hanging': return size * 0.78
    case 'bottom':
    case 'ideographic': return -size * 0.22
    default: return 0
  }
}

/**
 * Snap standalone CSS weight tokens (100–900) to the nearest embedded face.
 * Exported for unit tests only.
 */
export function snapFontWeights(font: string): string {
  return font.replace(/(?<![\w-])[1-9]00(?![\w-])/g, (token) => {
    const weight = Number(token)
    let best = REGISTERED_WEIGHTS[0] ?? 400
    for (const candidate of REGISTERED_WEIGHTS) {
      if (Math.abs(candidate - weight) < Math.abs(best - weight)) best = candidate
    }
    return String(best)
  })
}

// ---------------------------------------------------------------------------
// roundRect tracing (shared by the shim polyfill and Path2D replay)
// ---------------------------------------------------------------------------

export interface PathSink {
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean) => void
  closePath: () => void
}

/** Exported for unit tests (also used by the shim polyfill + Path2D replay). */
export function traceRoundRect(
  sink: PathSink,
  x: number,
  y: number,
  w: number,
  h: number,
  radii?: RoundRectRadii,
): void {
  const [tl, tr, br, bl] = normalizeRadii(radii, w, h)
  const HALF_PI = Math.PI / 2

  sink.moveTo(x + tl, y)
  sink.lineTo(x + w - tr, y)
  if (tr > 0) sink.arc(x + w - tr, y + tr, tr, -HALF_PI, 0, false)
  sink.lineTo(x + w, y + h - br)
  if (br > 0) sink.arc(x + w - br, y + h - br, br, 0, HALF_PI, false)
  sink.lineTo(x + bl, y + h)
  if (bl > 0) sink.arc(x + bl, y + h - bl, bl, HALF_PI, Math.PI, false)
  sink.lineTo(x, y + tl)
  if (tl > 0) sink.arc(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5, false)
  sink.closePath()
}

/** [topLeft, topRight, bottomRight, bottomLeft], clamped per the HTML spec. */
function normalizeRadii(
  radii: RoundRectRadii | undefined,
  w: number,
  h: number,
): [number, number, number, number] {
  const toNumber = (r: number | DOMPointInit): number =>
    typeof r === 'number' ? r : ((r.x ?? 0) + (r.y ?? 0)) / 2

  let tl = 0
  let tr = 0
  let br = 0
  let bl = 0

  if (Array.isArray(radii)) {
    const r = radii.map(toNumber)
    if (r.length === 1) {
      tl = tr = br = bl = r[0] ?? 0
    } else if (r.length === 2) {
      tl = br = r[0] ?? 0
      tr = bl = r[1] ?? 0
    } else if (r.length === 3) {
      tl = r[0] ?? 0
      tr = bl = r[1] ?? 0
      br = r[2] ?? 0
    } else if (r.length >= 4) {
      tl = r[0] ?? 0
      tr = r[1] ?? 0
      br = r[2] ?? 0
      bl = r[3] ?? 0
    }
  } else if (radii !== undefined) {
    tl = tr = br = bl = toNumber(radii)
  }

  tl = Math.max(0, tl)
  tr = Math.max(0, tr)
  br = Math.max(0, br)
  bl = Math.max(0, bl)

  // Per spec: scale all radii down proportionally when adjacent pairs overlap.
  const factorFor = (side: number, sum: number): number => (sum > side ? side / sum : 1)
  const scale = Math.min(
    factorFor(w, tl + tr),
    factorFor(w, bl + br),
    factorFor(h, tl + bl),
    factorFor(h, tr + br),
  )
  if (scale < 1) {
    tl *= scale
    tr *= scale
    br *= scale
    bl *= scale
  }
  return [tl, tr, br, bl]
}
