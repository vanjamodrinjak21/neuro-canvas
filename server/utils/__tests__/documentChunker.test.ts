import { describe, it, expect } from 'vitest'
import { chunkText } from '../documentChunker'

/**
 * Tests for the dependency-free recursive text splitter (AER-51, plan P3).
 *
 * Token-estimation contract (deterministic, no tokenizer dependency):
 *   approxTokens = Math.ceil(text.length / 4)
 * This mirrors the plan's `tokenCount = ceil(len/4)` heuristic — ~4 chars/token
 * is the standard rough English estimate. It is intentionally deterministic so
 * chunk boundaries are reproducible across machines and CI. (CJK text under-
 * counts under this rule; that is a documented limitation handled upstream by
 * the 2000-chunk cap / `truncated` flag, not by this pure splitter.)
 *
 * Defaults under test:
 *   targetTokens = 512  (~2048 chars)
 *   overlapTokens = 64  (~256 chars)
 * The splitter prefers semantic boundaries (paragraph "\n\n", then line "\n",
 * then sentence/space) over hard mid-word cuts.
 */

// ~4 chars per token, matching the implementation's documented estimate.
const CHARS_PER_TOKEN = 4

/** Build a single hard-to-split paragraph of roughly `tokens` worth of chars (no break opportunities). */
function longUnbrokenWord(tokens: number): string {
  return 'a'.repeat(tokens * CHARS_PER_TOKEN)
}

/** Build text of roughly `tokens` worth of sentences, separated by ". " so sentence boundaries exist. */
function sentences(tokens: number): string {
  const sentence = 'lorem ipsum dolor sit amet consectetur.' // 39 chars incl. trailing period
  const target = tokens * CHARS_PER_TOKEN
  let out = ''
  while (out.length < target) {
    out += (out ? ' ' : '') + sentence
  }
  return out
}

