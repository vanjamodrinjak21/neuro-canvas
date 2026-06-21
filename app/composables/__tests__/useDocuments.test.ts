import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
//
// useDocuments is server-authoritative client logic with a thin offline mirror.
// Two collaborators are stubbed for fully deterministic tests:
//   1. $fetch       — Nuxt's global fetch (list GET + DELETE), dispatched by URL+method
//   2. useDatabase  — mocked so no real Dexie/IndexedDB is touched; the docCache
//                     table is an in-memory fake exposing the subset the composable uses
// ---------------------------------------------------------------------------

// In-memory docCache fake — only the operations useDocuments calls.
interface FakeRow { id: string; userId: string; updatedAt: number; [k: string]: unknown }
let cacheRows: FakeRow[] = []
let currentUserId: string | null = 'user_1'

const fakeDocCache = {
  where(field: string) {
    return {
      equals(value: unknown) {
        const match = (r: FakeRow) => (r as Record<string, unknown>)[field] === value
        return {
          delete: async () => { cacheRows = cacheRows.filter(r => !match(r)) },
          reverse: () => ({
            sortBy: async (key: string) =>
              cacheRows
                .filter(match)
                .sort((a, b) => (b[key] as number) - (a[key] as number)),
          }),
        }
      },
    }
  },
  bulkPut: async (rows: FakeRow[]) => {
    for (const row of rows) {
      const idx = cacheRows.findIndex(r => r.id === row.id)
      if (idx >= 0) cacheRows[idx] = row
      else cacheRows.push(row)
    }
  },
  bulkDelete: async (ids: string[]) => {
    const drop = new Set(ids)
    cacheRows = cacheRows.filter(r => !drop.has(r.id))
  },
}

const fakeDB = {
  docCache: fakeDocCache,
  transaction: async (_mode: string, _table: unknown, fn: () => Promise<void>) => { await fn() },
}

vi.mock('../useDatabase', () => ({
  useDatabase: () => ({
    getCurrentUserId: () => currentUserId,
    rawDB: async () => fakeDB,
  }),
}))

import { useDocuments, type DocumentSummary } from '../useDocuments'

let fetchMock: ReturnType<typeof vi.fn>

function makeDoc(over: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: 'doc_1',
    filename: 'notes.pdf',
    title: 'Notes',
    mimeType: 'application/pdf',
    byteSize: 4096,
    status: 'READY',
    source: 'UPLOAD',
    pageCount: 3,
    chunkCount: 7,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
    ...over,
  }
}

beforeEach(() => {
  cacheRows = []
  currentUserId = 'user_1'
  fetchMock = vi.fn()
  vi.stubGlobal('$fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useDocuments', () => {
  describe('getDocuments', () => {
    it('fetches from /api/documents, populates the reactive list, and toggles loading', async () => {
      const docs = [makeDoc({ id: 'doc_a' }), makeDoc({ id: 'doc_b' })]
      fetchMock.mockResolvedValueOnce({ documents: docs })

      const dm = useDocuments()
      expect(dm.loading.value).toBe(false)

      const result = await dm.getDocuments()

      expect(fetchMock).toHaveBeenCalledWith('/api/documents')
      expect(result.map(d => d.id)).toEqual(['doc_a', 'doc_b'])
      expect(dm.documents.value.map(d => d.id)).toEqual(['doc_a', 'doc_b'])
      expect(dm.loading.value).toBe(false)
      expect(dm.error.value).toBeNull()
    })

    it('writes fetched documents through to the offline cache (scoped to user)', async () => {
      fetchMock.mockResolvedValueOnce({ documents: [makeDoc({ id: 'doc_a' })] })

      const dm = useDocuments()
      await dm.getDocuments()

      expect(cacheRows).toHaveLength(1)
      expect(cacheRows[0]).toMatchObject({ id: 'doc_a', userId: 'user_1' })
      // ISO timestamp is normalized to epoch ms for the cache.
      expect(typeof cacheRows[0]!.updatedAt).toBe('number')
      expect(cacheRows[0]!.updatedAt).toBe(Date.parse('2026-06-02T00:00:00.000Z'))
    })

    it('falls back to the offline cache when the server fetch fails', async () => {
      // Seed the cache from a first successful fetch.
      fetchMock.mockResolvedValueOnce({ documents: [makeDoc({ id: 'doc_a' })] })
      const dm = useDocuments()
      await dm.getDocuments()
      expect(cacheRows).toHaveLength(1)

      // Now the network is down — fetch rejects, cache backs the list.
      fetchMock.mockRejectedValueOnce(new Error('offline'))
      const result = await dm.getDocuments()

      expect(result.map(d => d.id)).toEqual(['doc_a'])
      expect(dm.documents.value.map(d => d.id)).toEqual(['doc_a'])
      expect(dm.error.value).toBeInstanceOf(Error)
      expect(dm.loading.value).toBe(false)
    })

    it('refresh() re-runs getDocuments', async () => {
      fetchMock.mockResolvedValue({ documents: [makeDoc({ id: 'doc_a' })] })
      const dm = useDocuments()
      await dm.refresh()
      expect(fetchMock).toHaveBeenCalledWith('/api/documents')
      expect(dm.documents.value.map(d => d.id)).toEqual(['doc_a'])
    })
  })

  describe('deleteDocuments', () => {
    it('sends DELETE with the ids body, prunes the list and cache, returns the count', async () => {
      // List + cache primed with two docs.
      fetchMock.mockResolvedValueOnce({ documents: [makeDoc({ id: 'doc_a' }), makeDoc({ id: 'doc_b' })] })
      const dm = useDocuments()
      await dm.getDocuments()
      expect(cacheRows.map(r => r.id).sort()).toEqual(['doc_a', 'doc_b'])

      fetchMock.mockResolvedValueOnce({ deleted: 1 })
      const count = await dm.deleteDocuments(['doc_a'])

      expect(fetchMock).toHaveBeenCalledWith('/api/documents', {
        method: 'DELETE',
        body: { ids: ['doc_a'] },
      })
      expect(count).toBe(1)
      expect(dm.documents.value.map(d => d.id)).toEqual(['doc_b'])
      expect(cacheRows.map(r => r.id)).toEqual(['doc_b'])
    })

    it('no-ops on an empty id list (no fetch)', async () => {
      const dm = useDocuments()
      const count = await dm.deleteDocuments([])
      expect(count).toBe(0)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('throws on server failure (online-only — cache must not mask it)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('500'))
      const dm = useDocuments()
      await expect(dm.deleteDocuments(['doc_a'])).rejects.toThrow('500')
    })
  })

  describe('getDocument', () => {
    it('fetches a single document by id', async () => {
      fetchMock.mockResolvedValueOnce(makeDoc({ id: 'doc_x' }))
      const dm = useDocuments()
      const doc = await dm.getDocument('doc_x')
      expect(fetchMock).toHaveBeenCalledWith('/api/documents/doc_x')
      expect(doc?.id).toBe('doc_x')
    })

    it('returns null and records the error on failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('404'))
      const dm = useDocuments()
      const doc = await dm.getDocument('missing')
      expect(doc).toBeNull()
      expect(dm.error.value).toBeInstanceOf(Error)
    })
  })
})
