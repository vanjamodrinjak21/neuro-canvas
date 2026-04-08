import type { NodeShape } from '~/types/canvas'

/**
 * Return a Path2D for the given shape at the specified position and dimensions.
 *
 * Pure function — no side effects, no canvas context needed.
 * All draw functions (drawNode, drawNodeSimplified, drawGhostNodes) should
 * call this instead of inline shape switch/if-else chains.
 */
export function getShapePath(
  shape: NodeShape,
  x: number,
  y: number,
  w: number,
  h: number
): Path2D {
  const path = new Path2D()
  const cx = x + w / 2
  const cy = y + h / 2

  switch (shape) {
    case 'circle': {
      const r = Math.min(w, h) / 2
      path.arc(cx, cy, Math.max(r, 0), 0, Math.PI * 2)
      break
    }

    case 'diamond': {
      path.moveTo(cx, y)
      path.lineTo(x + w, cy)
      path.lineTo(cx, y + h)
      path.lineTo(x, cy)
      path.closePath()
      break
    }

    case 'hexagon': {
      const rx = w / 2
      const ry = h / 2
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2
        const px = cx + rx * Math.cos(angle)
        const py = cy + ry * Math.sin(angle)
        if (i === 0) path.moveTo(px, py)
        else path.lineTo(px, py)
      }
      path.closePath()
      break
    }

    case 'star': {
      const outerRx = w / 2
      const outerRy = h / 2
      const innerRx = outerRx * 0.45
      const innerRy = outerRy * 0.45
      const points = 6
      for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI / points) * i - Math.PI / 2
        const isOuter = i % 2 === 0
        const rx = isOuter ? outerRx : innerRx
        const ry = isOuter ? outerRy : innerRy
        const px = cx + rx * Math.cos(angle)
        const py = cy + ry * Math.sin(angle)
        if (i === 0) path.moveTo(px, py)
        else path.lineTo(px, py)
      }
      path.closePath()
      break
    }

    case 'pill': {
      const r = Math.min(h / 2, w / 2)
      path.roundRect(x, y, w, h, r)
      break
    }

    case 'dot': {
      const r = Math.min(w, h) / 2
      path.arc(cx, cy, Math.max(r, 4), 0, Math.PI * 2)
      break
    }

    case 'rectangle': {
      path.roundRect(x, y, w, h, 2)
      break
    }

    case 'rounded':
    default: {
      path.roundRect(x, y, w, h, 10)
      break
    }
  }

  return path
}
