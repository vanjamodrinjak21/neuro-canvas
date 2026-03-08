// Rich Context Engine — assembles full context for AI operations

import type { RichContext, ContextParams, ContextSnapshot, UserIntent, UserHistory } from '../types/context'
import type { SubjectProfile } from '../types/subject'
import { detectSubject } from './SubjectEngine'
import {
  renderSubtree,
  formatCrossLinks,
  formatClusterSummary,
  formatUserContext,
  estimateTokenCount
} from './ContextEngine.format'
import type { ResolvedProvider } from '../utils/resolveProvider'

// In-memory user history tracking
const userHistory: UserHistory = {
  rejectedSuggestions: [],
  acceptedSuggestions: [],
  preferredCategories: [],
  terminologyLevel: 'moderate'
}

/**
 * Record a rejected suggestion
 */
export function recordRejection(title: string): void {
  userHistory.rejectedSuggestions.push(title)
  if (userHistory.rejectedSuggestions.length > 20) {
    userHistory.rejectedSuggestions.shift()
  }
}

/**
 * Record an accepted suggestion
 */
export function recordAcceptance(title: string, category?: string): void {
  userHistory.acceptedSuggestions.push(title)
  if (userHistory.acceptedSuggestions.length > 20) {
    userHistory.acceptedSuggestions.shift()
  }
  if (category) {
    userHistory.preferredCategories.push(category)
    if (userHistory.preferredCategories.length > 30) {
      userHistory.preferredCategories.shift()
    }
  }
}

/**
 * Build rich context for an AI operation
 */
export async function buildContext(
  params: ContextParams,
  provider?: ResolvedProvider
): Promise<RichContext> {
  const { nodes, edges, targetNodeId, mapTitle, operation, maxTokens = 3000 } = params

  // Detect subject (cached)
  const subject = await detectSubject(nodes, edges, provider)

  // Build graph snapshot
  const snapshot = serializeGraphContext(nodes, edges, targetNodeId, maxTokens)

  // Infer intent
  const intent = inferIntent(operation, targetNodeId, nodes)

  return {
    subject,
    snapshot,
    intent,
    userHistory: { ...userHistory },
    totalNodes: nodes.size,
    totalEdges: edges.size,
    mapTitle
  }
}

/**
 * Serialize graph into structured context for the LLM
 */
function serializeGraphContext(
  nodes: Map<string, ContextParams['nodes'] extends Map<string, infer V> ? V : never>,
  edges: Map<string, ContextParams['edges'] extends Map<string, infer V> ? V : never>,
  targetNodeId?: string,
  maxTokens: number = 3000
): ContextSnapshot {
  const nodeCount = nodes.size

  // Build children map
  const childrenMap = new Map<string, string[]>()
  const parentChildEdges = new Set<string>()

  for (const node of nodes.values()) {
    if (node.parentId) {
      const existing = childrenMap.get(node.parentId) || []
      existing.push(node.id)
      childrenMap.set(node.parentId, existing)
      parentChildEdges.add(`${node.parentId}-${node.id}`)
    }
  }

  // Find root nodes
  const roots = Array.from(nodes.values()).filter(n => !n.parentId)

  let graphTopology = ''
  let localNeighborhood = ''
  let clusterSummary = ''

  if (nodeCount <= 50) {
    // Small map: serialize everything
    graphTopology = serializeFullGraph(roots, nodes, childrenMap, targetNodeId)
  } else if (nodeCount <= 200) {
    // Medium map: full titles + neighborhood detail
    graphTopology = serializeTitleOnlyGraph(roots, nodes, childrenMap)
    if (targetNodeId) {
      localNeighborhood = serializeNeighborhood(targetNodeId, nodes, edges, childrenMap, 3)
    }
  } else {
    // Large map: neighborhood + landmark nodes only
    const landmarks = findLandmarkNodes(nodes, childrenMap)
    graphTopology = `Map has ${nodeCount} nodes. Key landmarks:\n` +
      landmarks.map(id => `  • ${nodes.get(id)?.content || id}`).join('\n')
    if (targetNodeId) {
      localNeighborhood = serializeNeighborhood(targetNodeId, nodes, edges, childrenMap, 3)
    }
  }

  // Cross-connections
  const crossConnections = formatCrossLinks(edges, nodes, parentChildEdges)

  // Truncate if over budget
  const totalEstimate = estimateTokenCount(graphTopology + localNeighborhood + crossConnections + clusterSummary)
  if (totalEstimate > maxTokens) {
    // Trim from the end of graphTopology
    const lines = graphTopology.split('\n')
    while (estimateTokenCount(lines.join('\n')) > maxTokens * 0.6) {
      lines.pop()
    }
    graphTopology = lines.join('\n') + '\n  ... (truncated)'
  }

  // Detect simple clusters by shared parents
  const clusters = detectSimpleClusters(nodes, childrenMap)
  clusterSummary = formatClusterSummary(clusters, nodes)

  return {
    graphTopology,
    localNeighborhood,
    clusterSummary,
    crossConnections
  }
}

