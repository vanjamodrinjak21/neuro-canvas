// ---------------------------------------------------------------------------
// Fuzzy ranking for the global command palette (Cmd+K).
//
// `normalizedSimilarity` (fuzzyMatch.ts) is whole-string Levenshtein, which
// badly under-scores a short query against a long title ("neuro" vs a 40-char
// map title) and offers no highlight ranges — so it feels broken for typeahead.
// This module adds an fzf-style tiered scorer:
//   exact > prefix > word-boundary substring > substring > subsequence > typo
// and returns the matched character ranges so the palette can highlight them.
// Pure + dependency-light so it stays fast on every keystroke and unit-testable.
// ---------------------------------------------------------------------------

export interface MatchResult {
  /** 0 = no match; higher is better. Tiers keep ordering stable across types. */
  score: number
  /** [start, endExclusive) character ranges in the ORIGINAL text to highlight. */
  ranges: Array<[number, number]>
}

const NO_MATCH: MatchResult = { score: 0, ranges: [] }

// Characters that begin a new "word" — used to reward matches that land on a
// word boundary (a Raycast/fzf hallmark: "nm" should hit "New Map" strongly).
const WORD_BOUNDARY = /[\s\-_/.,:;|()[\]{}]/

function isWordStart(text: string, i: number): boolean {
  return i === 0 || WORD_BOUNDARY.test(text[i - 1]!)
}

/** Merge a sorted list of single indices into contiguous [start, end) ranges. */
function indicesToRanges(indices: number[]): Array<[number, number]> {
  if (indices.length === 0) return []
  const ranges: Array<[number, number]> = []
  let start = indices[0]!
  let prev = indices[0]!
  for (let k = 1; k < indices.length; k++) {
    const i = indices[k]!
    if (i === prev + 1) {
      prev = i
    } else {
      ranges.push([start, prev + 1])
      start = i
      prev = i
    }
  }
  ranges.push([start, prev + 1])
  return ranges
}

/**
 * Optimal String Alignment distance — Levenshtein plus adjacent transpositions
 * as a single edit, so the most common typo ("neuor" → "neuro") costs 1, not 2.
 */
function osaDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i]![0] = i
  for (let j = 0; j <= n; j++) d[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1)
      }
    }
  }
  return d[m]![n]!
}

/** Transposition-aware similarity in [0,1] for the typo-tolerance tier. */
function typoSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - osaDistance(a, b) / maxLen
}

/** Greedy in-order subsequence match; returns the matched positions or null. */
function subsequencePositions(q: string, t: string): number[] | null {
  const positions: number[] = []
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti
        ti++
        break
      }
      ti++
    }
    if (found === -1) return null
    positions.push(found)
  }
  return positions
}

/**
 * Score how well `query` matches `text`. Case-insensitive. Empty query → 0
 * (the palette shows "recent" instead of ranking on an empty query).
 */
export function fuzzyScore(query: string, text: string): MatchResult {
  const q = query.trim().toLowerCase()
  if (!q) return NO_MATCH
  if (!text) return NO_MATCH

  const t = text.toLowerCase()

  // Tier 1 — exact.
  if (t === q) return { score: 1, ranges: [[0, text.length]] }

  // Tiers 2-4 — contiguous substring (prefix / word-boundary / anywhere).
  const idx = t.indexOf(q)
  if (idx !== -1) {
    const lengthBonus = 0.1 * (q.length / t.length) // prefer tighter haystacks
    let base: number
    if (idx === 0) base = 0.9
    else if (isWordStart(t, idx)) base = 0.75
    else base = 0.6
    return { score: base + lengthBonus, ranges: [[idx, idx + q.length]] }
  }

  // Tier 5 — subsequence (fzf-style "nm" → "New Map").
  const positions = subsequencePositions(q, t)
  if (positions) {
    const span = positions[positions.length - 1]! - positions[0]! + 1
    const compactness = q.length / span // 1 = contiguous, →0 = scattered
    let wordStarts = 0
    for (const p of positions) if (isWordStart(t, p)) wordStarts++
    const wordBonus = wordStarts / q.length
    const score = 0.3 + 0.2 * compactness + 0.12 * wordBonus
    return { score, ranges: indicesToRanges(positions) }
  }

  // Tier 6 — typo tolerance per token (catches "neuor" → "neuro" via a
  // transposition-aware distance). No precise highlight ranges (the match is
  // approximate), so the row just won't underline.
  let bestTokenSim = 0
  for (const token of t.split(WORD_BOUNDARY)) {
    if (!token) continue
    const sim = typoSimilarity(q, token)
    if (sim > bestTokenSim) bestTokenSim = sim
  }
  if (bestTokenSim >= 0.72) {
    return { score: 0.25 * bestTokenSim, ranges: [] }
  }

  return NO_MATCH
}

/**
 * Score an item across several weighted fields (e.g. a map's title at weight 1
 * and its node text at 0.55). Returns the best weighted score plus the ranges
 * of the PRIMARY field (index 0) so the palette highlights the title only.
 */
export function scoreFields(
  query: string,
  fields: Array<{ text: string; weight: number }>,
): MatchResult {
  let bestScore = 0
  let primary: MatchResult = NO_MATCH
  fields.forEach((field, i) => {
    const r = fuzzyScore(query, field.text)
    const weighted = r.score * field.weight
    if (weighted > bestScore) bestScore = weighted
    if (i === 0) primary = r
  })
  if (bestScore <= 0) return NO_MATCH
  return { score: bestScore, ranges: primary.ranges }
}

export interface HighlightSegment {
  text: string
  match: boolean
}

/**
 * Split `text` into matched / unmatched segments for rendering highlights.
 * Ranges are clamped + merged defensively so the component can render `<mark>`
 * spans without bounds checks.
 */
export function highlightSegments(text: string, ranges: Array<[number, number]>): HighlightSegment[] {
  if (!ranges.length) return text ? [{ text, match: false }] : []
  const sorted = [...ranges]
    .map(([s, e]) => [Math.max(0, s), Math.min(text.length, e)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])

  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const [s, e] of sorted) {
    if (s < cursor) continue // skip overlaps
    if (s > cursor) segments.push({ text: text.slice(cursor, s), match: false })
    segments.push({ text: text.slice(s, e), match: true })
    cursor = e
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false })
  return segments
}
