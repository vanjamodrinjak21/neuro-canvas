// ---------------------------------------------------------------------------
// Batched background map generation — grow a map to a large node-count target.
//
// A single LLM pass can produce a coherent map of ~100 nodes; beyond that the
// model loses the thread and JSON gets unwieldy (and hits token limits). So a
// request for 300 / 1000 / 10000 nodes can't be one call. This grower:
//
//   1) SEEDS a skeleton with a single (streamed) generateMapStructure call,
//      capped at SINGLE_PASS_CAP so that first pass stays coherent.
//   2) GROWS the tree in passes: each pass takes the shallowest frontier leaves
//      (breadth-first, so the map stays balanced) and expands each into a small
//      sub-tree via hierarchicalExpand, grafting the result back onto the leaf.
//   3) Repeats until the node count reaches the target — or a hard call budget /
//      pass / depth ceiling is hit (so a 10k request can't run away forever).
//   4) TRIMS any overshoot back to EXACTLY the target (AER-97): expansion
//      granularity means the last pass can land past N, and an explicit
//      nodeCount is a contract — root + branches + descendants must total N.
//
// All LLM work goes through useAI (provider resolution, retry, cache, RAG). The
// grower itself is pure orchestration: the tree helpers below are exported and
// unit-tested in isolation with a fake AI.
//
// COOPERATIVE CANCEL: a `signal.aborted` flag is checked between/within passes
// so dismissing a running 10k job stops it promptly instead of burning hundreds
// more API calls.
// ---------------------------------------------------------------------------

import type {
  MapStructure,
  BranchStructure,
  RichNodeSuggestion,
  MapGenerationOptions,
  GenerationContext,
} from '~/types/ai-generation'
import { useAI } from '~/composables/useAI'

// ── Tuning constants ───────────────────────────────────────────────────────
/**
 * Above this node-count target, a single LLM pass can't stay coherent, so the
 * map must be grown in batches. Callers use this to decide between the single
 * streamed pass and `generateLargeMap` below.
 */
export const BATCH_THRESHOLD = 120
/** Largest node count we ask a single seed pass to produce. */
const SINGLE_PASS_CAP = 110
/** Parallel expansion calls in flight per pass (rate-limit friendly). */
const CONCURRENCY = 4
/** Hard ceiling on passes — backstop against a non-converging loop. */
const MAX_PASSES = 80
/** Hard ceiling on total expansion calls — bounds cost/time for huge targets. */
const MAX_EXPANSION_CALLS = 1400
/** Don't expand leaves deeper than this — keeps the tree from going needle-thin. */
const MAX_LEAF_DEPTH = 10
/** Most leaves expanded in a single pass. */
const MAX_LEAVES_PER_PASS = 24

// ── Pure tree helpers (exported for tests) ─────────────────────────────────

/** Count every node a branch represents: itself + all descendants. */
export function countBranchNodes(branch: BranchStructure): number {
  const children = branch.children ?? []
  let n = 1
  for (const c of children) n += countBranchNodes(c)
  return n
}

/** Total nodes in a structure: root + all branches and their descendants. */
export function countStructureNodes(structure: MapStructure): number {
  let n = 1 // root
  for (const b of structure.branches) n += countBranchNodes(b)
  return n
}

/** A leaf (childless) branch plus the path of titles from the root down to it. */
export interface FrontierLeaf {
  branch: BranchStructure
  /** 0 = direct child of root. */
  depth: number
  /** [rootTopic, …, parentTitle] — used for de-dup context on expansion. */
  ancestorTitles: string[]
}

/**
 * Collect every childless branch (the growth frontier). Depth is taken from the
 * branch's own `depth` when present, else derived from the ancestor path.
 */
export function collectFrontier(structure: MapStructure): FrontierLeaf[] {
  const out: FrontierLeaf[] = []
  const walk = (branch: BranchStructure, ancestors: string[]) => {
    const children = branch.children ?? []
    if (children.length === 0) {
      const depth = typeof branch.depth === 'number' ? branch.depth : ancestors.length - 1
      out.push({ branch, depth, ancestorTitles: ancestors })
    } else {
      const nextAncestors = [...ancestors, branch.title]
      for (const c of children) walk(c, nextAncestors)
    }
  }
  for (const b of structure.branches) walk(b, [structure.rootTopic])
  return out
}

/** Convert expansion suggestions (with nested suggestedChildren) into branches. */
export function suggestionsToBranches(
  suggestions: RichNodeSuggestion[],
  depth: number,
): BranchStructure[] {
  return suggestions.map((s) => ({
    title: s.title,
    description: s.description,
    category: s.category,
    depth,
    children: s.suggestedChildren?.length
      ? suggestionsToBranches(s.suggestedChildren, depth + 1)
      : [],
  }))
}

