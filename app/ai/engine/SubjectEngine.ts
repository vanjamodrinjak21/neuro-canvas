// Subject Detection Engine — 3-pass domain classification

import type { DomainType, OntologyPatternType, SubjectProfile, OntologyGuidance } from '../types/subject'
import { DOMAIN_KEYWORDS, FRAMEWORK_PATTERNS, DOMAIN_GUIDANCE } from './SubjectEngine.data'
import { aiComplete } from '~/utils/aiClient'
import type { ResolvedProvider } from '../utils/resolveProvider'

interface NodeInfo {
  id: string
  content: string
  parentId?: string
  metadata?: Record<string, unknown>
}

interface EdgeInfo {
  sourceId: string
  targetId: string
  label?: string
}

/** Cached subject profiles keyed by map content hash */
const profileCache = new Map<string, SubjectProfile>()

/**
 * Detect the subject domain of a map using a 3-pass approach:
 * Pass 1 (Lexical): keyword frequency against domain dictionaries
 * Pass 2 (Structural): graph topology analysis
 * Pass 3 (LLM): only when confidence < 0.7
 */
export async function detectSubject(
  nodes: Map<string, NodeInfo>,
  edges: Map<string, EdgeInfo>,
  provider?: ResolvedProvider
): Promise<SubjectProfile> {
  // Generate cache key from node contents
  const contentHash = generateContentHash(nodes)
  const cached = profileCache.get(contentHash)
  if (cached && Date.now() - cached.detectedAt < 5 * 60 * 1000) {
    return cached
  }

  // Pass 1: Lexical analysis
  const lexicalResult = lexicalPass(nodes)

  // Pass 2: Structural analysis
  const structuralResult = structuralPass(nodes, edges)

  // Combine Pass 1 + 2
  let domain = lexicalResult.domain
  let confidence = lexicalResult.confidence
  const ontologyPattern = structuralResult.pattern

  // If lexical is weak, use structural hints
  if (lexicalResult.confidence < 0.5 && structuralResult.domainHint) {
    domain = structuralResult.domainHint
    confidence = Math.max(confidence, 0.4)
  }

  // Boost confidence if both agree
  if (lexicalResult.domain === structuralResult.domainHint) {
    confidence = Math.min(1, confidence + 0.15)
  }

  // Pass 3: LLM micro-classification (only if low confidence and provider available)
  if (confidence < 0.7 && provider) {
    try {
      const llmResult = await llmPass(nodes, provider)
      if (llmResult) {
        domain = llmResult.domain
        confidence = Math.max(confidence, llmResult.confidence)
      }
    } catch {
      // LLM pass is optional, continue with what we have
    }
  }

  const expertiseLevel = detectExpertiseLevel(nodes)
  const focusType = detectFocusType(nodes, edges)

  const profile: SubjectProfile = {
    domain,
    secondaryDomain: lexicalResult.secondaryDomain,
    subTopic: lexicalResult.topKeywords[0],
    confidence,
    ontologyPattern,
    expertiseLevel,
    focusType,
    guidance: getOntologyGuidance(domain),
    detectedFrameworks: lexicalResult.detectedFrameworks,
    detectedAt: Date.now()
  }

  profileCache.set(contentHash, profile)
  return profile
}

