// Dependency-free, boundary-aware recursive text splitter for the Document RAG
// ingestion pipeline. See docs/architecture/document-rag-implementation-plan.md
// §P3 ("Parser + chunker (pure, no I/O)") and §0.1(h).
//
// The splitter walks a single text left-to-right emitting fixed-budget windows.
// Each window is cut at the best available *semantic* boundary at or before the
// target budget — paragraph ("\n\n"), then line ("\n"), then sentence
// terminator (". "/"."/"!"/"?"), then word (whitespace) — falling back to a hard
// mid-character cut only when no boundary exists inside the budget (e.g. a single
// unbroken token longer than the target). Consecutive windows share ~`overlap`
// of trailing content so retrieval context is not severed at a boundary; the
// overlap is carried *inside* the budget (it is the tail of one chunk reused as
// the head of the next), so every emitted chunk still respects the token cap.
//
// Token counting is the plan's deterministic heuristic — `ceil(len / 4)`
// (~4 chars/token for English) — chosen over a real tokenizer so chunk
// boundaries are reproducible across machines and CI. CJK text undercounts under
// this rule; that is a documented limitation handled upstream by the `maxChunks`
// cap, not by this pure splitter.
//
// Pure function: no DB, no Redis, no network, no shared state, no dependencies.

/** Approximate-token divisor: ~4 characters per token for English. */
const CHARS_PER_TOKEN = 4

/** Default target chunk size, in approximate tokens (~2048 chars). */
const DEFAULT_TARGET_TOKENS = 512

/** Default overlap between consecutive chunks, in approximate tokens (~256 chars). */
const DEFAULT_OVERLAP_TOKENS = 64

/** Default hard ceiling on emitted chunks (matches the plan's ingestion cap). */
const DEFAULT_MAX_CHUNKS = 2000

/**
 * Chunks below this many approximate tokens are dropped as noise — *except* a
 * document's sole chunk, which is always retained so tiny documents still index.
 */
const MIN_CHUNK_TOKENS = 20

/** Configuration for {@link chunkText}. All fields are optional. */
export interface ChunkOptions {
  /** Target chunk size in approximate tokens. Default 512 (~2048 chars). */
  targetTokens?: number
  /** Overlap between consecutive chunks in approximate tokens. Default 64 (~256 chars). */
  overlapTokens?: number
  /** Hard ceiling on the number of chunks emitted (tail is truncated). Default 2000. */
  maxChunks?: number
}

/** A single emitted chunk. */
export interface TextChunk {
  /** Sequential, zero-based index within the document. */
  chunkIndex: number
  /** The chunk's text, including any overlap carried from the previous chunk. */
  text: string
  /** `Math.ceil(text.length / 4)` — the deterministic approximate token count. */
  approxTokens: number
}

/** Deterministic approximate token count for a string (~4 chars/token). */
function approxTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Boundary delimiters in descending preference order. Each entry is a regex that
 * matches a boundary *and any trailing whitespace that belongs with it*, so the
 * cut lands cleanly after the delimiter and the next window does not begin with
 * orphaned whitespace. Ordered paragraph → line → sentence → word.
 */
