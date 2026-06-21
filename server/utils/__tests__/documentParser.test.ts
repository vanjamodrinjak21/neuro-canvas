import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import {
  parseMarkdown,
  parsePlainText,
  parseDocument,
  parseWithTimeout,
  DocumentParseError,
  type ParsedPage,
} from '../documentParser'

/**
 * Tests for the pure document parser (AER, plan §P3 "Parser + chunker").
 *
 * Scope of THIS suite (the unit parser):
 *   - parseMarkdown / parsePlainText  — utf8 decode → single ParsedPage
 *   - parseDocument(buf, declaredMime) — magic-byte sniff + dispatch + guards
 *   - parseWithTimeout(fn, ms)         — Promise.race timeout wrapper
 *   - DOCX zip-bomb guard (declared uncompressed size, pre-inflation)
 *
 * Binary PDF/DOCX fixture parsing (parsePdf/parseDocx happy paths) require real
 * encoded files and are GATED on RUN_PARSER_TEST=1, mirroring the gating of
 * embeddings-parity.test.ts (which downloads ~111 MB on first run). The ungated
 * tests below exercise every pure dispatch + guard path with hand-built buffers,
 * so the guard logic and error taxonomy are covered without binary fixtures.
 */

const enc = new TextEncoder()

describe('parseMarkdown / parsePlainText', () => {
  it('parses markdown to a single page', () => {
    const pages = parseMarkdown(enc.encode('# Title\n\nHello **world**.'))
    expect(pages).toHaveLength(1)
    expect(pages[0]!.page).toBe(1)
    expect(pages[0]!.text).toContain('Hello')
  })

  it('parses plain text to a single page', () => {
    const pages = parsePlainText(enc.encode('just some plain text'))
    expect(pages).toHaveLength(1)
    expect(pages[0]!.page).toBe(1)
    expect(pages[0]!.text).toBe('just some plain text')
  })

  it('accepts a Buffer as well as a Uint8Array', () => {
    const pages = parsePlainText(Buffer.from('buffer input', 'utf8'))
    expect(pages[0]!.text).toBe('buffer input')
  })

  it('throws no_text on an empty buffer', () => {
    expect(() => parsePlainText(new Uint8Array(0))).toThrow(DocumentParseError)
    try {
      parsePlainText(new Uint8Array(0))
    } catch (e) {
      expect((e as DocumentParseError).code).toBe('no_text')
    }
  })

  it('throws no_text on whitespace-only text', () => {
    try {
      parseMarkdown(enc.encode('   \n\n\t  '))
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError)
      expect((e as DocumentParseError).code).toBe('no_text')
    }
  })

  it('rejects invalid UTF-8 as corrupt (fatal decode)', () => {
    // Lone continuation byte 0x80 + 0xff are invalid UTF-8.
    const bad = new Uint8Array([0x80, 0xFF, 0xFE])
    try {
      parsePlainText(bad)
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError)
      expect((e as DocumentParseError).code).toBe('corrupt')
    }
  })
})

describe('parseDocument dispatcher — magic-byte sniffing', () => {
  it('rejects when the declared mime is outside the allowlist', async () => {
    await expect(
      parseDocument(enc.encode('hello'), 'application/x-msdownload'),
    ).rejects.toBeInstanceOf(DocumentParseError)
  })

  it('rejects a binary blob whose real type is not in the allowlist (e.g. PNG)', async () => {
    // PNG signature — file-type detects image/png, not in the allowlist.
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
    try {
      await parseDocument(png, 'application/pdf')
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError)
      expect((e as DocumentParseError).code).toBe('unsupported')
    }
  })

  it('rejects when the real magic-byte type mismatches the declared mime', async () => {
    // A real PDF magic header declared as DOCX → mismatch.
    const pdfish = enc.encode('%PDF-1.7\n...')
    try {
      await parseDocument(
        pdfish,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError)
      expect((e as DocumentParseError).code).toBe('unsupported')
    }
  })

  it('parses text declared as text/markdown (no magic bytes) when content is valid utf8', async () => {
    const pages = await parseDocument(enc.encode('# Heading\n\nbody'), 'text/markdown')
    expect(pages).toHaveLength(1)
    expect(pages[0]!.text).toContain('body')
  })

  it('parses text declared as text/plain when content is valid utf8', async () => {
    const pages = await parseDocument(enc.encode('plain body here'), 'text/plain')
    expect(pages[0]!.text).toBe('plain body here')
  })

  it('rejects text/plain whose bytes are not valid utf8 as corrupt', async () => {
    const bad = new Uint8Array([0xFF, 0xFE, 0x00, 0x80])
    try {
      await parseDocument(bad, 'text/plain')
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError)
      expect((e as DocumentParseError).code).toBe('corrupt')
    }
  })

  it('throws no_text when declared-text content is empty', async () => {
    try {
      await parseDocument(new Uint8Array(0), 'text/plain')
      throw new Error('expected throw')
    } catch (e) {
      expect((e as DocumentParseError).code).toBe('no_text')
    }
  })
})