function generateContentHash(nodes: Map<string, NodeInfo>): string {
  const contents = Array.from(nodes.values())
    .map(n => n.content)
    .sort()
    .join('|')
  // Simple hash
  let hash = 0
  for (let i = 0; i < contents.length; i++) {
    const char = contents.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return String(hash)
}

// ─── Pass 1: Lexical Analysis ───────────────────────────────────────

interface LexicalResult {
  domain: DomainType
  secondaryDomain?: DomainType
  confidence: number
  topKeywords: string[]
  detectedFrameworks: string[]
}

function lexicalPass(nodes: Map<string, NodeInfo>): LexicalResult {
  // Combine all node content
  const allText = Array.from(nodes.values())
    .map(n => n.content.toLowerCase())
    .join(' ')

  const words = allText.split(/\s+/)

  // Check for framework patterns first (high confidence signals)
  const detectedFrameworks: string[] = []
  for (const fp of FRAMEWORK_PATTERNS) {
    if (allText.includes(fp.pattern)) {
      detectedFrameworks.push(fp.pattern)
    }
  }

  // Score each domain by keyword frequency
  const domainScores = new Map<DomainType, number>()

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [DomainType, string[]][]) {
    if (domain === 'general' || keywords.length === 0) continue

    let score = 0
    const matchedKeywords = new Set<string>()

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase()
      // Check for multi-word keywords
      if (keywordLower.includes(' ')) {
        if (allText.includes(keywordLower)) {
          score += 3 // Multi-word matches are more specific
          matchedKeywords.add(keyword)
        }
      } else {
        // Single word: count occurrences
        const count = words.filter(w => w === keywordLower || w.startsWith(keywordLower)).length
        if (count > 0) {
          score += Math.min(count, 3) // Cap per-keyword score
          matchedKeywords.add(keyword)
        }
      }
    }

    // Normalize by keyword list size to avoid bias toward larger dictionaries
    const normalizedScore = keywords.length > 0 ? score / Math.sqrt(keywords.length) : 0
    domainScores.set(domain, normalizedScore)
  }

  // Add framework bonuses
  for (const fp of detectedFrameworks.map(f => FRAMEWORK_PATTERNS.find(p => p.pattern === f)!)) {
    const current = domainScores.get(fp.domain) || 0
    domainScores.set(fp.domain, current + 5)
  }

  // Sort domains by score
  const sorted = Array.from(domainScores.entries())
    .sort((a, b) => b[1] - a[1])

  if (sorted.length === 0 || sorted[0]![1] === 0) {
    return {
      domain: 'general',
      confidence: 0.3,
      topKeywords: [],
      detectedFrameworks
    }
  }

  const topDomain = sorted[0]![0]
  const topScore = sorted[0]![1]
  const secondScore = sorted[1]?.[1] || 0

  // Confidence based on separation between top and second domain
  const separation = secondScore > 0 ? topScore / secondScore : 3
  const confidence = Math.min(0.95, 0.3 + separation * 0.15)

  return {
    domain: topDomain,
    secondaryDomain: sorted[1] && secondScore > topScore * 0.5 ? sorted[1]![0] : undefined,
    confidence,
    topKeywords: Array.from(new Set(
      (DOMAIN_KEYWORDS[topDomain] || []).filter(k =>
        allText.includes(k.toLowerCase())
      )
    )).slice(0, 5),
    detectedFrameworks
  }
}

// ─── Pass 2: Structural Analysis ──────────────────────────────────

interface StructuralResult {
  pattern: OntologyPatternType
  domainHint?: DomainType
  depth: number
  breadth: number
  crossConnectionRatio: number
}

function structuralPass(
  nodes: Map<string, NodeInfo>,
  edges: Map<string, EdgeInfo>
): StructuralResult {
  const nodeCount = nodes.size
  const edgeCount = edges.size

  if (nodeCount === 0) {
    return { pattern: 'exploratory', depth: 0, breadth: 0, crossConnectionRatio: 0 }
  }

  // Build adjacency for analysis
  const children = new Map<string, string[]>()
  const parents = new Map<string, string>()

  for (const node of nodes.values()) {
    if (node.parentId) {
      parents.set(node.id, node.parentId)
      const existing = children.get(node.parentId) || []
      existing.push(node.id)
      children.set(node.parentId, existing)
    }
  }

  // Calculate tree depth
  function getDepth(nodeId: string): number {
    const kids = children.get(nodeId) || []
    if (kids.length === 0) return 0
    return 1 + Math.max(...kids.map(getDepth))
  }

  const roots = Array.from(nodes.values()).filter(n => !n.parentId)
  const maxDepth = roots.length > 0
    ? Math.max(...roots.map(r => getDepth(r.id)))
    : 0

  // Max breadth (most children at any level)
  const maxBreadth = Math.max(0, ...Array.from(children.values()).map(c => c.length))

  // Cross-connections: edges that aren't parent-child
  const parentChildEdges = new Set<string>()
  for (const [childId, parentId] of parents.entries()) {
    parentChildEdges.add(`${parentId}-${childId}`)
    parentChildEdges.add(`${childId}-${parentId}`)
  }

  const crossConnections = Array.from(edges.values()).filter(e =>
    !parentChildEdges.has(`${e.sourceId}-${e.targetId}`)
  ).length

  const crossConnectionRatio = edgeCount > 0 ? crossConnections / edgeCount : 0

  // Determine pattern
  let pattern: OntologyPatternType = 'exploratory'

  if (maxDepth >= 3 && crossConnectionRatio < 0.2) {
    pattern = 'hierarchical'
  } else if (crossConnectionRatio > 0.5) {
    pattern = 'networked'
  } else if (maxDepth <= 1 && maxBreadth >= 5) {
    pattern = 'categorical'
  } else if (maxDepth >= 2 && maxBreadth <= 2) {
    pattern = 'sequential'
  } else if (crossConnectionRatio > 0.3) {
    pattern = 'systems'
  } else if (maxBreadth >= 3 && maxDepth >= 2) {
    pattern = 'causal'
  }

  // Structural domain hints
  let domainHint: DomainType | undefined
  if (pattern === 'hierarchical' && maxDepth >= 4) {
    domainHint = 'computer-science' // Deep hierarchies suggest CS/math
  } else if (pattern === 'categorical' && maxBreadth >= 6) {
    domainHint = 'biology' // Wide classification suggests biology/taxonomy
  }

  return {
    pattern,
    domainHint,
    depth: maxDepth,
    breadth: maxBreadth,
    crossConnectionRatio
  }
}

