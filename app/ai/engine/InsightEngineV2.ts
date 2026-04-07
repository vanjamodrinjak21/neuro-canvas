// LLM-powered Insight Engine v2
// Sends graph context to LLM for deep insight analysis

import type { EnrichedInsight } from '~/types/semantic'
import { assemblePrompt } from '../prompts/PromptOrchestrator'
import { buildContext } from './ContextEngine'
import { aiComplete } from '~/utils/aiClient'
import { resolveProvider } from '../utils/resolveProvider'
import { executeWithRetry } from '../pipeline/RetryStrategy'
import { getSemanticCache } from '../pipeline/SemanticCache'
import type { Node, Edge } from '~/types/canvas'

type SuggestedAction = EnrichedInsight['suggestedAction']

const VALID_ACTIONS = new Set<string>(['add-node', 'add-connection', 'restructure', 'merge', 'expand', 'delete'])

interface LLMInsightItem {
  type: string
  title: string
  description: string
  confidence: number
  relatedNodeIds?: string[]
  suggestedAction?: string
  actionPayload?: Record<string, unknown>
  reasoning?: string
}

/**
 * Generate LLM-powered insights for a map.
 * Sends the full graph context to the LLM with domain-specific guidance.
 */
export async function generateInsights(
  nodes: Map<string, Node>,
  edges: Map<string, Edge>,
  mapTitle?: string
): Promise<EnrichedInsight[]> {
  const provider = await resolveProvider()

  // Build Maps compatible with ContextEngine
  const nodeInfoMap = new Map<string, { id: string; content: string; parentId?: string; metadata?: Record<string, unknown> }>()
  for (const [id, node] of nodes) {
    nodeInfoMap.set(id, {
      id: node.id,
      content: node.content,
      parentId: node.parentId,
      metadata: node.metadata as Record<string, unknown> | undefined
    })
  }

  const edgeInfoMap = new Map<string, { id: string; sourceId: string; targetId: string; label?: string }>()
  for (const [id, edge] of edges) {
    edgeInfoMap.set(id, {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      label: edge.label
    })
  }

  // Build rich context
  const context = await buildContext({
    nodes: nodeInfoMap,
    edges: edgeInfoMap,
    mapTitle: mapTitle || 'Knowledge Map',
    targetNodeId: undefined,
    operation: 'restructure'
  }, provider)

  const { system, user } = assemblePrompt({
    type: 'insight',
    context
  })

  // Check Redis cache
  const cache = getSemanticCache()
  const cached = await cache.get(system, user)
  if (cached) {
    try {
      const parsed = JSON.parse(cached.response)
      if (parsed.insights) {
        return mapToEnrichedInsights(parsed.insights)
      }
    } catch {
      // Cache had bad data, continue to fresh generation
    }
  }

  const content = await executeWithRetry(async () => {
    const response = await aiComplete({
      provider: provider.type,
      credentialId: provider.credentialId,
      baseUrl: provider.baseUrl,
      model: provider.selectedModelId,
      systemPrompt: system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 2500,
      temperature: 0.6
    })
    return response.content
  })

  await cache.set(system, user, content, null, 'insight')

  // Parse LLM response
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
    const parsed = JSON.parse(jsonMatch[1] || content)
    return mapToEnrichedInsights(parsed.insights || (Array.isArray(parsed) ? parsed : []))
  } catch {
    return [{
      id: `llm-insight-${Date.now()}`,
      type: 'structural-suggestion',
      title: 'AI Analysis',
      description: content.slice(0, 500),
      confidence: 0.5,
      relatedNodeIds: [],
      createdAt: Date.now(),
      isLLMGenerated: true
    }]
  }
}

function mapToEnrichedInsights(raw: LLMInsightItem[]): EnrichedInsight[] {
  return raw.map((item, i) => ({
    id: `llm-insight-${Date.now()}-${i}`,
    type: mapInsightType(item.type),
    title: item.title || 'Insight',
    description: item.description || '',
    confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0.5,
    relatedNodeIds: item.relatedNodeIds || [],
    createdAt: Date.now(),
    suggestedAction: parseSuggestedAction(item.suggestedAction),
    actionPayload: item.actionPayload,
    reasoning: item.reasoning,
    isLLMGenerated: true
  }))
}

function parseSuggestedAction(raw?: string): SuggestedAction {
  if (!raw || !VALID_ACTIONS.has(raw)) return undefined
  return raw as SuggestedAction
}

function mapInsightType(raw: string): EnrichedInsight['type'] {
  const validTypes = new Set([
    'bridge', 'gap', 'outlier', 'cluster',
    'conceptual-gap', 'structural-suggestion', 'balance-issue',
    'deepening-opportunity', 'accuracy-concern'
  ])
  return validTypes.has(raw) ? raw as EnrichedInsight['type'] : 'structural-suggestion'
}
