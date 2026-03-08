import type { Camera } from '~/types/canvas'
import type { AlignmentGuide } from '~/composables/useSmartGuides'

/**
 * Draw smart alignment guides during node drag.
 * Renders thin dashed lines spanning the visible viewport.
 */
export function drawSmartGuides(
  ctx: CanvasRenderingContext2D,
  guides: AlignmentGuide[],
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  dpr: number,
  accentColor: string
) {
  if (guides.length === 0) return

  const viewWidth = canvasWidth / dpr / camera.zoom
  const viewHeight = canvasHeight / dpr / camera.zoom
  const worldLeft = -camera.x / camera.zoom
  const worldTop = -camera.y / camera.zoom
  const worldRight = worldLeft + viewWidth
  const worldBottom = worldTop + viewHeight

  ctx.save()
  ctx.strokeStyle = accentColor
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1 / camera.zoom
  ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom])

  for (const guide of guides) {
    ctx.beginPath()
    if (guide.axis === 'vertical') {
      ctx.moveTo(guide.position, worldTop)
      ctx.lineTo(guide.position, worldBottom)
    } else {
      ctx.moveTo(worldLeft, guide.position)
      ctx.lineTo(worldRight, guide.position)
    }
    ctx.stroke()

    // Diamond marker at guide position
    const markerSize = 3 / camera.zoom
    ctx.fillStyle = accentColor
    ctx.globalAlpha = 0.6
    if (guide.axis === 'vertical') {
      const midY = (worldTop + worldBottom) / 2
      ctx.beginPath()
      ctx.moveTo(guide.position, midY - markerSize)
      ctx.lineTo(guide.position + markerSize, midY)
      ctx.lineTo(guide.position, midY + markerSize)
      ctx.lineTo(guide.position - markerSize, midY)
      ctx.closePath()
      ctx.fill()
    } else {
      const midX = (worldLeft + worldRight) / 2
      ctx.beginPath()
      ctx.moveTo(midX - markerSize, guide.position)
      ctx.lineTo(midX, guide.position - markerSize)
      ctx.lineTo(midX + markerSize, guide.position)
      ctx.lineTo(midX, guide.position + markerSize)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 0.4
  }

  ctx.setLineDash([])
  ctx.restore()
}