/**
 * Deterministically trim an overgrown structure down to EXACTLY `target` nodes
 * (`countStructureNodes` semantics: root + all branches + all descendants).
 *
 * Leaves are removed deepest-first, and among equal depth the LAST siblings
 * first, so the map stays balanced and the earliest / most-important content
 * survives. The root is never removed, and main branches are only removed when
 * the target forces it (target < 1 + branch count). Cross-connections whose
 * endpoints no longer resolve to a surviving node title are dropped.
 *
 * Mutates `structure` in place and returns the same reference. No-op when
 * `target < 1` or the structure is already at/below the target.
 */
export function trimStructureToTarget(structure: MapStructure, target: number): MapStructure {
  if (target < 1) return structure
  let excess = countStructureNodes(structure) - target
  if (excess <= 0) return structure

  /** A removable leaf: the sibling array it lives in + its index + its depth. */
  interface TrimLeaf {
    siblings: BranchStructure[]
    index: number
    depth: number
  }

  // Collect non-main-branch leaves in document (pre-order) order. Depth is the
  // actual traversal depth (0 = main branch) — deterministic even if a
  // branch's own `depth` field is stale.
  const collectTrimmableLeaves = (): TrimLeaf[] => {
    const out: TrimLeaf[] = []
    const walk = (siblings: BranchStructure[], depth: number) => {
      siblings.forEach((branch, index) => {
        const children = branch.children ?? []
        if (children.length === 0) {
          // Main branches (depth 0) are protected here; phase 2 handles them.
          if (depth > 0) out.push({ siblings, index, depth })
        } else {
          walk(children, depth + 1)
        }
      })
    }
    walk(structure.branches, 0)
    return out
  }

  // Phase 1: peel leaves layer by layer, deepest first. Within a layer, remove
  // in REVERSE document order (last siblings first). Removing a depth-d leaf
  // can only expose its parent at depth d-1 as a new leaf — never another
  // depth-d leaf — so a whole layer can be removed per sweep, re-collecting
  // between sweeps. Reverse order also keeps earlier splice indices valid.
  while (excess > 0) {
    const leaves = collectTrimmableLeaves()
    if (leaves.length === 0) break // only the root + childless main branches remain
    let maxDepth = 0
    for (const l of leaves) maxDepth = Math.max(maxDepth, l.depth)
    const layer = leaves.filter(l => l.depth === maxDepth)
    for (let i = layer.length - 1; i >= 0 && excess > 0; i--) {
      const leaf = layer[i]!
      leaf.siblings.splice(leaf.index, 1)
      excess--
    }
  }

  // Phase 2 (only when the target forces it, target < 1 + branch count): every
  // remaining node is the root or a childless main branch — drop main branches
  // from the END until the count fits. The root itself is never removed.
  while (excess > 0 && structure.branches.length > 0) {
    structure.branches.pop()
    excess--
  }

  // Drop cross-connections that now dangle: their refs are node titles, and a
  // trimmed title must not leave a phantom edge behind.
  if (structure.crossConnections?.length) {
    const surviving = new Set<string>([structure.rootTopic])
    const collectTitles = (branch: BranchStructure) => {
      surviving.add(branch.title)
      for (const c of branch.children ?? []) collectTitles(c)
    }
    for (const b of structure.branches) collectTitles(b)
    structure.crossConnections = structure.crossConnections.filter(
      cc => surviving.has(cc.sourceRef) && surviving.has(cc.targetRef),
    )
  }

  return structure
}

/** Roughly how many nodes one hierarchicalExpand(depth, perLevel) call yields. */
export function estimateNodesPerExpansion(depth: number, perLevel: number): number {
  // depth 1 → perLevel branches; depth 2 → perLevel branches each with ~perLevel-1 kids.
  return depth >= 2 ? perLevel + perLevel * Math.max(1, perLevel - 1) : perLevel
}

/** Run an async fn over items with a bounded number in flight; preserves order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const worker = async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i]!, i)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)
  return results
}

// ── Grower ─────────────────────────────────────────────────────────────────

export interface GrowSignal {
  aborted: boolean
}

export interface GrowCallbacks {
  /** Reports (currentNodeCount, target) after the seed and after each pass. */
  onProgress?: (count: number, target: number) => void
  /** Cooperative cancel — checked between and within passes. */
  signal?: GrowSignal
}

