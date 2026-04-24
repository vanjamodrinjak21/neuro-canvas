// AI Generation Types for Enhanced Map Creation

import type { NodeDescription } from './canvas'

// Re-export NodeDescription for convenience
export type { NodeDescription } from './canvas'

/**
 * Relationship types between nodes in a mind map (v1 original 9)
 */
export type RelationshipTypeV1 =
  | 'is-a'        // Classification/type relationship
  | 'has-a'       // Composition/containment
  | 'related-to'  // General association
  | 'causes'      // Causal relationship
  | 'enables'     // Prerequisite/enabler
  | 'opposes'     // Contradiction/opposition
  | 'example-of'  // Instance/example
  | 'part-of'     // Component/part
  | 'leads-to'    // Sequence/consequence

/**
 * Extended relationship types (v2 adds 14 new types)
 */
export type RelationshipTypeV2 =
  | 'extends'           // Builds upon
  | 'implements'        // Concrete realization
  | 'prerequisite-for'  // Must come before
  | 'alternative-to'    // Different approach
  | 'evidence-for'      // Supports claim
  | 'evidence-against'  // Contradicts claim
  | 'depends-on'        // Functional dependency
  | 'influences'        // Indirect effect
  | 'precedes'          // Temporal ordering
  | 'follows'           // Comes after
  | 'co-occurs'         // Happens together
  | 'trade-off'         // Opposing benefit
  | 'stronger-than'     // Comparative strength
  | 'complements'       // Works well together

/**
 * Combined relationship types (v1 + v2)
 */
export type RelationshipType = RelationshipTypeV1 | RelationshipTypeV2

/**
 * Node categories for classification
 */
export type NodeCategory =
  | 'concept'     // Abstract idea or principle
  | 'fact'        // Verifiable information
  | 'question'    // Open inquiry
  | 'example'     // Concrete instance
  | 'definition'  // Formal explanation
  | 'process'     // Step-by-step procedure

/**
 * Rich node suggestion with description and metadata
 */
export interface RichNodeSuggestion {
  /** Node title, 2-8 words, clear and specific */
  title: string
  /** Rich description with summary and keywords */
  description: NodeDescription
  /** Category classification */
  category: NodeCategory
  /** How this node relates to its parent */
  relationshipToParent?: RelationshipType
  /** Optional nested suggestions for hierarchical expansion */
  suggestedChildren?: RichNodeSuggestion[]
  /** Confidence score 0-1 */
  confidence: number
}

/**
 * Cross-connection between branches in a map structure
 */
export interface CrossConnection {
  /** ID or title of source branch/node */
  sourceRef: string
  /** ID or title of target branch/node */
  targetRef: string
  /** Type of relationship */
  relationshipType: RelationshipType
  /** Brief explanation of the connection */
  reason?: string
}

/**
 * Branch structure within a map
 */
export interface BranchStructure {
  /** Branch title */
  title: string
  /** Rich description */
  description: NodeDescription
  /** Category of this branch */
  category: NodeCategory
  /** Child branches (recursive) */
  children: BranchStructure[]
  /** Depth level (0 = root children) */
  depth: number
}

/**
 * Complete map structure generated from a topic
 */
export interface MapStructure {
  /** The main topic/root node title */
  rootTopic: string
  /** Description for the root node */
  rootDescription: NodeDescription
  /** Main branches extending from root */
  branches: BranchStructure[]
  /** Optional connections between different branches */
  crossConnections?: CrossConnection[]
}

/**
 * Generation depth presets
 */
export type GenerationDepth = 'shallow' | 'medium' | 'deep'

/**
 * Generation style presets
 */
export type GenerationStyle = 'concise' | 'detailed' | 'academic'

/**
 * Context provided to AI for better generation
 */
export interface GenerationContext {
  /** Title of the current map */
  mapTitle?: string
  /** Existing nodes with their content and descriptions */
  existingNodes: Array<{
    id: string
    content: string
    description?: NodeDescription
  }>
  /** Existing connections between nodes */
  existingEdges: Array<{
    sourceId: string
    targetId: string
    label?: string
  }>
  /** How deep to generate (affects branch depth and detail) */
  depth: GenerationDepth
  /** Writing style for descriptions */
  style: GenerationStyle
  /** Optional domain/subject area for specialized vocabulary */
  domain?: string
  /** Optional rich context snapshot from v2 Context Engine */
  contextSnapshot?: import('~/ai/types/context').RichContext
  /** Locale code for AI-generated content language (e.g. 'hr', 'en') */
  locale?: string
}

/**
 * Options for map structure generation
 */
export interface MapGenerationOptions {
  /** Number of main branches (3-7 recommended) */
  branchCount?: number
  /** Maximum depth of children (1-3 recommended) */
  maxDepth?: number
  /** Generation style */
  style?: GenerationStyle
  /** Include cross-connections between branches */
  includeCrossConnections?: boolean
  /** Optional domain specialization */
  domain?: string
  /** Locale code for AI-generated content language */
  locale?: string
}

/**
 * Options for hierarchical expansion
 */
export interface HierarchicalExpandOptions {
  /** How many levels deep to expand (default 2) */
  depth?: number
  /** Max suggestions per level */
  maxPerLevel?: number
  /** Generation style */
  style?: GenerationStyle
}

/**
 * Typed connection suggestion
 */
export interface TypedConnectionSuggestion {
  /** Source node ID */
  sourceId: string
  /** Target node ID */
  targetId: string
  /** Type of relationship */
  relationshipType: RelationshipType
  /** Explanation of why this connection makes sense */
  reason: string
  /** Confidence score 0-1 */
  confidence: number
}
