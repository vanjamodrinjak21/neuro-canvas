import { describe, it, expect, vi } from 'vitest'

import type {
  MapStructure,
  BranchStructure,
  RichNodeSuggestion,
  GenerationContext,
  HierarchicalExpandOptions,
} from '~/types/ai-generation'

// ---------------------------------------------------------------------------
// useBatchedGeneration tests
//
// Two layers:
//   1. Pure tree helpers (counting, frontier, conversion, concurrency) — tested
//      directly, no mocks.
//   2. The grower (generateLargeMap) — tested against a FAKE useAI whose
//      generateMapStructure / hierarchicalExpand produce deterministic trees, so
//      we can assert convergence near the target, per-leaf failure tolerance,
//      and cooperative cancellation without any network.
// ---------------------------------------------------------------------------

// ── Fake useAI ──────────────────────────────────────────────────────────────
// Knobs the individual tests flip before invoking the grower.
const fake = {
  // Seed: root + 5 branches × 4 leaf children = 26 nodes.
  seedBranches: 5,
  seedChildrenPer: 4,
  // hierarchicalExpand throws for any title in here (per-leaf failure tolerance).
  failTitles: new Set<string>(),
  // When true, EVERY expansion throws (tests fast termination, not a spin).
  failAll: false,
  expandCalls: 0,
}

function makeSuggestion(title: string, withChildren: number): RichNodeSuggestion {
  return {
    title,
    description: { summary: `${title} summary`, keywords: [] },
    category: 'concept',
    confidence: 0.9,
    suggestedChildren:
      withChildren > 0
        ? Array.from({ length: withChildren }, (_, i) => makeSuggestion(`${title}.${i}`, 0))
        : undefined,
  }
}

vi.mock('~/composables/useAI', () => ({
  useAI: () => ({
    async generateMapStructure(topic: string): Promise<MapStructure> {
      const branches: BranchStructure[] = Array.from({ length: fake.seedBranches }, (_, b) => ({
        title: `${topic}-B${b}`,
        description: { summary: '', keywords: [] },
        category: 'concept',
        depth: 0,
        children: Array.from({ length: fake.seedChildrenPer }, (_, c) => ({
          title: `${topic}-B${b}-C${c}`,
          description: { summary: '', keywords: [] },
          category: 'concept',
          depth: 1,
          children: [],
        })),
      }))
      return { rootTopic: topic, rootDescription: { summary: '', keywords: [] }, branches }
    },
    async hierarchicalExpand(
      nodeContent: string,
      _context: GenerationContext,
      options: HierarchicalExpandOptions = {},
    ): Promise<RichNodeSuggestion[]> {
      fake.expandCalls++
      if (fake.failAll || fake.failTitles.has(nodeContent)) throw new Error('expand failed')
      const perLevel = options.maxPerLevel ?? 5
      const grandkids = (options.depth ?? 1) >= 2 ? Math.max(1, perLevel - 1) : 0
      return Array.from({ length: perLevel }, (_, i) =>
        makeSuggestion(`${nodeContent}>${i}`, grandkids),
      )
    },
  }),
}))

// Imported AFTER the mock is registered.
import {
  useBatchedGeneration,
  countStructureNodes,
  countBranchNodes,
  collectFrontier,
  suggestionsToBranches,
  estimateNodesPerExpansion,
  mapWithConcurrency,
} from '../useBatchedGeneration'

function resetFake() {
  fake.seedBranches = 5
  fake.seedChildrenPer = 4
  fake.failTitles = new Set()
  fake.failAll = false
  fake.expandCalls = 0
}