export function useBatchedGeneration() {
  const ai = useAI()

  /** Lightweight expansion context: ancestor titles ground + de-dup the call. */
  function buildLeafContext(
    structure: MapStructure,
    leaf: FrontierLeaf,
    options: MapGenerationOptions,
  ): GenerationContext {
    const existingNodes = leaf.ancestorTitles
      .slice(-8)
      .map((title, i) => ({ id: `ctx-${i}`, content: title }))
    return {
      mapTitle: structure.rootTopic,
      existingNodes,
      existingEdges: [],
      depth: 'medium',
      style: options.style ?? 'detailed',
      tone: options.tone,
      domain: options.domain,
      locale: options.locale,
      // NOTE: document RAG is applied on the SEED pass only. Re-fetching the
      // guard-wrapped knowledge block on every one of potentially hundreds of
      // leaf expansions would be slow and costly; the seed already grounds the
      // skeleton in the attached docs.
    }
  }

  /**
   * Generate a map whose node count lands EXACTLY on `options.nodeCount`,
   * growing the tree across multiple LLM passes and trimming any overshoot
   * (AER-97). Returns the fully-grown MapStructure (not yet materialized — the
   * caller renders it).
   *
   * When `seed` is provided the internal seeding call is skipped and the given
   * structure is grown in place — this is how callers top up a single-pass
   * result that came back short, without duplicating orchestration.
   *
   * The only case that may return FEWER than the target is pathological budget
   * exhaustion (MAX_PASSES / MAX_EXPANSION_CALLS / MAX_LEAF_DEPTH / abort): the
   * grower then returns what exists rather than hanging or spinning.
   */
  async function generateLargeMap(
    topic: string,
    options: MapGenerationOptions,
    cb: GrowCallbacks = {},
    seed?: MapStructure,
  ): Promise<MapStructure> {
    const target = Math.max(1, Math.floor(options.nodeCount ?? 0))

    // 1) Seed skeleton (streamed) — unless the caller supplied one. Cap the
    //    ask so the first pass stays coherent.
    const seedTarget = Math.min(target, SINGLE_PASS_CAP)
    const structure = seed ?? await ai.generateMapStructure(
      topic,
      { ...options, nodeCount: seedTarget },
      { stream: true },
    )
    cb.onProgress?.(countStructureNodes(structure), target)

    // 2) Grow by expanding frontier leaves until the target (or a budget) is hit.
    let calls = 0
    let passes = 0
    // Leaves whose expansion returned nothing or threw — excluded from future
    // frontiers so a chronically-failing leaf can't be re-picked every pass
    // (breadth-first would otherwise keep choosing it) and spin to MAX_PASSES.
    const exhausted = new Set<BranchStructure>()

    while (
      countStructureNodes(structure) < target &&
      passes < MAX_PASSES &&
      calls < MAX_EXPANSION_CALLS &&
      !cb.signal?.aborted
    ) {
      passes++
      const current = countStructureNodes(structure)
      const deficit = target - current

      const frontier = collectFrontier(structure).filter(
        (l) => l.depth < MAX_LEAF_DEPTH && !exhausted.has(l.branch),
      )
      if (frontier.length === 0) break // nothing left to grow (or all exhausted)

      // Breadth-first: shallowest leaves first keeps the map balanced.
      frontier.sort((a, b) => a.depth - b.depth)

      // Far from target → grow each leaf into a small sub-tree (depth 2); close
      // to target → shallow, fine-grained additions (depth 1) to avoid overshoot.
      const wide = deficit > 200
      const expandDepth = wide ? 2 : 1
      const perLevel = wide
        ? 5
        : Math.min(5, Math.max(2, Math.ceil(deficit / Math.min(frontier.length, 8))))
      const nodesPerLeaf = estimateNodesPerExpansion(expandDepth, perLevel)

      const wantLeaves = Math.max(1, Math.ceil(deficit / nodesPerLeaf))
      const budgetLeft = MAX_EXPANSION_CALLS - calls
      const batchSize = Math.min(
        frontier.length,
        wantLeaves,
        MAX_LEAVES_PER_PASS,
        budgetLeft,
      )
      const batch = frontier.slice(0, batchSize)

      await mapWithConcurrency(batch, CONCURRENCY, async (leaf) => {
        // Hard guards (belt-and-suspenders): batchSize already caps this pass by
        // remaining budget, and a cancelled job skips the rest of the batch.
        if (cb.signal?.aborted || calls >= MAX_EXPANSION_CALLS) return
        calls++
        try {
          const context = buildLeafContext(structure, leaf, options)
          const suggestions = await ai.hierarchicalExpand(leaf.branch.title, context, {
            depth: expandDepth,
            maxPerLevel: perLevel,
            style: options.style,
            tone: options.tone,
          })
          // Job cancelled while this call was in flight → drop the result rather
          // than graft onto a structure nobody will open.
          if (cb.signal?.aborted) return
          if (suggestions.length > 0) {
            const childDepth = (typeof leaf.branch.depth === 'number' ? leaf.branch.depth : leaf.depth) + 1
            leaf.branch.children = suggestionsToBranches(suggestions, childDepth)
          } else {
            // Empty expansion → don't keep re-trying this leaf forever.
            exhausted.add(leaf.branch)
          }
        } catch {
          // A single leaf failing must never abort the whole grow. Mark it
          // exhausted so the next pass doesn't immediately re-pick it.
          exhausted.add(leaf.branch)
        }
      })

      cb.onProgress?.(countStructureNodes(structure), target)
    }

    // 3) Exactness (AER-97): expansion granularity means the last pass usually
    //    overshoots — trim deterministically back to the target. If a budget
    //    backstop (or cancel) stopped the grow below the target, this is a
    //    no-op and the caller gets what exists (the one acceptable "< N" case).
    return trimStructureToTarget(structure, target)
  }

  return { generateLargeMap }
}
