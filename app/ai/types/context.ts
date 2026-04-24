// Rich Context Types for AI Operations

import type { SubjectProfile } from './subject'
import type { CognitiveState } from './cognitive'

export interface UserIntent {
  /** What the user is trying to do */
  action: 'expand' | 'connect' | 'generate' | 'describe' | 'restructure' | 'explore'
  /** Target node ID if applicable */
  targetNodeId?: string
  /** Inferred depth of exploration */
  depth: 'shallow' | 'medium' | 'deep'
  /** Whether user wants breadth or depth */
  direction: 'breadth' | 'depth' | 'both'
}

export interface UserHistory {
  /** Recently rejected suggestions (to avoid repeating) */
  rejectedSuggestions: string[]
  /** Recently accepted suggestion titles */
  acceptedSuggestions: string[]
  /** Preferred categories based on acceptance rate */
  preferredCategories: string[]
  /** Average title length the user prefers */
  avgTitleLength?: number
  /** Terminology level preference */
  terminologyLevel: 'simple' | 'moderate' | 'technical' | 'expert'
}

export interface ContextSnapshot {
  /** Full graph serialized as indented tree */
  graphTopology: string
  /** Local neighborhood of target node (depth 3) */
  localNeighborhood: string
  /** Semantic cluster summaries */
  clusterSummary: string
  /** Cross-connections description */
  crossConnections: string
}

export interface RichContext {
  /** Subject profile for domain-awareness */
  subject: SubjectProfile
  /** Serialized graph context */
  snapshot: ContextSnapshot
  /** User intent for this operation */
  intent: UserIntent
  /** User history and preferences */
  userHistory: UserHistory
  /** Current cognitive state */
  cognitiveState?: CognitiveState
  /** Total node count in the map */
  totalNodes: number
  /** Total edge count in the map */
  totalEdges: number
  /** Map title */
  mapTitle?: string
  /** Locale code for language instruction (e.g. 'hr', 'de', 'fr', 'es') */
  locale?: string
}

export interface ContextParams {
  /** Target node ID for context building */
  targetNodeId?: string
  /** Nodes map from the store */
  nodes: Map<string, { id: string; content: string; parentId?: string; metadata?: Record<string, unknown> }>
  /** Edges map from the store */
  edges: Map<string, { id: string; sourceId: string; targetId: string; label?: string }>
  /** Map title */
  mapTitle?: string
  /** Operation being performed */
  operation: 'expand' | 'connect' | 'generate' | 'describe' | 'restructure'
  /** Maximum token budget for context */
  maxTokens?: number
}
