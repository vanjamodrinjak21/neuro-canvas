import type { Camera } from '~/types/canvas'

/**
 * Draw dot grid (editorial style) — dots at grid intersections.
 */
export function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  dpr: number,
  gridSize: number,
  enabled: boolean,
  colors: { gridDot: string }
) {
  if (!enabled) return

  const viewWidth = canvasWidth / dpr / camera.zoom
  const viewHeight = canvasHeight / dpr / camera.zoom

  const startX = Math.floor(-camera.x / camera.zoom / gridSize) * gridSize
  const startY = Math.floor(-camera.y / camera.zoom / gridSize) * gridSize
  const endX = startX + viewWidth + gridSize * 2
  const endY = startY + viewHeight + gridSize * 2

  ctx.fillStyle = colors.gridDot
  ctx.globalAlpha = 0.45

  const dotRadius = 1.2 / camera.zoom

  for (let x = startX; x <= endX; x += gridSize) {
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath()
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.globalAlpha = 1
}
