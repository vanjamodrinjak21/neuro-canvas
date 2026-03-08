// Context serialization helpers for LLM prompts

interface NodeInfo {
  id: string
  content: string
  parentId?: string
  metadata?: Record<string, unknown>
}

interface EdgeInfo {
  id: string
  sourceId: string
  targetId: string
  label?: string
}

/**
 * Render a subtree as an indented tree string
 */
export function renderSubtree(
  rootId: string,
  nodes: Map<string, NodeInfo>,
  childrenMap: Map<string, string[]>,
  targetNodeId?: string,
  depth: number = 0,
  maxDepth: number = 6
): string {
  if (depth > maxDepth) return ''

  const node = nodes.get(rootId)
  if (!node) return ''

  const indent = '  '.repeat(depth)
  const prefix = depth === 0 ? '' : (depth === 1 ? '├── ' : '│   '.repeat(depth - 1) + '├── ')
  const marker = rootId === targetNodeId ? ' ← YOU ARE HERE' : ''
  const isRoot = !node.parentId
  const star = isRoot ? ' ★' : ''
  const category = node.metadata?.category ? ` [${node.metadata.category}]` : ''

  let result = `${indent}${prefix}${node.content}${star}${category}${marker}\n`

  const children = childrenMap.get(rootId) || []
  for (const childId of children) {
    result += renderSubtree(childId, nodes, childrenMap, targetNodeId, depth + 1, maxDepth)
  }

  return result
}

/**
 * Format cross-connections (edges that aren't parent-child)
 */
export function formatCrossLinks(
  edges: Map<string, EdgeInfo>,
  nodes: Map<string, NodeInfo>,
  parentChildEdges: Set<string>
): string {
  const crossLinks = Array.from(edges.values()).filter(e =>
    !parentChildEdges.has(`${e.sourceId}-${e.targetId}`) &&
    !parentChildEdges.has(`${e.targetId}-${e.sourceId}`)
  )

  if (crossLinks.length === 0) return ''

  return crossLinks
    .slice(0, 10) // Limit to prevent token explosion
    .map(e => {
      const source = nodes.get(e.sourceId)?.content || e.sourceId
      const target = nodes.get(e.targetId)?.content || e.targetId
      const label = e.label ? `[${e.label}]` : '─'
      return `  ${source} ─${label}─ ${target}`
    })
    .join('\n')
}

/**
 * Format cluster summary
 */
export function formatClusterSummary(
  clusters: Array<{ name: string; nodeIds: string[] }>,
  nodes: Map<string, NodeInfo>
): string {
  if (clusters.length === 0) return ''

  return clusters
    .slice(0, 5)
    .map(cluster => {
      const nodeNames = cluster.nodeIds
        .slice(0, 4)
        .map(id => nodes.get(id)?.content || id)
        .join(', ')
      const extra = cluster.nodeIds.length > 4 ? ` (+${cluster.nodeIds.length - 4} more)` : ''
      return `  • ${cluster.name}: ${nodeNames}${extra}`
    })
    .join('\n')
}

/**
 * Format user context block
 */
export function formatUserContext(opts: {
  intent: string
  rejectedSuggestions: string[]
  acceptedSuggestions: string[]
  expertiseLevel: string
  preferredCategories: string[]
  terminologyLevel: string
}): string {
  const lines: string[] = []

  lines.push(`  - Intent: ${opts.intent}`)

  if (opts.rejectedSuggestions.length > 0) {
    const rejected = opts.rejectedSuggestions.slice(0, 5).map(s => `"${s}"`).join(', ')
    lines.push(`  - Rejected: ${rejected}`)
  }

  if (opts.acceptedSuggestions.length > 0) {
    const accepted = opts.acceptedSuggestions.slice(0, 3).map(s => `"${s}"`).join(', ')
    lines.push(`  - Liked: ${accepted}`)
  }

  lines.push(`  - Expertise: ${opts.expertiseLevel}`)
  lines.push(`  - Terminology: ${opts.terminologyLevel}`)

  if (opts.preferredCategories.length > 0) {
    lines.push(`  - Prefers: ${opts.preferredCategories.join(', ')}`)
  }

  return lines.join('\n')
}

/**
 * Rough token count estimate (4 chars ≈ 1 token)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}
