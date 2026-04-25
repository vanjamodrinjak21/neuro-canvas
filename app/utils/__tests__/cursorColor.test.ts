import { describe, it, expect } from 'vitest'
import { cursorColor } from '../cursorColor'

const PALETTE = ['#A78BFA', '#F472B6', '#60A5FA', '#4ADE80', '#FB923C', '#FACC15']

describe('cursorColor', () => {
  it('returns a color from the palette', () => {
    expect(PALETTE).toContain(cursorColor('user-123'))
  })

  it('is deterministic for the same id', () => {
    expect(cursorColor('user-123')).toBe(cursorColor('user-123'))
  })

  it('distributes across the palette for different ids', () => {
    const seen = new Set(['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8'].map(cursorColor))
    expect(seen.size).toBeGreaterThan(2)
  })
})