const BOUNDARY_PATTERNS: readonly RegExp[] = [
  /\n[ \t]*\n\s*/g, // paragraph break (blank line)
  /\n\s*/g, // line break
  /[.!?]["')\]]?(?:\s+|$)/g, // sentence terminator (+ optional closing quote/bracket)
  /\s+/g, // any whitespace (word boundary)
]

/**
 * Find the offset (relative to `slice`) at which to cut, preferring the latest
 * boundary of the highest-priority kind that ends at or before `limit`. Returns
 * the index of the first character *after* the boundary (i.e. the start of the
 * next window). Returns `null` when no boundary exists within `limit`, signalling
 * the caller to hard-cut.
 *
 * @param slice The remaining text being chunked.
 * @param limit Maximum cut offset (the per-chunk character budget).
 */
function findCut(slice: string, limit: number): number | null {
  for (const pattern of BOUNDARY_PATTERNS) {
    pattern.lastIndex = 0
    let best = -1
    let match: RegExpExecArray | null
    while ((match = pattern.exec(slice)) !== null) {
      const end = match.index + match[0].length
      // Guard against zero-width matches looping forever.
      if (match[0].length === 0) {
        pattern.lastIndex += 1
        continue
      }
      if (end <= limit) {
        // Require the boundary to consume real content, not sit at offset 0.
        if (match.index > 0) best = end
      } else {
        break
      }
    }
    if (best > 0) return best
  }
  return null
}

/**
 * Advance an overlap start offset forward to the nearest clean word boundary so
 * the next chunk never begins mid-word (the "broken-word smell"). Only nudges
 * forward by a small bounded amount, keeping the bulk of the overlap window
 * intact. If the candidate already sits at a word start, it is returned as-is.
 *
 * @param text       The full text.
 * @param candidate  The proposed overlap start offset.
 * @param hardEnd    The chunk end offset (overlap must remain strictly before it).
 */
function snapOverlapStart(text: string, candidate: number, hardEnd: number): number {
  if (candidate <= 0) return 0
  // Already at a word start (previous char is whitespace)? Keep it.
  if (/\s/.test(text[candidate - 1] ?? '')) return candidate
  // Scan forward for the next whitespace, then skip the whitespace run.
  let i = candidate
  const maxScan = Math.min(hardEnd, candidate + CHARS_PER_TOKEN * 8)
  while (i < maxScan && !/\s/.test(text[i] ?? '')) i++
  while (i < maxScan && /\s/.test(text[i] ?? '')) i++
  return i < hardEnd ? i : candidate
}

/**
 * Recursive, boundary-aware text splitter.
 *
 * Splits `input` into a sequence of overlapping chunks, each at or under the
 * target token budget, preferring semantic boundaries (paragraph → line →
 * sentence → word) and hard-cutting only when no boundary fits the budget.
 * Chunk indices are sequential and zero-based. A degenerate (empty or
 * whitespace-only) input yields `[]`.
 *
 * @param input   The raw document text.
 * @param options Optional target/overlap/cap configuration.
 * @returns Ordered chunks; never more than `maxChunks`.
 */
export function chunkText(input: string, options: ChunkOptions = {}): TextChunk[] {
  const targetTokens = options.targetTokens ?? DEFAULT_TARGET_TOKENS
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS
  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS

  if (targetTokens <= 0 || maxChunks <= 0) return []
  if (input.trim().length === 0) return []

  const targetChars = targetTokens * CHARS_PER_TOKEN
  // Overlap can never meet or exceed the budget, or the window would not advance.
  const overlapChars = Math.min(
    Math.max(overlapTokens, 0) * CHARS_PER_TOKEN,
    Math.max(targetChars - CHARS_PER_TOKEN, 0),
  )

  const text = input
  const len = text.length
  const rawChunks: string[] = []

  let cursor = 0
  // Hard ceiling on iterations as a belt-and-suspenders guard against any
  // pathological non-advancing input; the explicit advance check below is the
  // primary safeguard.
  let guard = 0
  const guardMax = len * 2 + 16

  while (cursor < len && guard++ < guardMax) {
    const remaining = text.slice(cursor)
    if (remaining.trim().length === 0) break

    let end: number // absolute offset (exclusive) where this chunk ends
    if (remaining.length <= targetChars) {
      end = len
    } else {
      const cut = findCut(remaining, targetChars)
      // No boundary within budget → hard mid-character cut at the budget.
      end = cursor + (cut ?? targetChars)
    }

    const chunk = text.slice(cursor, end)
    if (chunk.trim().length > 0) rawChunks.push(chunk)

    if (end >= len) break

    // Step the cursor forward, carrying `overlapChars` of trailing context into
    // the next chunk. Snap the overlap start to a word boundary so the next
    // chunk never opens mid-word. Always advance by at least one character.
    let nextCursor = overlapChars > 0 ? end - overlapChars : end
    if (overlapChars > 0) nextCursor = snapOverlapStart(text, nextCursor, end)
    if (nextCursor <= cursor) nextCursor = end
    cursor = nextCursor
  }

  // Drop sub-floor noise chunks, but never eliminate the document's only chunk.
  const kept =
    rawChunks.length <= 1
      ? rawChunks
      : rawChunks.filter((c) => approxTokens(c.trim()) >= MIN_CHUNK_TOKENS)
  const effective = kept.length > 0 ? kept : rawChunks.slice(0, 1)

  return effective.slice(0, maxChunks).map((chunkTextValue, chunkIndex) => ({
    chunkIndex,
    text: chunkTextValue,
    approxTokens: approxTokens(chunkTextValue),
  }))
}
