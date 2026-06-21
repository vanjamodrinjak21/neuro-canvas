// Dynamic, per-model output-token budgets ("dynamic tokenization").
//
// Why this exists: map/expand prompts ask the model for a large nested JSON
// document. A flat 4000-token cap truncated that JSON mid-document, so the
// parser salvaged only the first handful of branches — the "4 node map" bug.
// Instead of one hard-coded number we size the budget to the model: newer /
// larger models get a bigger budget, small on-device models stay conservative.
//
// Non-streaming requests are additionally clamped to NON_STREAMING_CEILING so a
// very large completion can't blow past the HTTP request timeout (the SDK /
// $fetch aborts long non-streamed responses).

export type AITask =
  | 'map' // full map structure — the biggest JSON document
  | 'expand' // hierarchical / enhanced expand — a sub-tree of nodes
  | 'suggest' // flat list of short suggestion strings
  | 'connections' // typed connection suggestions
  | 'describe' // a single node description
  | 'chat' // free-form completion

// Beyond this, a non-streamed response risks hitting the request timeout.
const NON_STREAMING_CEILING = 16_000

/**
 * The largest output the provider/model will comfortably produce. These are
 * intentionally generous — the real per-request budget is derived from the task
 * weight + transport below, this is just the ceiling per model family.
 */
function modelCeiling(provider: string, modelId?: string): number {
  const id = (modelId || '').toLowerCase()
  switch (provider) {
    case 'anthropic':
      if (id.includes('opus')) return 64_000
      if (id.includes('haiku')) return 32_000
      return 48_000 // sonnet + unknown anthropic models
    case 'openai':
    case 'openrouter':
    case 'custom':
      // Small / cheap variants get a smaller ceiling than frontier models.
      if (/mini|nano|haiku|flash|small|tiny|1b|3b|7b|8b/.test(id)) return 16_000
      return 32_000
    case 'ollama':
    case 'local':
      return 4_000 // small on-device models choke on very long JSON
    default:
      return 16_000
  }
}

// Fraction of the model ceiling a task is allowed to use.
const TASK_WEIGHT: Record<AITask, number> = {
  map: 1,
  expand: 0.45,
  suggest: 0.15,
  connections: 0.18,
  describe: 0.05,
  chat: 0.4,
}

// Minimum budget so even a small model never starves a task.
const TASK_FLOOR: Record<AITask, number> = {
  map: 6_000,
  expand: 3_000,
  suggest: 800,
  connections: 1_500,
  describe: 600,
  chat: 1_200,
}

/**
 * Resolve a sane `max_tokens` value for a given provider/model/task.
 *
 * @example getMaxOutputTokens('anthropic', 'claude-sonnet-4-6', 'map')      // 16000 (non-streaming)
 * @example getMaxOutputTokens('anthropic', 'claude-sonnet-4-6', 'map', { streaming: true }) // 48000
 * @example getMaxOutputTokens('ollama',   undefined,            'map')      // 4000
 */
export function getMaxOutputTokens(
  provider: string,
  modelId: string | undefined,
  task: AITask,
  opts: { streaming?: boolean; nativeShell?: boolean } = {}
): number {
  const ceiling = modelCeiling(provider, modelId)
  let transportCap = opts.streaming ? ceiling : Math.min(ceiling, NON_STREAMING_CEILING)
  // Mobile / desktop shells route directly to the provider; keep memory in check.
  if (opts.nativeShell) transportCap = Math.min(transportCap, 8_000)

  const want = Math.max(TASK_FLOOR[task], Math.round(ceiling * TASK_WEIGHT[task]))
  return Math.min(transportCap, want)
}