function serializeFullGraph(
  roots: Array<{ id: string; content: string; parentId?: string }>,
  nodes: Map<string, { id: string; content: string; parentId?: string; metadata?: Record<string, unknown> }>,
  childrenMap: Map<string, string[]>,
  targetNodeId?: string
): string {
  let result = ''
  for (const root of roots) {
    result += renderSubtree(root.id, nodes, childrenMap, targetNodeId)
  }
  return result
}

function serializeTitleOnlyGraph(
  roots: Array<{ id: string; content: string }>,
  nodes: Map<string, { id: string; content: string; parentId?: string; metadata?: Record<string, unknown> }>,
  childrenMap: Map<string, string[]>
): string {
  let result = ''
  for (const root of roots) {
    result += renderSubtree(root.id, nodes, childrenMap, undefined, 0, 3) // limit depth to 3
  }
  return result
}

function serializeNeighborhood(
  targetNodeId: string,
  nodes: Map<string, { id: string; content: string; parentId?: string; metadata?: Record<string, unknown> }>,
  edges: Map<string, { id: string; sourceId: string; targetId: string; label?: string }>,
  childrenMap: Map<string, string[]>,
  depth: number
): string {
  const visited = new Set<string>()
  const neighbors: string[] = []

  function collect(nodeId: string, d: number) {
    if (d > depth || visited.has(nodeId)) return
    visited.add(nodeId)
    neighbors.push(nodeId)

    // Children
    const children = childrenMap.get(nodeId) || []
    for (const childId of children) {
      collect(childId, d + 1)
    }

    // Parent
    const node = nodes.get(nodeId)
    if (node?.parentId && !visited.has(node.parentId)) {
      collect(node.parentId, d + 1)
    }

    // Connected via edges
    for (const edge of edges.values()) {
      if (edge.sourceId === nodeId && !visited.has(edge.targetId)) {
        collect(edge.targetId, d + 1)
      }
      if (edge.targetId === nodeId && !visited.has(edge.sourceId)) {
        collect(edge.sourceId, d + 1)
      }
    }
  }

  collect(targetNodeId, 0)

  // Build a small subgraph of neighbors
  const localNodes = new Map<string, { id: string; content: string; parentId?: string; metadata?: Record<string, unknown> }>(
    neighbors
      .filter(id => nodes.has(id))
      .map(id => [id, nodes.get(id)!] as const)
  )

  const targetNode = nodes.get(targetNodeId)
  let result = `LOCAL NEIGHBORHOOD (${neighbors.length} nodes around "${targetNode?.content || targetNodeId}"):\n`

  // Find the local root (ancestor of target)
  let localRoot = targetNodeId
  let current = nodes.get(targetNodeId)
  while (current?.parentId && localNodes.has(current.parentId)) {
    localRoot = current.parentId
    current = nodes.get(current.parentId)
  }

  result += renderSubtree(localRoot, localNodes, childrenMap, targetNodeId)

  return result
}

function findLandmarkNodes(
  nodes: Map<string, { id: string; content: string; parentId?: string }>,
  childrenMap: Map<string, string[]>
): string[] {
  // Landmark = root nodes + nodes with most children
  const roots = Array.from(nodes.values())
    .filter(n => !n.parentId)
    .map(n => n.id)

  const byChildCount = Array.from(childrenMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([id]) => id)

  return [...new Set([...roots, ...byChildCount])].slice(0, 15)
}

