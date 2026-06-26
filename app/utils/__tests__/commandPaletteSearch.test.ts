import { describe, it, expect } from 'vitest'
import { fuzzyScore, scoreFields, highlightSegments } from '~/utils/commandPaletteSearch'

describe('fuzzyScore', () => {
  it('returns 0 for an empty query or empty text', () => {
    expect(fuzzyScore('', 'anything').score).toBe(0)
    expect(fuzzyScore('  ', 'anything').score).toBe(0)
    expect(fuzzyScore('x', '').score).toBe(0)
  })

  it('scores an exact (case-insensitive) match as 1 and highlights the whole string', () => {
    const r = fuzzyScore('New Map', 'new map')
    expect(r.score).toBe(1)
    expect(r.ranges).toEqual([[0, 7]])
  })

  it('ranks prefix > word-boundary substring > mid-word substring', () => {
    const prefix = fuzzyScore('neuro', 'Neuroscience').score
    const wordBoundary = fuzzyScore('canvas', 'Neuro Canvas').score
    const midWord = fuzzyScore('science', 'Neuroscience').score
    expect(prefix).toBeGreaterThan(wordBoundary)
    expect(wordBoundary).toBeGreaterThan(midWord)
    expect(midWord).toBeGreaterThan(0)
  })

  it('highlights the contiguous substring range', () => {
    const r = fuzzyScore('canvas', 'Neuro Canvas')
    expect(r.ranges).toEqual([[6, 12]])
  })

  it('matches a subsequence (fzf-style "nm" → "New Map") below substring tier', () => {
    const sub = fuzzyScore('nm', 'New Map')
    expect(sub.score).toBeGreaterThan(0)
    // both matched chars are at word starts → two single-char ranges
    expect(sub.ranges).toEqual([[0, 1], [4, 5]])
    // a real substring should still outrank a scattered subsequence
    expect(fuzzyScore('new', 'New Map').score).toBeGreaterThan(sub.score)
  })

  it('rewards compact subsequences over scattered ones', () => {
    const compact = fuzzyScore('abc', 'abcdefg').score   // contiguous-ish
    const scattered = fuzzyScore('aeg', 'abcdefg').score  // spread out
    expect(compact).toBeGreaterThan(scattered)
  })

  it('tolerates a small typo via per-token similarity (no ranges)', () => {
    const r = fuzzyScore('neuor', 'Neuro Canvas') // transposed
    expect(r.score).toBeGreaterThan(0)
    expect(r.ranges).toEqual([])
  })

  it('returns 0 when nothing matches at all', () => {
    expect(fuzzyScore('zzzzz', 'New Map').score).toBe(0)
  })
})

describe('scoreFields', () => {
  it('picks the best weighted field and returns the primary field ranges', () => {
    // query hits the secondary (node) field, not the title
    const r = scoreFields('mitochondria', [
      { text: 'Biology Map', weight: 1 },
      { text: 'the mitochondria is the powerhouse', weight: 0.55 },
    ])
    expect(r.score).toBeGreaterThan(0)
    // primary (title) had no match → no highlight ranges on the title
    expect(r.ranges).toEqual([])
  })

  it('prefers a title match and surfaces its ranges', () => {
    const r = scoreFields('biology', [
      { text: 'Biology Map', weight: 1 },
      { text: 'cells and organs', weight: 0.55 },
    ])
    expect(r.ranges).toEqual([[0, 7]])
  })

  it('returns 0 when no field matches', () => {
    expect(scoreFields('zzz', [{ text: 'abc', weight: 1 }]).score).toBe(0)
  })
})

describe('highlightSegments', () => {
  it('splits text into matched/unmatched segments', () => {
    expect(highlightSegments('Neuro Canvas', [[6, 12]])).toEqual([
      { text: 'Neuro ', match: false },
      { text: 'Canvas', match: true },
    ])
  })

  it('returns a single unmatched segment when there are no ranges', () => {
    expect(highlightSegments('hello', [])).toEqual([{ text: 'hello', match: false }])
  })

  it('handles multiple disjoint ranges', () => {
    expect(highlightSegments('New Map', [[0, 1], [4, 5]])).toEqual([
      { text: 'N', match: true },
      { text: 'ew ', match: false },
      { text: 'M', match: true },
      { text: 'ap', match: false },
    ])
  })

  it('clamps out-of-bounds ranges and skips overlaps', () => {
    expect(highlightSegments('abc', [[0, 99]])).toEqual([{ text: 'abc', match: true }])
    expect(highlightSegments('abcdef', [[0, 3], [1, 2]])).toEqual([
      { text: 'abc', match: true },
      { text: 'def', match: false },
    ])
  })
})
