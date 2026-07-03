import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three'
import { buildTopoGraph, PAN_TOTAL, type TopoGraph } from './graph'
import { ACTIVE_LINKS, ACTIVE_NODES, topoFragment, topoVertex } from './shader'

export interface TopoSceneOptions {
  reducedMotion?: boolean
  seed?: number
}

const CURSOR_LINKS = 3
/** cull margin beyond the visible window — comfortably past the largest
 * peak's gaussian tail so toggling is invisible at the screen edge */
const CULL_MARGIN = 0.65

/**
 * One fullscreen quad, one fragment shader — the topographic neural map.
 * The host feeds scroll progress, pointer position and ticker updates.
 * Each frame the CPU culls the graph to a small active set around the
 * visible window and precomputes every uniform-only term (birth pops,
 * link growth, cursor heat, pulse positions, dash offsets) so the
 * fragment shader only does per-pixel work. Visually identical to
 * evaluating the full graph — off-screen contributions are ~e^-100.
 */
export class TopoScene {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private material: ShaderMaterial
  private mesh: Mesh

  private graph: TopoGraph
  private cursorLinks: Vector4[]

  // active-set uniform storage (reused every frame, no allocations)
  private aNodes: Vector4[]
  private aNodeDraw: Vector4[]
  private aLinks: Vector4[]
  private aLinkLive: Vector4[]
  private aLinkLen: Float32Array

  private targetProgress = 0
  private progress = 0
  private introReveal = 0
  private elapsed = 0
  private readonly reducedMotion: boolean

  // pointer state (all damped)
  private mouseNdcTarget = new Vector2(0, 0)
  private mouseNdc = new Vector2(0, 0)
  private mouseIn = 0
  private mouseInTarget = 0

  private pixelRatio: number
  private frameEma = 1 / 60
  private frameCount = 0
  /** compresses network x on narrow viewports so clusters stay on screen */
  private xComp = 1

  constructor(private canvas: HTMLCanvasElement, opts: TopoSceneOptions = {}) {
    this.reducedMotion = opts.reducedMotion ?? false

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false, // fragment shader does its own AA via fwidth
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75)
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

    this.graph = buildTopoGraph(opts.seed)
    this.cursorLinks = Array.from({ length: CURSOR_LINKS }, () => new Vector4(0, 0, 0, 0))
    this.aNodes = Array.from({ length: ACTIVE_NODES }, () => new Vector4(0, 0, 0, 1))
    this.aNodeDraw = Array.from({ length: ACTIVE_NODES }, () => new Vector4(0, 0, 0, 0))
    this.aLinks = Array.from({ length: ACTIVE_LINKS }, () => new Vector4(0, 0, 0, 0))
    this.aLinkLive = Array.from({ length: ACTIVE_LINKS }, () => new Vector4(0, 0, 0, 0))
    this.aLinkLen = new Float32Array(ACTIVE_LINKS)

