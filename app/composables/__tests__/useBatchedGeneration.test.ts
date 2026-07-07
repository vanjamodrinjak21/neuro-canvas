import { describe, it, expect, vi } from 'vitest'

import type {
  MapStructure,
  BranchStructure,
  RichNodeSuggestion,
  GenerationContext,
  HierarchicalExpandOptions,
} from '~/types/ai-generation'
// vi.mock below is hoisted by Vitest above all imports, and its factory only
// reads `fake` / `makeSuggestion` inside methods invoked at test time — so the
// SUT can be imported here at the top (satisfies import/first) without breaking
// the mock.
import {
  useBatchedGeneration,
  countStructureNodes,
  countBranchNodes,
  collectFrontier,
  suggestionsToBranches,
  estimateNodesPerExpansion,
  mapWithConcurrency,
  trimStructureToTarget,
} from '../useBatchedGeneration'

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
  // Seed (generateMapStructure) invocations — a seeded grow must make none.
  structureCalls: 0,
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
      fake.structureCalls++
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

function resetFake() {
  fake.seedBranches = 5
  fake.seedChildrenPer = 4
  fake.failTitles = new Set()
  fake.failAll = false
  fake.expandCalls = 0
  fake.structureCalls = 0
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

// ── trimStructureToTarget ────────────────────────────────────────────────────
describe('trimStructureToTarget', () => {
  /** Compact branch builder for hand-rolled trees. */
  function b(title: string, depth: number, children: BranchStructure[] = []): BranchStructure {
    return { title, description: { summary: '', keywords: [] }, category: 'concept', depth, children }
  }

  /**
   * root                       8 nodes total:
   * ├── A                      root, A, A1, A1a, A1b, A2, B, B1
   * │   ├── A1
   * │   │   ├── A1a
   * │   │   └── A1b
   * │   └── A2
   * └── B
   *     └── B1
   */
  function makeTree(): MapStructure {
    return {
      rootTopic: 'Root',
      rootDescription: { summary: '', keywords: [] },
      branches: [
        b('A', 0, [
          b('A1', 1, [b('A1a', 2), b('A1b', 2)]),
          b('A2', 1),
        ]),
        b('B', 0, [b('B1', 1)]),
      ],
      crossConnections: [
        { sourceRef: 'A1a', targetRef: 'B1', relationshipType: 'related-to', reason: 'deep link' },
        { sourceRef: 'A', targetRef: 'B', relationshipType: 'related-to', reason: 'main link' },
      ],
    }
  }

  function allTitles(structure: MapStructure): string[] {
    const out: string[] = []
    const walk = (branch: BranchStructure) => {
      out.push(branch.title)
      for (const c of branch.children ?? []) walk(c)
    }
    for (const br of structure.branches) walk(br)
    return out.sort()
  }

  it('trims overshoot to exactly N, removing deepest leaves last-sibling-first', () => {
    const tree = makeTree()
    const result = trimStructureToTarget(tree, 6)
    expect(result).toBe(tree) // mutates + returns the same reference
    expect(countStructureNodes(result)).toBe(6)
    // The deepest layer (A1a, A1b) goes first — earlier/shallower content survives.
    expect(allTitles(result)).toEqual(['A', 'A1', 'A2', 'B', 'B1'])
  })

  it('peels layers deepest-first, then last siblings first within a layer', () => {
    const result = trimStructureToTarget(makeTree(), 4)
    expect(countStructureNodes(result)).toBe(4)
    // Depth-2 layer (A1a, A1b) removed, then depth-1 last-first (B1, then A2) —
    // the earliest depth-1 child A1 survives, and both main branches survive.
    expect(allTitles(result)).toEqual(['A', 'A1', 'B'])
  })

  it('never removes the root and spares main branches unless the target forces it', () => {
    // target 2 < 1 + branchCount → forced: descendants go, then LAST main branch.
    const forced = trimStructureToTarget(makeTree(), 2)
    expect(countStructureNodes(forced)).toBe(2)
    expect(forced.branches.map(br => br.title)).toEqual(['A'])
    expect(forced.branches[0]!.children).toHaveLength(0)

    // target 1 → root only. The root itself is never removed.
    const rootOnly = trimStructureToTarget(makeTree(), 1)
    expect(countStructureNodes(rootOnly)).toBe(1)
    expect(rootOnly.branches).toHaveLength(0)
    expect(rootOnly.rootTopic).toBe('Root')
  })

  it('drops cross-connections whose endpoints were trimmed away, keeps the rest', () => {
    const result = trimStructureToTarget(makeTree(), 6) // removes A1a + A1b
    expect(result.crossConnections).toEqual([
      { sourceRef: 'A', targetRef: 'B', relationshipType: 'related-to', reason: 'main link' },
    ])
  })

  it('is a no-op when target < 1 or the count is already at/below target', () => {
    const untouched = makeTree()
    expect(countStructureNodes(trimStructureToTarget(untouched, 0))).toBe(8)
    expect(countStructureNodes(trimStructureToTarget(untouched, -5))).toBe(8)
    expect(countStructureNodes(trimStructureToTarget(untouched, 8))).toBe(8)
    expect(countStructureNodes(trimStructureToTarget(untouched, 100))).toBe(8)
    // No-op leaves everything alone — including crossConnections.
    expect(untouched.crossConnections).toHaveLength(2)
    expect(allTitles(untouched)).toEqual(['A', 'A1', 'A1a', 'A1b', 'A2', 'B', 'B1'])
  })
})

// ── Grower ────────────────────────────────────────────────────────────────────
describe('generateLargeMap', () => {
  it('grows the tree to EXACTLY a large node-count target (AER-97)', async () => {
    resetFake()
    const { generateLargeMap } = useBatchedGeneration()
    const result = await generateLargeMap('Topic', { nodeCount: 400 })
    // Grows past the target then trims the overshoot — lands exactly on it.
    expect(countStructureNodes(result)).toBe(400)
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
    // Other leaves absorb the deficit, so the exact target is still reached.
    expect(countStructureNodes(result)).toBe(250)
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

  it('uses the single-pass seed only when the target fits one call, trimmed exact', async () => {
    resetFake()
    const { generateLargeMap } = useBatchedGeneration()
    // Seed alone (26 nodes) already covers the target → no growth passes, and
    // the 6-node overshoot is trimmed so the result is exactly 20.
    const result = await generateLargeMap('Topic', { nodeCount: 20 })
    expect(fake.expandCalls).toBe(0)
    expect(countStructureNodes(result)).toBe(20)
  })
})

// ── Grower with a caller-provided seed (AER-97 top-up path) ──────────────────
describe('generateLargeMap with seed', () => {
  /** Small seed: root + 2 branches × 2 leaf children = 7 nodes. */
  function makeSeed(): MapStructure {
    const branch = (i: number): BranchStructure => ({
      title: `S${i}`,
      description: { summary: '', keywords: [] },
      category: 'concept',
      depth: 0,
      children: [0, 1].map(c => ({
        title: `S${i}-C${c}`,
        description: { summary: '', keywords: [] },
        category: 'concept',
        depth: 1,
        children: [],
      })),
    })
    return {
      rootTopic: 'Seeded',
      rootDescription: { summary: '', keywords: [] },
      branches: [branch(0), branch(1)],
    }
  }

  it('grows a below-target seed to EXACTLY the target without re-seeding', async () => {
    resetFake()
    const seed = makeSeed()
    const { generateLargeMap } = useBatchedGeneration()
    const result = await generateLargeMap('Seeded', { nodeCount: 60 }, {}, seed)
    // The seed IS the structure being grown — no internal seeding call.
    expect(fake.structureCalls).toBe(0)
    expect(result).toBe(seed)
    // Expansion granularity overshoots past 60; the final trim lands exact.
    expect(countStructureNodes(result)).toBe(60)
  })

  it('leaves an at-or-above-target seed alone except for the exact trim', async () => {
    resetFake()
    const seed = makeSeed() // 7 nodes
    const { generateLargeMap } = useBatchedGeneration()
    const result = await generateLargeMap('Seeded', { nodeCount: 5 }, {}, seed)
    expect(fake.structureCalls).toBe(0)
    expect(fake.expandCalls).toBe(0)
    expect(countStructureNodes(result)).toBe(5)
  })

  it('returns fewer than target (without hanging) only on budget exhaustion', async () => {
    resetFake()
    fake.failAll = true // every expansion fails → frontier exhausts immediately
    const seed = makeSeed()
    const { generateLargeMap } = useBatchedGeneration()
    const result = await generateLargeMap('Seeded', { nodeCount: 500 }, {}, seed)
    // 4 seed leaves, each tried once then marked exhausted → fast termination
    // with the seed intact (the pathological "< N" case).
    expect(fake.expandCalls).toBeLessThanOrEqual(4)
    expect(countStructureNodes(result)).toBe(7)
  })
})
