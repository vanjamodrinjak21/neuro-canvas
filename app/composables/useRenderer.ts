import type { Camera, Node, Edge, Viewport } from '~/types'

/**
 * Renderer type options
 */
export type RendererType = 'webgpu' | 'webgl2' | 'canvas2d'

/**
 * Renderer configuration
 */
export interface RendererConfig {
  antialias: boolean
  powerPreference: 'high-performance' | 'low-power' | 'default'
  pixelRatio: number
}

/**
 * Hardware Abstraction Layer for WebGPU/WebGL2/Canvas2D rendering
 */
export function useRenderer(canvas: Ref<HTMLCanvasElement | null>) {
  const rendererType = ref<RendererType>('canvas2d')
  const isInitialized = ref(false)
  const isRendering = ref(false)

  // Contexts
  let gpuDevice: GPUDevice | null = null
  let gpuContext: GPUCanvasContext | null = null
  let glContext: WebGL2RenderingContext | null = null
  let ctx2d: CanvasRenderingContext2D | null = null

  // Configuration
  const config = reactive<RendererConfig>({
    antialias: true,
    powerPreference: 'high-performance',
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  })

  /**
   * Detect best available renderer
   */
  async function detectBestRenderer(): Promise<RendererType> {
    // Try WebGPU first
    if ('gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter({
          powerPreference: config.powerPreference
        })
        if (adapter) {
          return 'webgpu'
        }
      } catch {
        console.log('WebGPU not available')
      }
    }

    // Try WebGL2
    if (canvas.value) {
      const testCanvas = document.createElement('canvas')
      const gl = testCanvas.getContext('webgl2')
      if (gl) {
        return 'webgl2'
      }
    }

    // Fallback to Canvas2D
    return 'canvas2d'
  }

  /**
   * Initialize WebGPU renderer
   */
  async function initWebGPU(): Promise<boolean> {
    if (!canvas.value || !('gpu' in navigator)) return false

    try {
      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: config.powerPreference
      })
      if (!adapter) return false

      gpuDevice = await adapter.requestDevice()
      gpuContext = canvas.value.getContext('webgpu') as GPUCanvasContext

      const format = (navigator as any).gpu.getPreferredCanvasFormat()
      gpuContext.configure({
        device: gpuDevice,
        format,
        alphaMode: 'premultiplied'
      })

      console.log('WebGPU initialized successfully')
      return true
    } catch (error) {
      console.error('WebGPU initialization failed:', error)
      return false
    }
  }

  /**
   * Initialize WebGL2 renderer
   */
  async function initWebGL2(): Promise<boolean> {
    if (!canvas.value) return false

    try {
      glContext = canvas.value.getContext('webgl2', {
        antialias: config.antialias,
        powerPreference: config.powerPreference,
        preserveDrawingBuffer: true
      })

      if (!glContext) return false

      // Enable required extensions
      glContext.getExtension('EXT_color_buffer_float')
      glContext.getExtension('OES_texture_float_linear')

      // Set up initial state
      glContext.enable(glContext.BLEND)
      glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA)

      console.log('WebGL2 initialized successfully')
      return true
    } catch (error) {
      console.error('WebGL2 initialization failed:', error)
      return false
    }
  }

  /**
   * Initialize Canvas2D renderer (fallback)
   */
  async function initCanvas2D(): Promise<boolean> {
    if (!canvas.value) return false

    try {
      ctx2d = canvas.value.getContext('2d', {
        alpha: true,
        desynchronized: true // Reduce latency
      })

      if (!ctx2d) return false

      console.log('Canvas2D initialized successfully')
      return true
    } catch (error) {
      console.error('Canvas2D initialization failed:', error)
      return false
    }
  }

  /**
   * Initialize the renderer
   */
  async function initialize(): Promise<boolean> {
    if (!canvas.value) return false

    rendererType.value = await detectBestRenderer()

    let success = false
    switch (rendererType.value) {
      case 'webgpu':
        success = await initWebGPU()
        break
      case 'webgl2':
        success = await initWebGL2()
        break
      case 'canvas2d':
        success = await initCanvas2D()
        break
    }

    if (!success) {
      // Fallback chain
      if (rendererType.value === 'webgpu') {
        rendererType.value = 'webgl2'
        success = await initWebGL2()
      }
      if (!success && rendererType.value !== 'canvas2d') {
        rendererType.value = 'canvas2d'
        success = await initCanvas2D()
      }
    }

    isInitialized.value = success
    return success
  }

  /**
   * Resize the renderer
   */
  function resize(width: number, height: number) {
    if (!canvas.value) return

    const scaledWidth = Math.floor(width * config.pixelRatio)
    const scaledHeight = Math.floor(height * config.pixelRatio)

    canvas.value.width = scaledWidth
    canvas.value.height = scaledHeight
    canvas.value.style.width = `${width}px`
    canvas.value.style.height = `${height}px`

    if (rendererType.value === 'webgpu' && gpuContext && gpuDevice) {
      gpuContext.configure({
        device: gpuDevice,
        format: (navigator as any).gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied'
      })
    }

    if (rendererType.value === 'webgl2' && glContext) {
      glContext.viewport(0, 0, scaledWidth, scaledHeight)
    }
  }

  /**
   * Clear the canvas
   */
  function clear(color: [number, number, number, number] = [0.012, 0.133, 0.129, 1]) {
    if (rendererType.value === 'webgpu' && gpuDevice && gpuContext) {
      // WebGPU clear is done in the render pass
      return
    }

    if (rendererType.value === 'webgl2' && glContext) {
      glContext.clearColor(...color)
      glContext.clear(glContext.COLOR_BUFFER_BIT)
      return
    }

    if (rendererType.value === 'canvas2d' && ctx2d && canvas.value) {
      ctx2d.fillStyle = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`
      ctx2d.fillRect(0, 0, canvas.value.width, canvas.value.height)
    }
  }

  /**
   * Render nodes and edges
   */
  function render(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    camera: Camera,
    viewport: Viewport,
    selection: { nodeIds: Set<string>; edgeIds: Set<string> }
  ) {
    if (!isInitialized.value || isRendering.value) return
    isRendering.value = true

    try {
      // For now, use Canvas2D for all rendering
      // WebGPU/WebGL2 implementations would go here
      if (ctx2d && canvas.value) {
        renderCanvas2D(nodes, edges, camera, viewport, selection)
      }
    } finally {
      isRendering.value = false
    }
  }

  /**
   * Canvas2D rendering implementation
   */
  function renderCanvas2D(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    camera: Camera,
    viewport: Viewport,
    selection: { nodeIds: Set<string>; edgeIds: Set<string> }
  ) {
    if (!ctx2d || !canvas.value) return

    const { width, height } = canvas.value

    // Clear
    ctx2d.fillStyle = '#032221'
    ctx2d.fillRect(0, 0, width, height)

    // Save context and apply camera transform
    ctx2d.save()
    ctx2d.scale(config.pixelRatio, config.pixelRatio)
    ctx2d.translate(camera.x, camera.y)
    ctx2d.scale(camera.zoom, camera.zoom)

    // Calculate visible bounds for culling
    const visibleBounds = {
      minX: -camera.x / camera.zoom - 100,
      minY: -camera.y / camera.zoom - 100,
      maxX: (-camera.x + viewport.width) / camera.zoom + 100,
      maxY: (-camera.y + viewport.height) / camera.zoom + 100
    }

    // Draw edges first (below nodes)
    for (const edge of edges.values()) {
      const sourceNode = nodes.get(edge.sourceId)
      const targetNode = nodes.get(edge.targetId)
      if (!sourceNode || !targetNode) continue

      // Simple culling - skip if both nodes are outside viewport
      if (!isNodeVisible(sourceNode, visibleBounds) && !isNodeVisible(targetNode, visibleBounds)) {
        continue
      }

      renderEdge2D(ctx2d, edge, sourceNode, targetNode, selection.edgeIds.has(edge.id))
    }

    // Draw nodes
    for (const node of nodes.values()) {
      // Viewport culling
      if (!isNodeVisible(node, visibleBounds)) continue

      renderNode2D(ctx2d, node, selection.nodeIds.has(node.id))
    }

    ctx2d.restore()
  }

  /**
   * Check if a node is within visible bounds
   */
  function isNodeVisible(
    node: Node,
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
  ): boolean {
    return (
      node.position.x + node.size.width >= bounds.minX &&
      node.position.x <= bounds.maxX &&
      node.position.y + node.size.height >= bounds.minY &&
      node.position.y <= bounds.maxY
    )
  }

  /**
   * Render a single node using Canvas2D
   */
  function renderNode2D(
    ctx: CanvasRenderingContext2D,
    node: Node,
    isSelected: boolean
  ) {
    const { x, y } = node.position
    const { width, height } = node.size
    const style = node.style

    // Shadow
    if (style.shadowEnabled || isSelected) {
      ctx.shadowColor = isSelected ? 'rgba(44, 195, 149, 0.5)' : 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = isSelected ? 20 : 10
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = isSelected ? 0 : 4
    }

    // Draw shape
    ctx.fillStyle = style.fillColor
    ctx.strokeStyle = isSelected ? '#2CC395' : style.borderColor
    ctx.lineWidth = style.borderWidth + (isSelected ? 1 : 0)

    const radius = style.shape === 'circle' ? Math.min(width, height) / 2 : 8

    ctx.beginPath()
    if (style.shape === 'circle') {
      ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2)
    } else if (style.shape === 'diamond') {
      ctx.moveTo(x + width / 2, y)
      ctx.lineTo(x + width, y + height / 2)
      ctx.lineTo(x + width / 2, y + height)
      ctx.lineTo(x, y + height / 2)
      ctx.closePath()
    } else {
      ctx.roundRect(x, y, width, height, radius)
    }
    ctx.fill()
    ctx.stroke()

    // Reset shadow
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Draw text
    ctx.fillStyle = style.textColor
    ctx.font = `${style.fontWeight} ${style.fontSize}px Geist, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Simple text rendering (single line)
    const maxWidth = width - 16
    let text = node.content
    const metrics = ctx.measureText(text)
    if (metrics.width > maxWidth) {
      // Truncate with ellipsis
      while (text.length > 0 && ctx.measureText(text + '...').width > maxWidth) {
        text = text.slice(0, -1)
      }
      text += '...'
    }

    ctx.fillText(text, x + width / 2, y + height / 2)
  }

  /**
   * Render a single edge using Canvas2D
   */
  function renderEdge2D(
    ctx: CanvasRenderingContext2D,
    edge: Edge,
    sourceNode: Node,
    targetNode: Node,
    isSelected: boolean
  ) {
    const style = edge.style

    // Calculate connection points
    const sourceCenter = {
      x: sourceNode.position.x + sourceNode.size.width / 2,
      y: sourceNode.position.y + sourceNode.size.height / 2
    }
    const targetCenter = {
      x: targetNode.position.x + targetNode.size.width / 2,
      y: targetNode.position.y + targetNode.size.height / 2
    }

    // Get edge points on node boundaries
    const sourcePoint = getEdgePoint(sourceNode, targetCenter)
    const targetPoint = getEdgePoint(targetNode, sourceCenter)

    ctx.strokeStyle = isSelected ? '#2CC395' : style.strokeColor
    ctx.lineWidth = style.strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (style.dashArray) {
      ctx.setLineDash(style.dashArray)
    } else {
      ctx.setLineDash([])
    }

    ctx.beginPath()

    if (style.type === 'bezier') {
      const dx = targetPoint.x - sourcePoint.x
      const cx1 = sourcePoint.x + dx * 0.5
      const cy1 = sourcePoint.y
      const cx2 = targetPoint.x - dx * 0.5
      const cy2 = targetPoint.y

      ctx.moveTo(sourcePoint.x, sourcePoint.y)
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, targetPoint.x, targetPoint.y)
    } else if (style.type === 'orthogonal') {
      const midX = (sourcePoint.x + targetPoint.x) / 2
      ctx.moveTo(sourcePoint.x, sourcePoint.y)
      ctx.lineTo(midX, sourcePoint.y)
      ctx.lineTo(midX, targetPoint.y)
      ctx.lineTo(targetPoint.x, targetPoint.y)
    } else {
      ctx.moveTo(sourcePoint.x, sourcePoint.y)
      ctx.lineTo(targetPoint.x, targetPoint.y)
    }

    ctx.stroke()
    ctx.setLineDash([])

    // Draw arrow
    if (style.arrowEnd === 'arrow') {
      const angle = Math.atan2(targetPoint.y - sourcePoint.y, targetPoint.x - sourcePoint.x)
      const arrowLength = style.strokeWidth * 4
      const arrowAngle = Math.PI / 6

      ctx.fillStyle = isSelected ? '#2CC395' : style.strokeColor
      ctx.beginPath()
      ctx.moveTo(targetPoint.x, targetPoint.y)
      ctx.lineTo(
        targetPoint.x - arrowLength * Math.cos(angle - arrowAngle),
        targetPoint.y - arrowLength * Math.sin(angle - arrowAngle)
      )
      ctx.lineTo(
        targetPoint.x - arrowLength * Math.cos(angle + arrowAngle),
        targetPoint.y - arrowLength * Math.sin(angle + arrowAngle)
      )
      ctx.closePath()
      ctx.fill()
    }
  }

  /**
   * Get edge point on node boundary
   */
  function getEdgePoint(node: Node, target: { x: number; y: number }): { x: number; y: number } {
    const cx = node.position.x + node.size.width / 2
    const cy = node.position.y + node.size.height / 2
    const dx = target.x - cx
    const dy = target.y - cy

    const hw = node.size.width / 2
    const hh = node.size.height / 2

    const sx = dx === 0 ? 0 : Math.abs(hw / dx)
    const sy = dy === 0 ? 0 : Math.abs(hh / dy)
    const s = Math.min(sx || Infinity, sy || Infinity)

    return {
      x: cx + dx * s,
      y: cy + dy * s
    }
  }

  /**
   * Cleanup renderer resources
   */
  function dispose() {
    gpuDevice?.destroy()
    gpuDevice = null
    gpuContext = null
    glContext = null
    ctx2d = null
    isInitialized.value = false
  }

  return {
    rendererType: readonly(rendererType),
    isInitialized: readonly(isInitialized),
    isRendering: readonly(isRendering),
    config,
    initialize,
    resize,
    clear,
    render,
    dispose
  }
}