    this.material = new ShaderMaterial({
      vertexShader: topoVertex,
      fragmentShader: topoFragment,
      uniforms: {
        uRes: { value: new Vector2(canvas.clientWidth, canvas.clientHeight) },
        uTime: { value: 0 },
        uTimeScale: { value: this.reducedMotion ? 0 : 1 },
        uReveal: { value: 0 },
        uPan: { value: 0 },
        uMouseW: { value: new Vector2(0, -10) },
        uMouseN: { value: new Vector2(0, 0) },
        uMouseIn: { value: 0 },
        uANodes: { value: this.aNodes },
        uANodeDraw: { value: this.aNodeDraw },
        uALinks: { value: this.aLinks },
        uALinkLive: { value: this.aLinkLive },
        uALinkLen: { value: this.aLinkLen },
        uCursorLinks: { value: this.cursorLinks },
      },
      depthTest: false,
      depthWrite: false,
    })

    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
    this.updateXComp()
  }

  setTargetProgress(p: number): void {
    this.targetProgress = Math.min(Math.max(p, 0), 1)
  }

  /** Pointer in viewport pixels. */
  setPointer(x: number, y: number): void {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.mouseNdcTarget.set((x / w) * 2 - 1, -((y / h) * 2 - 1))
    this.mouseInTarget = 1
  }

  pointerLeave(): void {
    this.mouseInTarget = 0
  }

  /** Load intro: tween 0 → ~0.14 so the first cluster surfaces unprompted. */
  setIntroReveal(v: number): void {
    this.introReveal = v
  }

  update(dt: number): void {
    const clamped = Math.min(dt, 1 / 20)
    this.elapsed += clamped

    const damp = this.reducedMotion ? 1 : 1 - Math.exp(-clamped * 3.6)
    this.progress += (this.targetProgress - this.progress) * damp

    const mDamp = this.reducedMotion ? 1 : 1 - Math.exp(-clamped * 5.5)
    this.mouseNdc.lerp(this.mouseNdcTarget, mDamp)
    this.mouseIn += (this.mouseInTarget - this.mouseIn) * mDamp

    const u = this.material.uniforms
    const reveal = Math.max(this.introReveal, Math.min(1, this.progress * 1.15))
    const pan = this.progress * PAN_TOTAL

    // mouse ndc → world (must mirror the shader's mapping)
    const aspect = this.canvas.clientWidth / Math.max(this.canvas.clientHeight, 1)
    const mouseWx = (this.mouseNdc.x * 0.5) * aspect
    const mouseWy = this.mouseNdc.y * 0.5 + 0.5 + pan

    u.uTime!.value = this.elapsed
    u.uReveal!.value = reveal
    u.uPan!.value = pan
    ;(u.uMouseW!.value as Vector2).set(mouseWx, mouseWy)
    ;(u.uMouseN!.value as Vector2).set(this.mouseNdc.x, this.mouseNdc.y)
    u.uMouseIn!.value = this.mouseIn

    // the pointer in the network layer's parallax-shifted space — hot
    // terms must be computed against the same coordinates the shader draws in
    const mnx = mouseWx - this.mouseNdc.x * 0.038
    const mny = mouseWy - this.mouseNdc.y * 0.038

    this.updateActiveSets(reveal, pan, mnx, mny)
    this.pickCursorLinks(mouseWx, mouseWy, reveal)

    this.renderer.render(this.scene, this.camera)
    this.adaptQuality(clamped)
  }

  resize(): void {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(w, h, false)
    ;(this.material.uniforms.uRes!.value as Vector2).set(w, h)
    this.updateXComp()
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }

  private updateXComp(): void {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.xComp = Math.min(1, w / h / 1.5)
  }

  /**
   * Cull the graph to the visible window and precompute every
   * uniform-only quantity. Runs on ~34 nodes + 40 links — trivial for
   * the CPU, a 2-3x cut for the fragment shader.
   */
  private updateActiveSets(reveal: number, pan: number, mnx: number, mny: number): void {
    const lo = pan - CULL_MARGIN
    const hi = pan + 1 + CULL_MARGIN
    const centerY = pan + 0.5
    const ts = this.reducedMotion ? 0 : 1

    // ---- nodes ----
    const nodeCand: { sx: number; y: number; amp: number; r: number; rr: number; hot: number; d: number }[] = []
    for (const n of this.graph.nodes) {
      if (n.y < lo || n.y > hi) continue
      const r01 = Math.min(Math.max((reveal - n.w) / 0.06, 0), 1)
      if (r01 <= 0) continue
      const pop = r01 * (1 + 0.35 * Math.sin(r01 * Math.PI))
      const sx = n.x * this.xComp
      const size = n.z
      const dx = mnx - sx
      const dy = mny - n.y
      nodeCand.push({
        sx,
        y: n.y,
        amp: size * 3.1 * pop,
        r: size * 2.1,
        rr: (0.009 + size * 0.075) * pop,
        hot: Math.exp(-(dx * dx + dy * dy) * 30) * this.mouseIn,
        d: Math.abs(n.y - centerY),
      })
    }
    if (nodeCand.length > ACTIVE_NODES) nodeCand.sort((a, b) => a.d - b.d)
    for (let i = 0; i < ACTIVE_NODES; i++) {
      const c = nodeCand[i]
      if (c) {
        this.aNodes[i]!.set(c.sx, c.y, c.amp, Math.max(c.r, 1e-4))
        this.aNodeDraw[i]!.set(c.rr, c.hot, 0, 0)
      } else {
        this.aNodes[i]!.set(0, -10, 0, 1)
        this.aNodeDraw[i]!.set(0, 0, 0, 0)
      }
    }

    // ---- links ----
    const linkCand: {
      ax: number; ay: number; bx: number; by: number
      grow: number; hot: number; pulseT: number; dashOff: number; len: number; d: number
    }[] = []
    for (let i = 0; i < this.graph.links.length; i++) {
      const L = this.graph.links[i]!
      const meta = this.graph.linkMeta[i]!
      const yMin = Math.min(L.y, L.w)
      const yMax = Math.max(L.y, L.w)
      if (yMax < lo || yMin > hi) continue
      const grow01 = Math.min(Math.max((reveal - meta.x) / 0.1, 0), 1)
      if (grow01 <= 0) continue

      const ax = L.x * this.xComp
      const bx = L.z * this.xComp
      const dxl = bx - ax
      const dyl = L.w - L.y
      const len = Math.sqrt(dxl * dxl + dyl * dyl)

      // cursor heat: distance from the pointer to the segment (CPU segDist)
      let t = (( mnx - ax) * dxl + (mny - L.y) * dyl) / Math.max(len * len, 1e-6)
      t = Math.min(Math.max(t, 0), 1)
      const ex = mnx - (ax + dxl * t)
      const ey = mny - (L.y + dyl * t)
      const hot = Math.exp(-(ex * ex + ey * ey) * 26) * this.mouseIn

      const phase = meta.y
      const speed = meta.z
      const time = this.elapsed * ts
      const pulseT = (time * 0.13 * speed + phase) % 1
      const dashOff = phase * 7 - time * 0.5 * speed

      linkCand.push({
        ax, ay: L.y, bx, by: L.w,
        grow: grow01 * 1.04,
        hot, pulseT, dashOff, len,
        d: Math.abs((L.y + L.w) / 2 - centerY),
      })
    }
    if (linkCand.length > ACTIVE_LINKS) linkCand.sort((a, b) => a.d - b.d)
    for (let i = 0; i < ACTIVE_LINKS; i++) {
      const c = linkCand[i]
      if (c) {
        this.aLinks[i]!.set(c.ax, c.ay, c.bx, c.by)
        this.aLinkLive[i]!.set(c.grow, c.hot, c.pulseT, c.dashOff)
        this.aLinkLen[i] = c.len
      } else {
        this.aLinks[i]!.set(0, -10, 0, -10)
        this.aLinkLive[i]!.set(0, 0, 0, 0)
        this.aLinkLen[i] = 0
      }
    }
  }

  /** The pointer joins the network: link it to the nearest visible peaks. */
  private pickCursorLinks(mx: number, my: number, reveal: number): void {
    const candidates: { x: number; y: number; d: number }[] = []
    for (const n of this.graph.nodes) {
      if (n.w > reveal) continue // not born yet
      const nx = n.x * this.xComp // same compressed space the shader draws in
      const dx = nx - mx
      const dy = n.y - my
      const d = dx * dx + dy * dy
      if (d < 0.6) candidates.push({ x: nx, y: n.y, d })
    }
    candidates.sort((a, b) => a.d - b.d)
    for (let i = 0; i < CURSOR_LINKS; i++) {
      const c = candidates[i]
      if (c) {
        const strength = Math.max(0, 1 - Math.sqrt(c.d) / 0.75)
        this.cursorLinks[i]!.set(c.x, c.y, strength, 0)
      } else {
        this.cursorLinks[i]!.set(0, 0, 0, 0)
      }
    }
  }

  /** Step the pixel ratio down if frames run long (fragment cost scales with px). */
  private adaptQuality(dt: number): void {
    this.frameEma += (dt - this.frameEma) * 0.05
    this.frameCount++
    if (this.frameCount % 120 === 0 && this.frameEma > 0.027 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25)
      this.resize()
    }
  }
}
