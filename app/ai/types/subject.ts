// Subject Detection & Domain Types

export type DomainType =
  | 'computer-science'
  | 'mathematics'
  | 'physics'
  | 'engineering'
  | 'biology'
  | 'chemistry'
  | 'medicine'
  | 'psychology'
  | 'education'
  | 'business'
  | 'marketing'
  | 'finance'
  | 'economics'
  | 'law'
  | 'philosophy'
  | 'literature'
  | 'art'
  | 'music'
  | 'history'
  | 'writing'
  | 'general'

export type OntologyPatternType =
  | 'hierarchical'     // Deep trees, clear parent-child
  | 'networked'        // Many cross-connections
  | 'sequential'       // Linear/temporal flow
  | 'categorical'      // Classification-heavy
  | 'causal'           // Cause-effect chains
  | 'comparative'      // Side-by-side analysis
  | 'systems'          // Interconnected components
  | 'exploratory'      // Loose, creative connections

export interface OntologyGuidance {
  /** Recommended relationship types for this domain */
  preferredRelationships: string[]
  /** Recommended node categories for this domain */
  preferredCategories: string[]
  /** Domain-specific vocabulary hints */
  vocabularyHints: string[]
  /** Structural patterns that work well */
  structuralGuidance: string
  /** Anti-patterns to avoid */
  antiPatterns: string[]
}

export interface SubjectProfile {
  /** Primary detected domain */
  domain: DomainType
  /** Secondary domain if multi-disciplinary */
  secondaryDomain?: DomainType
  /** Specific sub-topic within the domain */
  subTopic?: string
  /** Confidence of detection (0-1) */
  confidence: number
  /** Detected structural pattern */
  ontologyPattern: OntologyPatternType
  /** Inferred expertise level */
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  /** Detected focus area (e.g. "Focused", "Overview", "Comparative") */
  focusType: 'overview' | 'focused' | 'comparative' | 'deep-dive' | 'exploratory'
  /** Domain-specific ontology guidance */
  guidance: OntologyGuidance
  /** Detected frameworks (e.g. "Porter's Five Forces") */
  detectedFrameworks: string[]
  /** When this profile was generated */
  detectedAt: number
}