// ── Pure helpers ─────────────────────────────────────────────────────────────
describe('tree helpers', () => {
  const sample: MapStructure = {
    rootTopic: 'Root',
    rootDescription: { summary: '', keywords: [] },
    branches: [
      {
        title: 'A',
        description: { summary: '', keywords: [] },
        category: 'concept',
        depth: 0,
        children: [
          { title: 'A1', description: { summary: '', keywords: [] }, category: 'fact', depth: 1, children: [] },
        ],
      },
      { title: 'B', description: { summary: '', keywords: [] }, category: 'concept', depth: 0, children: [] },
    ],
  }

  it('counts every node including the root', () => {
    // root + A + A1 + B = 4
    expect(countStructureNodes(sample)).toBe(4)
    expect(countBranchNodes(sample.branches[0]!)).toBe(2) // A + A1
  })

  it('collects only childless branches with correct depth + ancestry', () => {
    const frontier = collectFrontier(sample)
    const titles = frontier.map((f) => f.branch.title).sort()
    expect(titles).toEqual(['A1', 'B'])
    const a1 = frontier.find((f) => f.branch.title === 'A1')!
    expect(a1.depth).toBe(1)
    expect(a1.ancestorTitles).toEqual(['Root', 'A'])
    const b = frontier.find((f) => f.branch.title === 'B')!
    expect(b.ancestorTitles).toEqual(['Root'])
  })

  it('converts nested suggestions into branches preserving depth', () => {
    const branches = suggestionsToBranches([makeSuggestion('X', 2)], 1)
    expect(branches).toHaveLength(1)
    expect(branches[0]!.depth).toBe(1)
    expect(branches[0]!.children).toHaveLength(2)
    expect(branches[0]!.children[0]!.depth).toBe(2)
  })

  it('estimates nodes per expansion by depth', () => {
    expect(estimateNodesPerExpansion(1, 5)).toBe(5)
    expect(estimateNodesPerExpansion(2, 5)).toBe(5 + 5 * 4)
  })

  it('mapWithConcurrency preserves order and bounds parallelism', async () => {
    let inFlight = 0
    let peak = 0
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight--
      return n * 10
    })
    expect(out).toEqual([10, 20, 30, 40, 50, 60])
    expect(peak).toBeLessThanOrEqual(2)
  })
})

// ── Grower ────────────────────────────────────────────────────────────────────
describe('generateLargeMap', () => {
  it('grows the tree to approach a large node-count target', async () => {
    resetFake()
    const { generateLargeMap } = useBatchedGeneration()
    const result = await generateLargeMap('Topic', { nodeCount: 400 })
    const count = countStructureNodes(result)
    // Converges near the target (within the grower's tolerance band).
    expect(count).toBeGreaterThanOrEqual(360)
    expect(count).toBeLessThanOrEqual(520)
  })

  it('reports monotonic, count-based progress', async () => {
    resetFake()
    const seen: Array<{ count: number; target: number }> = []
    const { generateLargeMap } = useBatchedGeneration()
    await generateLargeMap('Topic', { nodeCount: 300 }, {
      onProgress: (count, target) => seen.push({ count, target }),
    })
    expect(seen.length).toBeGreaterThan(1)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!.count).toBeGreaterThanOrEqual(seen[i - 1]!.count)
      expect(seen[i]!.target).toBe(300)
    }
  })

  it('tolerates individual leaf-expansion failures without aborting', async () => {
    resetFake()
    // Fail the first seed leaf's expansions — grow must continue via other leaves.
    fake.failTitles = new Set(['Topic-B0-C0', 'Topic-B1-C0'])
    const { generateLargeMap } = useBatchedGeneration()
    const result = await generateLargeMap('Topic', { nodeCount: 250 })
    expect(countStructureNodes(result)).toBeGreaterThan(100)
  })

  it('terminates fast (no MAX_PASSES spin) when every expansion fails', async () => {
    resetFake()
    fake.failAll = true
    const { generateLargeMap } = useBatchedGeneration()
    const result = await generateLargeMap('Topic', { nodeCount: 1000 })
    // Seed has 20 leaves; each is tried once, marked exhausted, then the frontier
    // empties and the loop breaks — so expand calls are bounded by the seed leaves,
    // NOT MAX_PASSES (80) × batch.
    expect(fake.expandCalls).toBeLessThanOrEqual(20)
    expect(countStructureNodes(result)).toBeLessThanOrEqual(40)
  })

  it('stops promptly when the job is cancelled mid-grow', async () => {
    resetFake()
    const signal = { aborted: false }
    let progressTicks = 0
    const { generateLargeMap } = useBatchedGeneration()
    const result = await generateLargeMap('Topic', { nodeCount: 1000 }, {
      signal,
      onProgress: () => {
        progressTicks++
        // Abort right after the seed's first progress report.
        signal.aborted = true
      },
    })
    // Only the seed (26 nodes) — growth was cancelled before any pass.
    expect(countStructureNodes(result)).toBeLessThanOrEqual(40)
    expect(progressTicks).toBeGreaterThanOrEqual(1)
  })

  it('uses the single-pass seed only when the target fits one call', async () => {
    resetFake()
    const { generateLargeMap } = useBatchedGeneration()
    // Target equals the seed size → no growth passes needed.
    await generateLargeMap('Topic', { nodeCount: 20 })
    // Seed alone (26) already exceeds 0.96*20, so no hierarchicalExpand calls.
    expect(fake.expandCalls).toBe(0)
  })
})
