import { ref, readonly } from 'vue'
import { useDatabase, type DBDocument } from './useDatabase'

// ---------------------------------------------------------------------------
// useDocuments — server-authoritative document listing (Document RAG, plan §8)
// ---------------------------------------------------------------------------
//
// The server is the single source of truth: ingestion and semantic search are
// online-only. This composable wraps the read/delete surface of the documents
// REST API and keeps a LIGHT offline mirror (Dexie `docCache`) of just enough
// fields to render the list view while offline. The cache is never authoritative
// and is rebuilt on every successful online fetch.
//
//   getDocuments()        GET    /api/documents             → DocumentSummary[]
//   getDocument(id)       GET    /api/documents/{id}        → DocumentSummary
//   deleteDocuments(ids)  DELETE /api/documents {ids:[...]}  → soft-delete
//
// getDocuments writes-through to docCache on success and, when the network is
// unavailable, falls back to the cached list (scoped to the current user). The
// single-document and delete paths are online-only — a stale cache must never
// mask a server failure on those.
// ---------------------------------------------------------------------------

export interface DocumentSummary {
  id: string
  filename: string
  title: string | null
  mimeType: string
  byteSize: number
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED'
  source: 'UPLOAD' | 'URL' | 'PASTE'
  pageCount: number | null
  chunkCount: number
  createdAt: string | number
  updatedAt: string | number
}

interface DocumentListResponse {
  documents: DocumentSummary[]
}

interface DeleteResponse {
  deleted: number
}

/** Normalize a server timestamp (ISO string or epoch ms) to epoch ms for the cache. */
function toEpoch(value: string | number): number {
  if (typeof value === 'number') return value
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

/** Project a server summary into the light offline cache row for `userId`. */
function toCacheRow(doc: DocumentSummary, userId: string): DBDocument {
  return {
    id: doc.id,
    userId,
    filename: doc.filename,
    title: doc.title,
    mimeType: doc.mimeType,
    byteSize: doc.byteSize,
    status: doc.status,
    source: doc.source,
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    createdAt: toEpoch(doc.createdAt),
    updatedAt: toEpoch(doc.updatedAt),
  }
}

/** Project a cached row back into the public summary shape (offline fallback). */
function fromCacheRow(row: DBDocument): DocumentSummary {
  return {
    id: row.id,
    filename: row.filename,
    title: row.title,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    status: row.status,
    source: row.source,
    pageCount: row.pageCount,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function useDocuments() {
  const db = useDatabase()

  const documents = ref<DocumentSummary[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  /**
   * Fetch the caller's documents from the server (authoritative) and write them
   * through to the offline cache. On a network failure, fall back to the cached
   * list so the view still renders offline. Returns the resolved list.
   */
  async function getDocuments(): Promise<DocumentSummary[]> {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<DocumentListResponse>('/api/documents')
      const list = res.documents ?? []
      documents.value = list

      // Write-through to the offline cache, scoped to the current user. Best-effort:
      // a cache write must never fail the online read.
      const userId = db.getCurrentUserId()
      if (userId) {
        await refreshCache(list, userId).catch(() => {})
      }
      return list
    } catch (e) {
      error.value = e as Error
      // Offline fallback: serve the last known cached list for this user.
      const cached = await loadFromCache().catch(() => [] as DocumentSummary[])
      documents.value = cached
      return cached
    } finally {
      loading.value = false
    }
  }

  /** Fetch a single document by id (online-only — never served from cache). */
  async function getDocument(id: string): Promise<DocumentSummary | null> {
    try {
      return await $fetch<DocumentSummary>(`/api/documents/${id}`)
    } catch (e) {
      error.value = e as Error
      return null
    }
  }

  /**
   * Soft-delete one or more documents server-side, then drop them from the
   * reactive list and the offline cache. Online-only; throws on server failure
   * so the caller can surface it (a stale cache must not mask a failed delete).
   */
  async function deleteDocuments(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const res = await $fetch<DeleteResponse>('/api/documents', {
      method: 'DELETE',
      body: { ids },
    })

    const removed = new Set(ids)
    documents.value = documents.value.filter(d => !removed.has(d.id))

    // Prune the offline cache to match.
    await pruneCache(ids).catch(() => {})

    return res?.deleted ?? ids.length
  }

  /** Re-fetch from the server, refreshing the reactive list. */
  async function refresh(): Promise<void> {
    await getDocuments()
  }

  // ─── Offline cache helpers ──────────────────────────────────────────────

  async function refreshCache(list: DocumentSummary[], userId: string): Promise<void> {
    const database = await db.rawDB()
    const rows = list.map(doc => toCacheRow(doc, userId))
    await database.transaction('rw', database.docCache, async () => {
      // Replace this user's cached set wholesale so deletions reflect too.
      await database.docCache.where('userId').equals(userId).delete()
      if (rows.length > 0) {
        await database.docCache.bulkPut(rows)
      }
    })
  }

  async function loadFromCache(): Promise<DocumentSummary[]> {
    const userId = db.getCurrentUserId()
    if (!userId) return []
    const database = await db.rawDB()
    const rows = await database.docCache
      .where('userId').equals(userId)
      .reverse().sortBy('updatedAt')
    return rows.map(fromCacheRow)
  }

  async function pruneCache(ids: string[]): Promise<void> {
    const database = await db.rawDB()
    await database.docCache.bulkDelete(ids)
  }

  return {
    documents: readonly(documents),
    loading: readonly(loading),
    error: readonly(error),
    getDocuments,
    getDocument,
    deleteDocuments,
    refresh,
  }
}
