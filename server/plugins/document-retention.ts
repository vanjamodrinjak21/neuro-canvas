// Periodic Document RAG retention sweep driver.
//
// Hard-deletes soft-deleted documents (Document.deletedAt past the retention
// window) by reclaiming the R2 object then the DB row (chunks + links cascade).
// The actual sweep logic lives in server/utils/documentRetention.ts and is
// unit-tested in isolation; this plugin is only the scheduler + dependency
// wiring + defensive logging.
//
// SCHEDULING MODEL (and its caveat): we use a plain in-process `setInterval`.
// This is the right tool for the in-process ingestion MVP (no BullMQ / external
// scheduler yet), but it has one sharp edge in a multi-replica deploy: the
// interval fires on EVERY app instance, so without coordination N replicas
// would each run the same sweep — duplicating R2 DeleteObject calls and racing
// the same prisma.document.delete. We guard against that with a short-lived
// Redis lock ('doc:retention:lock', SET NX EX): exactly one replica wins the
// lock per interval and sweeps; the rest observe the held lock and skip. This
// is best-effort de-duplication (the lock auto-expires so a crashed sweeper
// can't wedge it), not strict mutual exclusion — and that's fine because the R2
// delete is idempotent and the DB delete is id-scoped + try/caught, so an
// occasional overlap is a harmless no-op. See documentRetention.ts for the full
// rationale.
//
// Gated on `documentsEnabled`: with the feature off there is nothing to sweep.
// Like the config-check plugins, this NEVER throws out of the interval — a
// failed sweep must not take down the Nitro process or stop future sweeps.

import {
  acquireRetentionLock,
  runRetentionSweep,
  DEFAULT_RETENTION_DAYS,
} from '../utils/documentRetention'
import { prisma } from '../utils/prisma'
import { deleteDocObject } from '../utils/r2'

// How often the sweep fires. The retention window (30d) is far larger than the
// interval, so an hourly cadence reclaims storage promptly without hammering
// R2/DB; the Redis lock TTL is sized just under this so a fresh replica can win
// the next interval rather than being blocked by a stale lock.
const SWEEP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const LOCK_TTL_SECONDS = Math.floor((SWEEP_INTERVAL_MS / 1000) * 0.9) // ~54 min

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()

  // Feature-gated: no documents feature → no soft-deleted docs to reclaim.
  if (!config.documentsEnabled) return

  // Defensive wrapper: a single tick must never throw (an unhandled rejection
  // from a timer can crash the worker) and must always reschedule via interval.
  const tick = async (): Promise<void> => {
    try {
      const result = await runRetentionSweep(
        {
          prisma: prisma as never,
          deleteDocObject,
          acquireLock: () => acquireRetentionLock(LOCK_TTL_SECONDS),
          now: () => new Date(),
        },
        { retentionDays: DEFAULT_RETENTION_DAYS },
      )

      // Only log when the sweep actually did (or tried to do) something — a
      // skipped sweep (lock not won) or an empty sweep stays quiet to avoid
      // hourly log spam across replicas.
      if (result.scanned > 0) {
        console.info(
          `[document-retention] sweep: scanned=${result.scanned} ` +
            `deleted=${result.deleted} r2Failures=${result.r2Failures} ` +
            `dbFailures=${result.dbFailures}`,
        )
      }
    } catch (error) {
      // runRetentionSweep is already non-throwing; this is belt-and-suspenders
      // so an unexpected fault in wiring can never escape the timer.
      console.error('[document-retention] sweep tick failed (will retry next interval):', error)
    }
  }

  // Fire on an interval. We intentionally do NOT run immediately at boot:
  // letting the first tick wait one interval avoids every replica racing the
  // lock during a rolling deploy when several instances start near-together.
  const timer = setInterval(() => {
    void tick()
  }, SWEEP_INTERVAL_MS)

  // Don't keep the event loop alive solely for this timer (lets the process
  // exit cleanly on shutdown). `unref` exists on Node timers but not in the DOM
  // Timeout type Nitro infers, so guard the call.
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    ;(timer as { unref: () => void }).unref()
  }
})
