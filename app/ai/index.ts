// NeuroCanvas AI v2 - Public API

// Types
export * from './types'

// Utils
export { resolveProvider } from './utils/resolveProvider'
export type { ResolvedProvider } from './utils/resolveProvider'
export {
  parseJsonResponse,
  validateRichNodeSuggestions,
  validateMapStructure,
  validateTypedConnections,
  validateNodeDescription
} from './utils/parseResponse'

// Engines
export { detectSubject, getOntologyGuidance, getRelationshipsForDomain, getCategoriesForDomain } from './engine/SubjectEngine'
export { buildContext, formatRichContext, recordRejection, recordAcceptance } from './engine/ContextEngine'

// Prompt Orchestration
export { assemblePrompt } from './prompts/PromptOrchestrator'
export type { PromptRequest, AssembledPrompt } from './prompts/PromptOrchestrator'
export { selectPersona } from './prompts/SystemPersonas'

// Pipeline
export { streamCompletion, tryParsePartialJSON, autoCloseJSON } from './pipeline/StreamingPipeline'
export { executeWithRetry } from './pipeline/RetryStrategy'
export { getSemanticCache, SemanticCache } from './pipeline/SemanticCache'
export { getBatchOptimizer, BatchOptimizer } from './pipeline/BatchOptimizer'

// Cognitive + Memory
export { getCognitiveEngine, CognitiveEngine } from './engine/CognitiveEngine'
export { getAIBehaviorForMode, describeBehavior } from './engine/CognitiveEngine.behavior'
export { getMemoryEngine, MemoryEngine } from './engine/MemoryEngine'

// Insight v2
export { generateInsights } from './engine/InsightEngineV2'

// Cognitive Agent
export { getCognitiveAgent, CognitiveAgent } from './engine/CognitiveAgent'