function detectSimpleClusters(
  nodes: Map<string, { id: string; content: string; parentId?: string }>,
  childrenMap: Map<string, string[]>
): Array<{ name: string; nodeIds: string[] }> {
  // Group by parent as simple clusters
  const clusters: Array<{ name: string; nodeIds: string[] }> = []

  for (const [parentId, children] of childrenMap.entries()) {
    if (children.length >= 3) {
      const parent = nodes.get(parentId)
      clusters.push({
        name: parent?.content || 'Unnamed group',
        nodeIds: children
      })
    }
  }

  return clusters.sort((a, b) => b.nodeIds.length - a.nodeIds.length).slice(0, 5)
}

function inferIntent(
  operation: string,
  targetNodeId?: string,
  nodes?: Map<string, { id: string; content: string; parentId?: string }>
): UserIntent {
  const intentMap: Record<string, UserIntent['action']> = {
    'expand': 'expand',
    'connect': 'connect',
    'generate': 'generate',
    'describe': 'describe',
    'restructure': 'restructure'
  }

  const action = intentMap[operation] || 'explore'

  // Determine depth preference from context
  let depth: UserIntent['depth'] = 'medium'
  let direction: UserIntent['direction'] = 'both'

  if (operation === 'expand') {
    // If the target node already has many children, go deeper not wider
    if (targetNodeId && nodes) {
      const childCount = Array.from(nodes.values()).filter(n => n.parentId === targetNodeId).length
      if (childCount >= 3) {
        depth = 'deep'
        direction = 'depth'
      } else if (childCount === 0) {
        depth = 'medium'
        direction = 'breadth'
      }
    }
  } else if (operation === 'generate') {
    depth = 'deep'
    direction = 'both'
  }

  return {
    action,
    targetNodeId,
    depth,
    direction
  }
}

/**
 * Format a RichContext into the structured prompt block for LLMs
 */
export function formatRichContext(context: RichContext): string {
  const parts: string[] = []

  // Subject header
  const subTopic = context.subject.subTopic ? ` / ${context.subject.subTopic}` : ''
  const focus = context.subject.focusType.charAt(0).toUpperCase() + context.subject.focusType.slice(1)
  const expertise = context.subject.expertiseLevel.charAt(0).toUpperCase() + context.subject.expertiseLevel.slice(1)
  parts.push(`[SUBJECT: ${context.subject.domain}${subTopic} → ${focus} / ${expertise}]`)
  parts.push('')

  // Map structure
  if (context.snapshot.graphTopology) {
    parts.push('MAP STRUCTURE:')
    parts.push(context.snapshot.graphTopology)
    parts.push('')
  }

  // Local neighborhood
  if (context.snapshot.localNeighborhood) {
    parts.push(context.snapshot.localNeighborhood)
    parts.push('')
  }

  // Cross-connections
  if (context.snapshot.crossConnections) {
    parts.push('CROSS-CONNECTIONS:')
    parts.push(context.snapshot.crossConnections)
    parts.push('')
  }

  // Clusters
  if (context.snapshot.clusterSummary) {
    parts.push('CLUSTERS:')
    parts.push(context.snapshot.clusterSummary)
    parts.push('')
  }

  // User context
  parts.push('USER CONTEXT:')
  parts.push(formatUserContext({
    intent: `${context.intent.action} (${context.intent.depth}, ${context.intent.direction})`,
    rejectedSuggestions: context.userHistory.rejectedSuggestions,
    acceptedSuggestions: context.userHistory.acceptedSuggestions,
    expertiseLevel: context.subject.expertiseLevel,
    preferredCategories: context.userHistory.preferredCategories,
    terminologyLevel: context.userHistory.terminologyLevel
  }))
  parts.push('')

  // Ontology guidance
  if (context.subject.guidance) {
    parts.push('ONTOLOGY GUIDANCE:')
    parts.push(`  Preferred relationships: ${context.subject.guidance.preferredRelationships.join(', ')}`)
    parts.push(`  Preferred categories: ${context.subject.guidance.preferredCategories.join(', ')}`)
    if (context.subject.guidance.vocabularyHints.length > 0) {
      parts.push(`  Vocabulary: ${context.subject.guidance.vocabularyHints[0]}`)
    }
    parts.push(`  Structure: ${context.subject.guidance.structuralGuidance}`)
    if (context.subject.guidance.antiPatterns.length > 0) {
      parts.push(`  Avoid: ${context.subject.guidance.antiPatterns[0]}`)
    }
  }

  return parts.join('\n')
}
