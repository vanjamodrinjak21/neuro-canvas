import { describe, it, expect } from 'vitest'
import {
  NODE_CATEGORIES,
  getCategoryColor,
  getCategoryInfo,
  LEGACY_CATEGORY_MAP,
  resolveCategoryId,
  CATEGORY_IDS,
  type CategoryId
} from '../categories'

describe('NODE_CATEGORIES', () => {
  it('defines exactly 8 categories', () => {
    expect(Object.keys(NODE_CATEGORIES)).toHaveLength(8)
  })

  it('all categories have required fields', () => {
    for (const [id, cat] of Object.entries(NODE_CATEGORIES)) {
      expect(cat.label).toBeTruthy()
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(cat.icon).toMatch(/^i-lucide-/)
      expect(cat.defaultShape).toBeTruthy()
      expect(id).toBe(id.toLowerCase())
    }
  })

  it('all colors are unique', () => {
    const colors = Object.values(NODE_CATEGORIES).map(c => c.color)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('includes expected category IDs', () => {
    const ids = Object.keys(NODE_CATEGORIES)
    expect(ids).toContain('root')
    expect(ids).toContain('concept')
    expect(ids).toContain('fact')
    expect(ids).toContain('question')
    expect(ids).toContain('example')
    expect(ids).toContain('definition')
    expect(ids).toContain('process')
    expect(ids).toContain('note')
  })
})

describe('getCategoryColor', () => {
  it('returns color for known category', () => {
    expect(getCategoryColor('root')).toBe('#00D2BE')
    expect(getCategoryColor('concept')).toBe('#60A5FA')
  })

  it('returns default teal for unknown category', () => {
    expect(getCategoryColor('unknown')).toBe('#00D2BE')
  })
})

describe('getCategoryInfo', () => {
  it('returns full info for known category', () => {
    const info = getCategoryInfo('question')
    expect(info.label).toBe('Question')
    expect(info.color).toBe('#FACC15')
    expect(info.icon).toBe('i-lucide-help-circle')
    expect(info.defaultShape).toBe('diamond')
  })

  it('returns fallback for unknown category', () => {
    const info = getCategoryInfo('nonexistent')
    expect(info.label).toBe('Uncategorized')
    expect(info.color).toBe('#555558')
  })
})

describe('LEGACY_CATEGORY_MAP', () => {
  it('maps all old sidebar category IDs', () => {
    expect(LEGACY_CATEGORY_MAP['main-fact']).toBe('root')
    expect(LEGACY_CATEGORY_MAP['description']).toBe('concept')
    expect(LEGACY_CATEGORY_MAP['evidence']).toBe('fact')
    expect(LEGACY_CATEGORY_MAP['idea']).toBe('example')
    expect(LEGACY_CATEGORY_MAP['reference']).toBe('definition')
  })

  it('does not map categories that already exist in new system', () => {
    expect(LEGACY_CATEGORY_MAP).not.toHaveProperty('question')
    expect(LEGACY_CATEGORY_MAP).not.toHaveProperty('concept')
  })
})
