// ---------------------------------------------------------------------------
// Document RAG retention sweep (server-only).
//
// Soft-delete is the user-facing delete path: DELETE /api/documents/:id stamps
// `Document.deletedAt` and unlinks the row from search, but it deliberately
// leaves the R2 blob and the (cascade-linked) DocumentChunk rows in place so a
// delete is cheap, reversible within a grace window, and never blocks the
// request on object-store I/O. This module is the second half of that
// contract: a periodic sweep that HARD-deletes documents whose `deletedAt` is
// older than the retention window, reclaiming both the R2 object and the DB
// rows (chunks + links cascade via FK `onDelete: Cascade`).
//
// Ordering matters: we delete the R2 object FIRST (best-effort) and the DB row
// SECOND. If the R2 delete fails we still keep the row so the next sweep
// retries the blob; if we deleted the row first and the blob delete then
// failed, the key would be orphaned in R2 with no DB record pointing at it
// (an unrecoverable leak). A failed R2 delete is logged and skipped, never
// thrown — one bad object must not abort the whole batch.
//
// CONCURRENCY / MULTI-INSTANCE CAVEAT
// -----------------------------------
// The driving loop is a plain `setInterval` in a Nitro plugin (see
// server/plugins/document-retention.ts). With more than one app replica that
// interval fires on EVERY instance, so without coordination N replicas would
// each run the same sweep — duplicating R2 DeleteObject calls and racing on the
// same `prisma.document.delete` (the loser just 404s, but it is wasted work and
// noisy logs). We therefore gate each sweep behind a short-lived Redis lock
// ('doc:retention:lock') acquired with SET NX EX: exactly one replica per
// interval wins the lock and sweeps; the others observe the held lock and skip.
// The lock TTL is a safety net — it auto-expires so a replica that crashes
// mid-sweep cannot wedge the lock forever. We do NOT release the lock at the
// end of a sweep: letting it expire naturally provides a minimum spacing
// between sweeps even if the interval is short, and avoids a release race.
// This is best-effort de-duplication, not strict mutual exclusion: a sweep
// that outlives the lock TTL could overlap the next one, but the R2 delete is
// idempotent and the DB delete is guarded by a userId-scoped WHERE + try/catch,
// so an overlap is harmless (at worst a redundant no-op delete).
// ---------------------------------------------------------------------------

import { redis } from './redis'

/** Default retention window: hard-delete soft-deleted docs older than 30 days. */
export const DEFAULT_RETENTION_DAYS = 30

/** Redis key guarding the sweep so only one replica runs per interval. */
export const RETENTION_LOCK_KEY = 'doc:retention:lock'

/** Max documents reclaimed per sweep — bounds memory + R2/DB load per tick. */
export const DEFAULT_RETENTION_BATCH = 200

/** Outcome of a single sweep, returned for logging/observability + tests. */
export interface RetentionSweepResult {
  /** Rows whose deletedAt was past the window and were considered. */
  scanned: number
  /** Documents whose DB row (and R2 object) were successfully reclaimed. */
  deleted: number
  /** Documents whose R2 object delete failed (row kept for next sweep). */
  r2Failures: number
  /** Documents whose DB row delete failed (left for next sweep). */
  dbFailures: number
}

/**
 * Minimal structural slices of the deps so the sweep is unit-testable with
 * lightweight fakes (no live Prisma/R2/Redis required).
 */
export interface RetentionDeps {
  prisma: {
    document: {
      findMany: (args: unknown) => Promise<Array<{ id: string; r2Key: string }>>
      delete: (args: unknown) => Promise<unknown>
    }
  }
  /** Best-effort R2 object delete (throws on transport error). */
  deleteDocObject: (key: string) => Promise<void>
  /** Returns true iff THIS caller acquired the single-sweeper lock. */
  acquireLock: () => Promise<boolean>
  /** Wall clock — injectable so tests can pin "now". */
  now: () => Date
  /** Logger — injectable so tests can assert/silence output. */
  log?: (msg: string) => void
}

/**
 * Try to acquire the single-sweeper lock via Redis `SET key val NX EX ttl`.
 *
 * Returns true only for the one replica that wins the lock this interval.
 * Fails CLOSED (returns false) on any Redis error: if we cannot prove we hold
 * the lock we must NOT sweep, otherwise an outage could let every replica
 * sweep at once — the exact stampede the lock exists to prevent.
 */
export async function acquireRetentionLock(ttlSeconds: number): Promise<boolean> {
  try {
    // A value is required by SET; the timestamp aids debugging of a stuck lock.
    const token = `${process.pid}:${Date.now()}`
    const res = await redis.set(RETENTION_LOCK_KEY, token, 'EX', ttlSeconds, 'NX')
    return res === 'OK'
  } catch (error) {
    console.error('[document-retention] lock acquire error (skipping sweep):', error)
    return false
  }
}

/**
 * Run one retention sweep: hard-delete soft-deleted documents older than the
 * window. Pure-ish core — all I/O is injected via `deps` so it can be unit
 * tested. The plugin wires the real prisma/r2/redis deps.
 *
 * Never throws: every per-document failure is caught and counted so one bad
 * object/row cannot abort the batch, and the caller (a setInterval tick) is
 * guaranteed a resolved promise.
 */
export async function runRetentionSweep(
  deps: RetentionDeps,
  opts: { retentionDays?: number; batchSize?: number } = {},
): Promise<RetentionSweepResult> {
  const log = deps.log ?? ((m: string) => console.warn(m))
  const result: RetentionSweepResult = { scanned: 0, deleted: 0, r2Failures: 0, dbFailures: 0 }

  // Single-sweeper gate: only the lock winner proceeds (multi-instance caveat).
  const acquired = await deps.acquireLock()
  if (!acquired) return result

  const retentionDays = opts.retentionDays ?? DEFAULT_RETENTION_DAYS
  const batchSize = opts.batchSize ?? DEFAULT_RETENTION_BATCH
  const cutoff = new Date(deps.now().getTime() - retentionDays * 24 * 60 * 60 * 1000)

  let candidates: Array<{ id: string; r2Key: string }>
  try {
    candidates = await deps.prisma.document.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: { id: true, r2Key: true },
      take: batchSize,
    })
  } catch (error) {
    log(`[document-retention] findMany failed; sweep aborted: ${stringifyError(error)}`)
    return result
  }

  result.scanned = candidates.length

  for (const doc of candidates) {
    // 1) Delete the R2 object FIRST (best-effort). If it fails we keep the row
    //    so the next sweep retries the blob — never orphan the object.
    try {
      await deps.deleteDocObject(doc.r2Key)
    } catch (error) {
      result.r2Failures += 1
      log(`[document-retention] R2 delete failed for doc ${doc.id}; keeping row for retry: ${stringifyError(error)}`)
      continue
    }

    // 2) Delete the DB row SECOND — chunks + links cascade via FK. Scoped by id
    //    (ids come from our own findMany, already userId-agnostic at row level).
    try {
      await deps.prisma.document.delete({ where: { id: doc.id } })
      result.deleted += 1
    } catch (error) {
      result.dbFailures += 1
      log(`[document-retention] DB delete failed for doc ${doc.id} (R2 object already removed): ${stringifyError(error)}`)
    }
  }

  return result
}

/** Compact, non-throwing error → string for logs (never leaks a stack to clients). */
function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message
  try {
    return String(error)
  } catch {
    return 'unknown error'
  }
}
