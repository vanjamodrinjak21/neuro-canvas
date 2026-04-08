import { describe, it, expect } from 'vitest'
import { screenToWorld, worldToScreen } from '../useCanvasCoordinates'

describe('screenToWorld', () => {
  it('converts screen to world at zoom 1 with no pan', () => {
    const camera = { x: 0, y: 0, zoom: 1 }
    const result = screenToWorld(100, 200, camera)
    expect(result).toEqual({ x: 100, y: 200 })
  })

  it('accounts for camera pan', () => {
    const camera = { x: 50, y: 100, zoom: 1 }
    const result = screenToWorld(100, 200, camera)
    expect(result).toEqual({ x: 50, y: 100 })
  })

  it('accounts for zoom', () => {
    const camera = { x: 0, y: 0, zoom: 2 }
    const result = screenToWorld(100, 200, camera)
    expect(result).toEqual({ x: 50, y: 100 })
  })

  it('accounts for pan and zoom together', () => {
    const camera = { x: 100, y: 200, zoom: 2 }
    const result = screenToWorld(200, 400, camera)
    expect(result).toEqual({ x: 50, y: 100 })
  })
})

describe('worldToScreen', () => {
  it('is the inverse of screenToWorld', () => {
    const camera = { x: 100, y: 200, zoom: 2 }
    const world = screenToWorld(300, 400, camera)
    const screen = worldToScreen(world.x, world.y, camera)
    expect(screen.x).toBeCloseTo(300)
    expect(screen.y).toBeCloseTo(400)
  })

  it('converts world to screen at zoom 1 with no pan', () => {
    const camera = { x: 0, y: 0, zoom: 1 }
    const result = worldToScreen(100, 200, camera)
    expect(result).toEqual({ x: 100, y: 200 })
  })
})
