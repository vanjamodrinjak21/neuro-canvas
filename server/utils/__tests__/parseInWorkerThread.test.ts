import { describe, it, expect } from 'vitest'
import {
  parseInWorkerThread,
  DocumentParseError,
} from '../documentParser'

/**
 * Tests for parseInWorkerThread (AER, plan §0(g) — true parse isolation).
 *
 * These run a REAL Node worker_thread (no mocks): the worker entry
 * documentParser.worker.ts is spawned, fed a tiny buffer, and we assert the
 * structured-clone round-trip returns typed pages / typed errors.
 *
 * Node ≥22.18 strips TypeScript types natively, so the `.ts` worker entry runs
 * directly under tsx/vitest. The happy path uses a tiny text/markdown buffer so
 * it's fast and has no binary-fixture dependency. A heavier real-PDF/DOCX case
 * (if added later) should be gated on RUN_PARSER_TEST=1, mirroring
 * embeddings-parity.test.ts.
 */

const enc = new TextEncoder()

describe('parseInWorkerThread (real worker_thread)', () => {
  it('parses a tiny markdown buffer to pages in an isolated worker', async () => {
    const buf = enc.encode('# Heading\n\nHello from the worker thread.')
    const pages = await parseInWorkerThread(buf, 'text/markdown')

    expect(Array.isArray(pages)).toBe(true)
    expect(pages).toHaveLength(1)
    expect(pages[0]!.page).toBe(1)
    expect(pages[0]!.text).toContain('Hello from the worker thread')
  }, 20_000)

  it('parses a tiny plain-text buffer to pages in an isolated worker', async () => {
    const buf = enc.encode('just some plain text in a worker')
    const pages = await parseInWorkerThread(buf, 'text/plain')

    expect(pages).toHaveLength(1)
    expect(pages[0]!.text).toBe('just some plain text in a worker')
  }, 20_000)

  it('accepts a Node Buffer as input across the thread boundary', async () => {
    const pages = await parseInWorkerThread(
      Buffer.from('buffer bytes into the worker', 'utf8'),
      'text/plain',
    )
    expect(pages[0]!.text).toBe('buffer bytes into the worker')
  }, 20_000)

  it('surfaces a typed parse error from the worker (no_text on empty buffer)', async () => {
    // An empty text buffer makes parseDocument throw DocumentParseError('no_text')
    // inside the worker; the typed code must survive the boundary.
    await expect(
      parseInWorkerThread(new Uint8Array(0), 'text/plain'),
    ).rejects.toMatchObject({ code: 'no_text' })
  }, 20_000)

  it('rejects with a typed timeout error when the budget is tiny', async () => {
    // A 1 ms budget is shorter than even a trivial worker spawn + parse, so the
    // setTimeout+worker.terminate() path fires and we get a typed 'timeout'.
    const buf = enc.encode('# Title\n\nsome content to parse')
    let caught: unknown
    try {
      await parseInWorkerThread(buf, 'text/markdown', 1)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(DocumentParseError)
    expect((caught as DocumentParseError).code).toBe('timeout')
  }, 20_000)
})