// ─── Pass 3: LLM Micro-Classification ──────────────────────────────

async function llmPass(
  nodes: Map<string, NodeInfo>,
  provider: ResolvedProvider
): Promise<{ domain: DomainType; confidence: number } | null> {
  // Build a compact summary of node titles (max ~150 tokens)
  const titles = Array.from(nodes.values())
    .map(n => n.content)
    .slice(0, 20)
    .join(', ')

  const response = await aiComplete({
    provider: provider.type,
    apiKey: provider.apiKey,
    credentialId: provider.credentialId,
    baseUrl: provider.baseUrl,
    model: provider.selectedModelId,
    systemPrompt: 'You classify knowledge maps by domain. Reply with ONLY a JSON object: {"domain":"<domain>","confidence":<0-1>}. Valid domains: computer-science, mathematics, physics, engineering, biology, chemistry, medicine, psychology, education, business, marketing, finance, economics, law, philosophy, literature, art, music, history, writing, general',
    messages: [{ role: 'user', content: `Classify this knowledge map: ${titles}` }],
    maxTokens: 50,
    temperature: 0.1
  })

  try {
    const match = response.content.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (parsed.domain && typeof parsed.confidence === 'number') {
        return {
          domain: parsed.domain as DomainType,
          confidence: Math.max(0, Math.min(1, parsed.confidence))
        }
      }
    }
  } catch {
    // Parse failure is ok, we have lexical/structural results
  }

  return null
}

// ─── Helpers ────────────────────────────────────────────────────────

function detectExpertiseLevel(
  nodes: Map<string, NodeInfo>
): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  const allText = Array.from(nodes.values())
    .map(n => n.content)
    .join(' ')

  // Check for technical density
  const words = allText.split(/\s+/)
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1)

  // Longer words and more nodes suggest higher expertise
  const nodeCount = nodes.size

  if (avgWordLength > 8 && nodeCount > 30) return 'expert'
  if (avgWordLength > 7 || nodeCount > 20) return 'advanced'
  if (nodeCount > 10) return 'intermediate'
  return 'beginner'
}

function detectFocusType(
  nodes: Map<string, NodeInfo>,
  edges: Map<string, EdgeInfo>
): 'overview' | 'focused' | 'comparative' | 'deep-dive' | 'exploratory' {
  const nodeCount = nodes.size
  const edgeCount = edges.size

  // Check for depth vs breadth
  const roots = Array.from(nodes.values()).filter(n => !n.parentId)
  const avgChildrenPerRoot = nodeCount / (roots.length || 1)

  if (roots.length === 1 && avgChildrenPerRoot > 10) return 'deep-dive'
  if (roots.length > 3) return 'comparative'
  if (nodeCount < 8 && edgeCount < 5) return 'exploratory'
  if (nodeCount > 15 && roots.length <= 2) return 'focused'
  return 'overview'
}

/**
 * Get ontology guidance for a domain
 */
export function getOntologyGuidance(domain: DomainType): OntologyGuidance {
  return DOMAIN_GUIDANCE[domain] || DOMAIN_GUIDANCE['general']
}

/**
 * Get recommended relationship types for a domain
 */
export function getRelationshipsForDomain(domain: DomainType): string[] {
  return DOMAIN_GUIDANCE[domain]?.preferredRelationships || DOMAIN_GUIDANCE['general'].preferredRelationships
}

/**
 * Get recommended categories for a domain
 */
export function getCategoriesForDomain(domain: DomainType): string[] {
  return DOMAIN_GUIDANCE[domain]?.preferredCategories || DOMAIN_GUIDANCE['general'].preferredCategories
}

/**
 * Clear the subject profile cache
 */
export function clearSubjectCache(): void {
  profileCache.clear()
}
