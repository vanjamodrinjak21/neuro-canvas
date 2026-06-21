// Boot-time recovery sweep for crashed Document ingestion.
//
// Ingestion runs as an in-process MVP (no BullMQ / external worker), so a
// process crash or redeploy mid-ingest leaves a Document pinned in
// 'PROCESSING' forever: no worker is alive to finish it or mark it failed,
// and the per-user ingest reserve it held is effectively leaked. The UI then
// shows a permanent "processing…" spinner with no way out.
//
// On startup we reconcile that: any Document still 'PROCESSING' whose
// updatedAt is older than the staleness threshold cannot belong to a live
// worker (a real worker bumps updatedAt as it progresses), so we flip it to
// 'FAILED' with a sanitized errorMessage. The user can then retry, and the
// stuck count is surfaced in the logs.
//
// Globally resetting orphaned per-user ingest reserve counters cannot be done
// safely here — a counter may legitimately reflect an in-flight ingest on
// another instance, and we have no per-user attribution of the leak — so we
// deliberately do NOT touch Redis reserve counters; we only log the count of
// recovered documents. Per-user reserves self-heal on the user's next
// ingest attempt (releaseIngest path), or via the retention sweep.
//
// Defensive by construction: gated on the documentsEnabled flag, wrapped in
// try/catch, never throws, and only logs on error. A failed recovery sweep
// must never crash boot.

import { prisma } from '../utils/prisma'

// A Document untouched for longer than this while still 'PROCESSING' is
// assumed abandoned by a crashed worker. Generous enough not to race a slow
// but live ingest; short enough that a stuck doc clears on the next deploy.
const STALE_PROCESSING_MS = 15 * 60 * 1000 // 15 minutes

export default defineNitroPlugin(async () => {
  // Skip entirely during build/prerender — there is no live DB to reconcile
  // and we must not run schema-touching work at build time. This also keeps
  // the sweep to a single run per server boot.
  if (import.meta.prerender) return

  const config = useRuntimeConfig()
  // Feature-gated: if documents are disabled there is no ingestion to recover.
  if (!config.documentsEnabled) return

  try {
    const cutoff = new Date(Date.now() - STALE_PROCESSING_MS)

    const { count } = await prisma.document.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: cutoff },
        deletedAt: null,
      },
      data: {
        status: 'FAILED',
        errorMessage: 'recovery: stale processing',
      },
    })

    if (count > 0) {
      console.warn(
        `[document-recovery] Reset ${count} stale PROCESSING document(s) to FAILED ` +
          `(no worker touched them in >${STALE_PROCESSING_MS / 60000}min — likely a crashed ingest). ` +
          `Per-user ingest reserves are not reset here; they self-heal on next ingest or via the retention sweep.`,
      )
    }
  } catch (err) {
    // Never crash boot over a best-effort recovery sweep.
    console.warn(
      '[document-recovery] Stale-processing recovery sweep failed (non-fatal):',
      err instanceof Error ? err.message : err,
    )
  }
})