describe('parseWithTimeout', () => {
  it('resolves the inner value when the fn is fast', async () => {
    const result = await parseWithTimeout(async () => 42, 1000)
    expect(result).toBe(42)
  })

  it('rejects with timeout when the fn is too slow', async () => {
    const slow = () => new Promise<number>((resolve) => setTimeout(() => resolve(1), 50))
    try {
      await parseWithTimeout(slow, 5)
      throw new Error('expected timeout')
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError)
      expect((e as DocumentParseError).code).toBe('timeout')
    }
  })

  it('propagates the inner rejection (not a timeout) when the fn rejects fast', async () => {
    const boom = async () => {
      throw new DocumentParseError('corrupt', 'inner failure')
    }
    try {
      await parseWithTimeout(boom, 1000)
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError)
      expect((e as DocumentParseError).code).toBe('corrupt')
    }
  })
})

describe('DOCX zip-bomb guard', () => {
  /**
   * Build a minimal-but-valid ZIP (local file header + central directory +
   * EOCD) for a single entry whose declared *uncompressed* size we control.
   * The guard must reject based on the central-directory declared size BEFORE
   * any inflation, so we can lie about the uncompressed size cheaply.
   */
  function buildZip(entryName: string, uncompressedSize: number, body: Buffer): Buffer {
    const nameBuf = Buffer.from(entryName, 'utf8')
    const compressed = deflateRawSync(body)
    const crc = 0 // CRC is not validated by the size-guard walk.

    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034B50, 0) // local file header signature
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(8, 8) // method = deflate
    local.writeUInt16LE(0, 10) // mod time
    local.writeUInt16LE(0, 12) // mod date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18) // compressed size
    local.writeUInt32LE(uncompressedSize, 22) // uncompressed size (the lie)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28) // extra len
    nameBuf.copy(local, 30)

    const localOffset = 0
    const dataStart = local.length
    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(0x02014B50, 0) // central dir signature
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0, 8) // flags
    central.writeUInt16LE(8, 10) // method
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20) // compressed size
    central.writeUInt32LE(uncompressedSize, 24) // uncompressed size (the lie)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30) // extra len
    central.writeUInt16LE(0, 32) // comment len
    central.writeUInt16LE(0, 34) // disk number
    central.writeUInt16LE(0, 36) // internal attrs
    central.writeUInt32LE(0, 38) // external attrs
    central.writeUInt32LE(localOffset, 42) // offset of local header
    nameBuf.copy(central, 46)

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054B50, 0) // EOCD signature
    eocd.writeUInt16LE(0, 4) // disk
    eocd.writeUInt16LE(0, 6) // cd start disk
    eocd.writeUInt16LE(1, 8) // entries this disk
    eocd.writeUInt16LE(1, 10) // total entries
    eocd.writeUInt32LE(central.length, 12) // cd size
    eocd.writeUInt32LE(dataStart + compressed.length, 16) // cd offset
    eocd.writeUInt16LE(0, 20) // comment len

    return Buffer.concat([local, compressed, central, eocd])
  }

  it('rejects a DOCX whose declared uncompressed size exceeds the cap (oversize guard)', async () => {
    // Declare a 60 MB uncompressed entry (> 50 MB total cap) from a tiny payload.
    const bomb = buildZip('word/document.xml', 60 * 1024 * 1024, Buffer.from('<x/>'))
    try {
      await parseDocument(
        bomb,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError)
      expect((e as DocumentParseError).code).toBe('oversize')
    }
  })
})

// ---------------------------------------------------------------------------
// Binary fixture tests (GATED on RUN_PARSER_TEST=1) — real PDF/DOCX bytes.
// Mirrors the RUN_PARITY_TEST gating in embeddings-parity.test.ts.
// ---------------------------------------------------------------------------
const RUN_BINARY = process.env.RUN_PARSER_TEST === '1'
const describeBinary = RUN_BINARY ? describe : describe.skip

describeBinary('parsePdf / parseDocx (binary fixtures)', () => {
  it('parsePdf extracts text from a real PDF into pages', async () => {
    const { parsePdf } = await import('../documentParser')
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const buf = await fs.readFile(
      path.resolve(__dirname, 'fixtures/sample.pdf'),
    )
    const pages: ParsedPage[] = await parsePdf(buf)
    expect(pages.length).toBeGreaterThan(0)
    expect(pages[0]!.text.length).toBeGreaterThan(0)
  })

  it('parseDocx extracts raw text from a real DOCX into one page', async () => {
    const { parseDocx } = await import('../documentParser')
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const buf = await fs.readFile(
      path.resolve(__dirname, 'fixtures/sample.docx'),
    )
    const pages = await parseDocx(buf)
    expect(pages).toHaveLength(1)
    expect(pages[0]!.text.length).toBeGreaterThan(0)
  })

  it('encrypted PDF throws DocumentParseError("encrypted")', async () => {
    const { parsePdf } = await import('../documentParser')
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const buf = await fs.readFile(
      path.resolve(__dirname, 'fixtures/encrypted.pdf'),
    )
    try {
      await parsePdf(buf)
      throw new Error('expected throw')
    } catch (e) {
      expect((e as DocumentParseError).code).toBe('encrypted')
    }
  })
})
