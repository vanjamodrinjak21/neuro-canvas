// Viewport compass — screen-space overlay showing off-screen node counts
// Draws edge gradients and arrow indicators with node counts per direction

import type { Camera, Node } from '~/types/canvas'

export interface CompassIndicator {
  direction: 'top' | 'right' | 'bottom' | 'left'
  count: number
  opacity: number
  nearestDistance: number
}

export function useViewportCompass() {
  /**
   * Compute off-screen node indicators for each viewport edge
   */
  function computeIndicators(
    camera: Camera,
    nodes: Map<string, Node>,
    viewportWidth: number,
    viewportHeight: number
  ): CompassIndicator[] {
    if (nodes.size === 0) return []

    // Viewport bounds in world coordinates
    const worldLeft = -camera.x / camera.zoom
    const worldTop = -camera.y / camera.zoom
    const worldRight = worldLeft + viewportWidth / camera.zoom
    const worldBottom = worldTop + viewportHeight / camera.zoom

    const indicators: Record<string, { count: number; nearestDist: number }> = {
      top: { count: 0, nearestDist: Infinity },
      right: { count: 0, nearestDist: Infinity },
      bottom: { count: 0, nearestDist: Infinity },
      left: { count: 0, nearestDist: Infinity }
    }

    for (const node of nodes.values()) {
      const cx = node.position.x + node.size.width / 2
      const cy = node.position.y + node.size.height / 2

      // Skip nodes inside viewport
      if (cx >= worldLeft && cx <= worldRight && cy >= worldTop && cy <= worldBottom) {
        continue
      }

      // Determine primary direction of the off-screen node
      const distLeft = worldLeft - cx
      const distRight = cx - worldRight
      const distTop = worldTop - cy
      const distBottom = cy - worldBottom

      const maxDist = Math.max(distLeft, distRight, distTop, distBottom)

      if (maxDist === distTop && distTop > 0) {
        indicators.top!.count++
        indicators.top!.nearestDist = Math.min(indicators.top!.nearestDist, distTop)
      } else if (maxDist === distRight && distRight > 0) {
        indicators.right!.count++
        indicators.right!.nearestDist = Math.min(indicators.right!.nearestDist, distRight)
      } else if (maxDist === distBottom && distBottom > 0) {
        indicators.bottom!.count++
        indicators.bottom!.nearestDist = Math.min(indicators.bottom!.nearestDist, distBottom)
      } else if (distLeft > 0) {
        indicators.left!.count++
        indicators.left!.nearestDist = Math.min(indicators.left!.nearestDist, distLeft)
      }
    }

    // Convert to array, computing opacity based on proximity
    const result: CompassIndicator[] = []
    for (const [dir, data] of Object.entries(indicators)) {
      if (data.count > 0) {
        // Closer nodes = higher opacity (fade out over 1000 world units)
        const opacity = Math.max(0.15, Math.min(0.7, 1 - data.nearestDist / 1000))
        result.push({
          direction: dir as CompassIndicator['direction'],
          count: data.count,
          opacity,
          nearestDistance: data.nearestDist
        })
      }
    }

    return result
  }

  /**
   * Draw compass indicators on the canvas in screen space
   */
  function draw(
    ctx: CanvasRenderingContext2D,
    indicators: CompassIndicator[],
    viewportWidth: number,
    viewportHeight: number,
    accentColor: string = '#00D2BE'
  ) {
    for (const indicator of indicators) {
      drawEdgeGradient(ctx, indicator, viewportWidth, viewportHeight, accentColor)
      drawArrowIndicator(ctx, indicator, viewportWidth, viewportHeight, accentColor)
    }
  }

  function drawEdgeGradient(
    ctx: CanvasRenderingContext2D,
    indicator: CompassIndicator,
    vw: number,
    vh: number,
    color: string
  ) {
    const gradientSize = 30
    ctx.globalAlpha = indicator.opacity * 0.3
    let gradient: CanvasGradient

    switch (indicator.direction) {
      case 'top':
        gradient = ctx.createLinearGradient(0, 0, 0, gradientSize)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, vw, gradientSize)
        break
      case 'bottom':
        gradient = ctx.createLinearGradient(0, vh, 0, vh - gradientSize)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(0, vh - gradientSize, vw, gradientSize)
        break
      case 'left':
        gradient = ctx.createLinearGradient(0, 0, gradientSize, 0)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, gradientSize, vh)
        break
      case 'right':
        gradient = ctx.createLinearGradient(vw, 0, vw - gradientSize, 0)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(vw - gradientSize, 0, gradientSize, vh)
        break
    }

    ctx.globalAlpha = 1
  }

  function drawArrowIndicator(
    ctx: CanvasRenderingContext2D,
    indicator: CompassIndicator,
    vw: number,
    vh: number,
    color: string
  ) {
    let arrowX = 0, arrowY = 0, angle = 0

    switch (indicator.direction) {
      case 'top':
        arrowX = vw / 2
        arrowY = 16
        angle = -Math.PI / 2
        break
      case 'bottom':
        arrowX = vw / 2
        arrowY = vh - 16
        angle = Math.PI / 2
        break
      case 'left':
        arrowX = 16
        arrowY = vh / 2
        angle = Math.PI
        break
      case 'right':
        arrowX = vw - 16
        arrowY = vh / 2
        angle = 0
        break
    }

    ctx.save()
    ctx.globalAlpha = indicator.opacity

    // Arrow
    ctx.translate(arrowX, arrowY)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(6, 0)
    ctx.lineTo(-3, -4)
    ctx.lineTo(-3, 4)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()

    // Count badge
    ctx.rotate(-angle)
    const text = indicator.count.toString()
    ctx.font = '10px "Inter", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Badge background
    const metrics = ctx.measureText(text)
    const badgeWidth = Math.max(metrics.width + 8, 18)
    const badgeX = indicator.direction === 'left' ? 12 : indicator.direction === 'right' ? -12 : 0
    const badgeY = indicator.direction === 'top' ? 12 : indicator.direction === 'bottom' ? -12 : 0

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.beginPath()
    ctx.roundRect(badgeX - badgeWidth / 2, badgeY - 8, badgeWidth, 16, 8)
    ctx.fill()

    ctx.fillStyle = color
    ctx.fillText(text, badgeX, badgeY)

    ctx.restore()
  }

  return {
    computeIndicators,
    draw
  }
}
