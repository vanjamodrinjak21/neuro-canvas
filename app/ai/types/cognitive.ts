// Cognitive Pattern Recognition Types

export type ThinkingMode =
  | 'divergent'      // Generating many ideas, brainstorming
  | 'convergent'     // Narrowing down, evaluating, pruning
  | 'analytical'     // Breaking down, deep-diving into specifics
  | 'synthetic'      // Connecting disparate ideas, cross-linking
  | 'evaluative'     // Comparing, rating, assessing
  | 'metacognitive'  // Reflecting on the map structure itself

export interface CognitiveState {
  /** Current detected thinking mode */
  currentMode: ThinkingMode
  /** Confidence of the detection (0-1) */
  confidence: number
  /** History of recent mode changes */
  modeHistory: Array<{
    mode: ThinkingMode
    timestamp: number
    trigger: string
  }>
  /** Suggested next mode based on patterns */
  suggestedNextMode?: ThinkingMode
  /** Why the suggestion was made */
  suggestionReason?: string
}

export interface AIBehaviorConfig {
  /** Number of suggestions to generate */
  suggestionCount: number
  /** LLM temperature (0-1) */
  temperature: number
  /** How diverse should suggestions be (0-1) */
  diversityWeight: number
  /** Include thought-provoking questions */
  includeQuestions: boolean
  /** Include wildcard/surprising suggestions */
  includeWildcards: boolean
  /** Include contrarian/opposing viewpoints */
  includeContrarian: boolean
  /** How strict the response validation should be */
  validationStrictness: 'loose' | 'normal' | 'strict'
  /** Suggest deletions or merges of existing nodes */
  suggestDeletions: boolean
  /** Suggest node merges */
  suggestMerges: boolean
}

export interface UserAction {
  type: 'create-node' | 'delete-node' | 'edit-node' | 'create-edge'
    | 'delete-edge' | 'accept-suggestion' | 'reject-suggestion'
    | 'expand-node' | 'search' | 'overview' | 'undo' | 'redo'
  timestamp: number
  nodeId?: string
  metadata?: Record<string, unknown>
}