describe('chunkText', () => {
  describe('degenerate inputs', () => {
    it('returns [] for an empty string', () => {
      expect(chunkText('')).toEqual([])
    })

    it('returns [] for a whitespace-only string', () => {
      expect(chunkText('   \n\t  \r\n  ')).toEqual([])
    })
  })

  describe('short text (fits in one chunk)', () => {
    it('returns a single chunk at chunkIndex 0', () => {
      const text = 'This is a short document that easily fits in a single chunk.'
      const chunks = chunkText(text)

      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.chunkIndex).toBe(0)
      expect(chunks[0]!.text).toContain('short document')
    })

    it('reports approxTokens as ceil(chars / 4) for the single chunk', () => {
      const text = 'abcdefgh' // 8 chars -> ceil(8/4) = 2 tokens
      const chunks = chunkText(text)

      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.approxTokens).toBe(Math.ceil(chunks[0]!.text.length / CHARS_PER_TOKEN))
      expect(chunks[0]!.approxTokens).toBe(2)
    })

    it('does NOT drop a sole short chunk even though it is under the small-chunk floor', () => {
      // The <20-token drop rule must never eliminate the only chunk of a document.
      const text = 'tiny note' // ~3 tokens, well under any floor
      const chunks = chunkText(text)

      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.text.trim()).toBe('tiny note')
    })
  })

  describe('long text (multiple chunks)', () => {
    it('splits into multiple chunks with sequential, zero-based chunkIndex', () => {
      const text = sentences(2000) // far exceeds the 512-token target
      const chunks = chunkText(text)

      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach((chunk, i) => {
        expect(chunk.chunkIndex).toBe(i)
      })
    })

    it('keeps each chunk at or under the target token budget', () => {
      const target = 512
      const chunks = chunkText(sentences(3000), { targetTokens: target, overlapTokens: 64 })

      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        expect(chunk.approxTokens).toBeLessThanOrEqual(target)
        expect(chunk.approxTokens).toBe(Math.ceil(chunk.text.length / CHARS_PER_TOKEN))
      }
    })

    it('respects custom targetTokens producing more, smaller chunks', () => {
      const body = sentences(3000)
      const big = chunkText(body, { targetTokens: 512, overlapTokens: 32 })
      const small = chunkText(body, { targetTokens: 128, overlapTokens: 32 })

      expect(small.length).toBeGreaterThan(big.length)
      for (const chunk of small) {
        expect(chunk.approxTokens).toBeLessThanOrEqual(128)
      }
    })
  })

  describe('overlap between consecutive chunks', () => {
    it('shares roughly the configured overlap of content between consecutive chunks', () => {
      const overlapTokens = 64
      const overlapChars = overlapTokens * CHARS_PER_TOKEN
      const chunks = chunkText(sentences(3000), { targetTokens: 512, overlapTokens })

      expect(chunks.length).toBeGreaterThan(2)

      for (let i = 0; i < chunks.length - 1; i++) {
        const prevTail = chunks[i]!.text.slice(-overlapChars).trim()
        const next = chunks[i + 1]!.text
        // A meaningful, non-trivial slice of the previous chunk's tail must reappear
        // at the start region of the next chunk (overlap window, allowing for
        // boundary snapping so it is "~overlap", not exact).
        const probe = prevTail.slice(Math.floor(prevTail.length / 2))
        expect(probe.length).toBeGreaterThan(0)
        expect(next.slice(0, overlapChars * 2)).toContain(probe.slice(0, 16))
      }
    })

    it('produces no overlap when overlapTokens is 0', () => {
      const chunks = chunkText(sentences(2000), { targetTokens: 256, overlapTokens: 0 })
      expect(chunks.length).toBeGreaterThan(1)

      const a = chunks[0]!.text
      const b = chunks[1]!.text
      // With zero overlap the chunks are disjoint windows: the tail of A should
      // not be duplicated at the head of B.
      const tail = a.slice(-32).trim().slice(0, 12)
      expect(b.startsWith(tail)).toBe(false)
    })
  })

  describe('maxChunks cap', () => {
    it('never emits more than maxChunks chunks', () => {
      const chunks = chunkText(sentences(6000), { targetTokens: 128, overlapTokens: 16, maxChunks: 5 })
      expect(chunks.length).toBeLessThanOrEqual(5)
      expect(chunks.length).toBe(5)
    })

    it('keeps chunkIndex sequential and zero-based up to the cap (truncates the tail)', () => {
      const chunks = chunkText(sentences(6000), { targetTokens: 128, overlapTokens: 16, maxChunks: 3 })
      expect(chunks).toHaveLength(3)
      expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2])
    })

    it('does not truncate when the natural chunk count is below the cap', () => {
      const chunks = chunkText(sentences(1500), { targetTokens: 512, overlapTokens: 64, maxChunks: 2000 })
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.length).toBeLessThan(2000)
    })
  })

  describe('boundary preference', () => {
    it('prefers splitting on a paragraph boundary over cutting mid-word', () => {
      // Two paragraphs, each ~400 tokens; with a 512-token target the split
      // should fall on the blank-line boundary, leaving whole paragraphs intact.
      const paraA = sentences(400)
      const paraB = sentences(400)
      const chunks = chunkText(`${paraA}\n\n${paraB}`, { targetTokens: 512, overlapTokens: 0 })

      expect(chunks.length).toBeGreaterThan(1)
      // The first chunk should end at a clean paragraph/sentence terminator,
      // not in the middle of a word.
      const firstEnd = chunks[0]!.text.trimEnd()
      expect(firstEnd.endsWith('.')).toBe(true)
      // No chunk should begin with a fragment of a broken word (leading lowercase
      // glued to the previous word is the mid-word-cut smell).
      for (const chunk of chunks) {
        expect(chunk.text.trimStart()).not.toMatch(/^[a-z]{1,3}\s/)
      }
    })

    it('prefers sentence boundaries over arbitrary character cuts within a paragraph', () => {
      const chunks = chunkText(sentences(1200), { targetTokens: 300, overlapTokens: 0 })
      expect(chunks.length).toBeGreaterThan(1)

      // Every non-final chunk should terminate on a sentence boundary ('.')
      // rather than slicing through a word, given that sentence delimiters exist.
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i]!.text.trimEnd().endsWith('.')).toBe(true)
      }
    })

    it('falls back to a hard mid-word cut only when no boundary exists within the target', () => {
      // A single unbroken "word" longer than the target leaves no whitespace/
      // sentence boundary, so the splitter must hard-cut to respect the budget.
      const target = 100
      const chunks = chunkText(longUnbrokenWord(target * 3), { targetTokens: target, overlapTokens: 0 })

      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        expect(chunk.approxTokens).toBeLessThanOrEqual(target)
      }
    })
  })
})
