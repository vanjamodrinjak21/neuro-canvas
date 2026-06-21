import { describe, it, expect, vi } from 'vitest'
import {
  runRetentionSweep,
  DEFAULT_RETENTION_DAYS,
  type RetentionDeps,
} from '../documentRetention'

const FIXED_NOW = new Date('2026-06-21T00:00:00.000Z')

function makeDeps(
  candidates: Array<{ id: string; r2Key: string }>,
  overrides: Partial<RetentionDeps> = {},
): { deps: RetentionDeps; findMany: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn>; r2: ReturnType<typeof vi.fn> } {
  const findMany = vi.fn(async () => candidates)
  const del = vi.fn(async () => ({}))
  const r2 = vi.fn(async () => undefined)
  const deps: RetentionDeps = {
    prisma: { document: { findMany, delete: del } },
    deleteDocObject: r2,
    acquireLock: vi.fn(async () => true),
    now: () => FIXED_NOW,
    log: () => {},
    ...overrides,
  }
  return { deps, findMany, del, r2 }
}

describe('runRetentionSweep', () => {
  it('skips entirely when the lock is not acquired', async () => {
    const { deps, findMany } = makeDeps([{ id: 'd1', r2Key: 'docs/u/d1/f' }], {
      acquireLock: vi.fn(async () => false),
    })
    const res = await runRetentionSweep(deps)
    expect(findMany).not.toHaveBeenCalled()
    expect(res).toEqual({ scanned: 0, deleted: 0, r2Failures: 0, dbFailures: 0 })
  })

  it('deletes R2 object first, then the DB row, for each candidate', async () => {
    const { deps, r2, del } = makeDeps([
      { id: 'd1', r2Key: 'docs/u/d1/a.pdf' },
      { id: 'd2', r2Key: 'docs/u/d2/b.pdf' },
    ])
    const res = await runRetentionSweep(deps)
    expect(res).toEqual({ scanned: 2, deleted: 2, r2Failures: 0, dbFailures: 0 })
    expect(r2).toHaveBeenCalledWith('docs/u/d1/a.pdf')
    expect(r2).toHaveBeenCalledWith('docs/u/d2/b.pdf')
    expect(del).toHaveBeenCalledWith({ where: { id: 'd1' } })
    expect(del).toHaveBeenCalledWith({ where: { id: 'd2' } })
  })

  it('queries with a deletedAt cutoff at now minus the retention window', async () => {
    const { deps, findMany } = makeDeps([])
    await runRetentionSweep(deps, { retentionDays: DEFAULT_RETENTION_DAYS })
    const arg = findMany.mock.calls[0]![0] as { where: { deletedAt: { not: null; lt: Date } } }
    const expectedCutoff = new Date(
      FIXED_NOW.getTime() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    )
    expect(arg.where.deletedAt.lt.getTime()).toBe(expectedCutoff.getTime())
    expect(arg.where.deletedAt.not).toBeNull()
  })

  it('keeps the DB row (skips delete) when the R2 object delete fails', async () => {
    const r2 = vi.fn(async () => {
      throw new Error('R2 down')
    })
    const { deps, del } = makeDeps([{ id: 'd1', r2Key: 'docs/u/d1/a.pdf' }], {
      deleteDocObject: r2,
    })
    const res = await runRetentionSweep(deps)
    expect(res).toEqual({ scanned: 1, deleted: 0, r2Failures: 1, dbFailures: 0 })
    expect(del).not.toHaveBeenCalled()
  })

  it('counts a DB delete failure without aborting the rest of the batch', async () => {
    const del = vi
      .fn()
      .mockRejectedValueOnce(new Error('row gone'))
      .mockResolvedValueOnce({})
    const { deps } = makeDeps(
      [
        { id: 'd1', r2Key: 'docs/u/d1/a.pdf' },
        { id: 'd2', r2Key: 'docs/u/d2/b.pdf' },
      ],
      { prisma: { document: { findMany: vi.fn(async () => [
        { id: 'd1', r2Key: 'docs/u/d1/a.pdf' },
        { id: 'd2', r2Key: 'docs/u/d2/b.pdf' },
      ]), delete: del } } },
    )
    const res = await runRetentionSweep(deps)
    expect(res).toEqual({ scanned: 2, deleted: 1, r2Failures: 0, dbFailures: 1 })
  })

  it('never throws and aborts gracefully when findMany throws', async () => {
    const { deps } = makeDeps([], {
      prisma: {
        document: {
          findMany: vi.fn(async () => {
            throw new Error('db unreachable')
          }),
          delete: vi.fn(),
        },
      },
    })
    const res = await runRetentionSweep(deps)
    expect(res).toEqual({ scanned: 0, deleted: 0, r2Failures: 0, dbFailures: 0 })
  })
})
