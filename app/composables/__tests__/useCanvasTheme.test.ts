import { describe, it, expect } from 'vitest'
import { useCanvasTheme } from '../useCanvasTheme'

describe('useCanvasTheme', () => {
  it('returns dark palette by default', () => {
    const { colors, isLight } = useCanvasTheme()
    expect(isLight.value).toBe(false)
    expect(colors.value.canvasBg).toBe('#0A0A0C')
  })

  it('returns light palette when isLight is true', () => {
    const { colors, isLight } = useCanvasTheme()
    isLight.value = true
    expect(colors.value.canvasBg).toBe('#FAFAF9')
  })

  it('has all required color keys', () => {
    const { colors } = useCanvasTheme()
    const c = colors.value
    expect(c).toHaveProperty('canvasBg')
    expect(c).toHaveProperty('nodeBg')
    expect(c).toHaveProperty('nodeBorder')
    expect(c).toHaveProperty('nodeText')
    expect(c).toHaveProperty('nodeSelected')
    expect(c).toHaveProperty('edgeDefault')
    expect(c).toHaveProperty('edgeSelected')
    expect(c).toHaveProperty('gridDot')
    expect(c).toHaveProperty('accent')
  })
})
