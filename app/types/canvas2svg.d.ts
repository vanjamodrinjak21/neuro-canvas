// Hand-written types for canvas2svg@1.0.16 (no upstream/@types package).
//
// canvas2svg mimics CanvasRenderingContext2D and builds an SVG DOM instead of
// rasterizing. Only the surface the map PDF export uses is declared here —
// see app/utils/exportMapPdf.ts. Members are declared as *function-typed
// properties* (not methods) so the export code can wrap them with polyfills
// (Path2D replay, roundRect, setLineDash, baseline normalization) without
// fighting method-invariance rules.
declare module 'canvas2svg' {
  export interface C2SOptions {
    width?: number
    height?: number
    enableMirroring?: boolean
    document?: Document
  }

  export default class C2S {
    constructor(options?: C2SOptions)
    constructor(width: number, height: number)

    // ── Drawing state (plain data properties, like the real ctx) ─────────
    fillStyle: string | CanvasGradient | CanvasPattern
    strokeStyle: string | CanvasGradient | CanvasPattern
    lineWidth: number
    lineCap: CanvasLineCap
    lineJoin: CanvasLineJoin
    miterLimit: number
    globalAlpha: number
    font: string
    textAlign: CanvasTextAlign
    textBaseline: CanvasTextBaseline
    /** Accepted but ignored by canvas2svg (SVG 1.1 has no canvas shadows). */
    shadowColor: string
    shadowBlur: number
    shadowOffsetX: number
    shadowOffsetY: number
    /** Not implemented upstream — polyfilled by exportMapPdf. */
    lineDashOffset: number

    // ── Path + paint API (function-typed so polyfills can wrap them) ─────
    save: () => void
    restore: () => void
    translate: (x: number, y: number) => void
    scale: (x: number, y: number) => void
    rotate: (angle: number) => void
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
    /** Upstream implementation is a NO-OP — use translate/scale instead. */
    setTransform: (a?: number, b?: number, c?: number, d?: number, e?: number, f?: number) => void
    beginPath: () => void
    closePath: () => void
    moveTo: (x: number, y: number) => void
    lineTo: (x: number, y: number) => void
    bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => void
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void
    arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean) => void
    arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void
    rect: (x: number, y: number, width: number, height: number) => void
    /** Not implemented upstream — polyfilled by exportMapPdf. */
    roundRect: (x: number, y: number, w: number, h: number, radii?: number | DOMPointInit | Array<number | DOMPointInit>) => void
    /** Upstream ignores Path2D arguments — wrapped by exportMapPdf to replay recorded paths. */
    fill: (path?: Path2D, fillRule?: CanvasFillRule) => void
    stroke: (path?: Path2D) => void
    clip: (path?: Path2D, fillRule?: CanvasFillRule) => void
    fillRect: (x: number, y: number, width: number, height: number) => void
    strokeRect: (x: number, y: number, width: number, height: number) => void
    clearRect: (x: number, y: number, width: number, height: number) => void
    fillText: (text: string, x: number, y: number) => void
    strokeText: (text: string, x: number, y: number) => void
    /** Delegates to a real 2D context with the current font — exact parity with raster export. */
    measureText: (text: string) => TextMetrics
    /** Not implemented upstream — polyfilled by exportMapPdf. */
    setLineDash: (segments: number[]) => void
    /** Not implemented upstream — polyfilled by exportMapPdf. */
    getLineDash: () => number[]
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => CanvasGradient
    createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => CanvasGradient

    // ── Output ───────────────────────────────────────────────────────────
    getSvg: () => SVGSVGElement
    getSerializedSvg: (fixNamedEntities?: boolean) => string

    // ── Internals used by the polyfills ─────────────────────────────────
    /** The SVG element styles are currently applied to (last painted path/rect/text). */
    __currentElement: SVGElement
    /** Real offscreen 2D context canvas2svg keeps for text measurement. */
    __ctx: CanvasRenderingContext2D
  }
}
