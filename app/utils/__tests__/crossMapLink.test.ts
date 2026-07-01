import { describe, it, expect } from 'vitest'
import { toLinkOptions, applyLinkToMetadata } from '~/utils/crossMapLink'

describe('toLinkOptions', () => {
  const maps = [
    { id: 'a', title: 'Zebra' },
    { id: 'b', title: 'Apple' },
    { id: 'self', title: 'Current map' },
    { id: 'c', title: '  Middle  ' },
  ]

  it('excludes the current map from link targets', () => {
    const opts = toLinkOptions(maps, 'self')
    expect(opts.map(o => o.id)).not.toContain('self')
    expect(opts).toHaveLength(3)
  })

  it('sorts targets by title', () => {
    const opts = toLinkOptions(maps, 'self')
    expect(opts.map(o => o.title)).toEqual(['Apple', 'Middle', 'Zebra'])
  })

  it('trims titles and falls back for empty ones', () => {
    const opts = toLinkOptions([{ id: 'x', title: '' }, { id: 'y', title: '  ' }], null)
    expect(opts.every(o => o.title === 'Untitled map')).toBe(true)
  })

  it('drops rows without an id', () => {
    const opts = toLinkOptions([{ id: '', title: 'ghost' }, { id: 'ok', title: 'Kept' }], null)
    expect(opts.map(o => o.id)).toEqual(['ok'])
  })

  it('keeps all maps when there is no current map id', () => {
    expect(toLinkOptions(maps, null)).toHaveLength(4)
  })
})

describe('applyLinkToMetadata', () => {
  it('sets linkedMapId on a fresh (undefined) metadata object', () => {
    const next = applyLinkToMetadata(undefined, 'map-1')
    expect(next.linkedMapId).toBe('map-1')
  })

  it('sets linkedMapId while preserving existing metadata', () => {
    const next = applyLinkToMetadata({ category: 'idea', notes: 'x' }, 'map-2')
    expect(next).toMatchObject({ category: 'idea', notes: 'x', linkedMapId: 'map-2' })
  })

  it('overwrites an existing link', () => {
    const next = applyLinkToMetadata({ linkedMapId: 'old' }, 'new')
    expect(next.linkedMapId).toBe('new')
  })

  it('removes the key entirely when cleared with null', () => {
    const next = applyLinkToMetadata({ category: 'idea', linkedMapId: 'gone' }, null)
    expect('linkedMapId' in next).toBe(false)
    expect(next.category).toBe('idea')
  })

  it('does not mutate the input metadata object', () => {
    const input = { linkedMapId: 'orig' }
    applyLinkToMetadata(input, 'changed')
    expect(input.linkedMapId).toBe('orig')
  })
})
