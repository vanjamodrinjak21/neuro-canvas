// LLM-powered insight analysis prompts

import type { RichContext } from '../types/context'
import type { PersonaDefinition } from './SystemPersonas'

export function buildInsightAnalysisPrompt(
  context: RichContext,
  persona: PersonaDefinition
): { system: string; user: string } {
  const domainGuidance = getDomainInsightGuidance(context.subject.domain)

  const system = `${persona.systemPrompt}

You are analyzing a knowledge map to discover insights, gaps, and structural improvements.

INSIGHT TYPES you can identify:
1. conceptual-gap: Missing concepts that should exist given the surrounding content
2. structural-suggestion: Ways to reorganize or restructure for clarity
3. balance-issue: Over-developed vs under-developed areas
4. deepening-opportunity: Topics that deserve deeper exploration
5. accuracy-concern: Potential misconceptions or oversimplifications

DOMAIN-SPECIFIC GUIDANCE:
${domainGuidance}

For each insight, provide:
- type: one of the 5 types above
- title: concise description (5-10 words)
- description: detailed explanation with reasoning
- confidence: 0-1
- relatedNodeIds: which existing nodes relate
- suggestedAction: "add-node" | "add-connection" | "restructure" | "expand"
- actionPayload: specific details for the action
- reasoning: your chain of thought

Return ONLY valid JSON array, max 5 insights.`

  const user = `## Map Analysis

${context.snapshot.graphTopology.slice(0, 2000)}

${context.snapshot.crossConnections ? `CROSS-CONNECTIONS:\n${context.snapshot.crossConnections}\n` : ''}
${context.snapshot.clusterSummary ? `CLUSTERS:\n${context.snapshot.clusterSummary}\n` : ''}

Map has ${context.totalNodes} nodes and ${context.totalEdges} edges.
Subject: ${context.subject.domain} (${context.subject.expertiseLevel} level)

Analyze this map and return up to 5 insights as a JSON array:
[{
  "type": "conceptual-gap" | "structural-suggestion" | "balance-issue" | "deepening-opportunity" | "accuracy-concern",
  "title": "string",
  "description": "string",
  "confidence": number,
  "relatedNodeIds": ["string"],
  "suggestedAction": "add-node" | "add-connection" | "restructure" | "expand",
  "actionPayload": { ... },
  "reasoning": "string"
}]

Return ONLY the JSON array:`

  return { system, user }
}

function getDomainInsightGuidance(domain: string): string {
  const guidance: Record<string, string> = {
    'computer-science': 'Look for: missing complexity analysis, missing trade-offs between approaches, missing error handling considerations, incomplete design patterns, missing testing strategies.',
    'business': 'Look for: missing stakeholder perspectives, incomplete risk analysis, missing competitive considerations, unaddressed market segments, missing metrics/KPIs.',
    'psychology': 'Look for: correlation/causation confusion, missing boundary conditions, unreplicated findings presented as facts, missing cultural considerations, oversimplified models.',
    'medicine': 'Look for: missing contraindications, incomplete differential diagnoses, missing evidence quality indicators, oversimplified treatment algorithms.',
    'mathematics': 'Look for: missing prerequisites, unstated assumptions, missing counterexamples, incomplete proof strategies.',
    'physics': 'Look for: missing units/dimensions, classical/quantum confusion, missing experimental validation, incomplete force analysis.',
    'biology': 'Look for: missing evolutionary context, scale confusion (molecular/cellular/organism), teleological language, missing ecological interactions.',
    'education': 'Look for: missing assessment strategies, incomplete differentiation, missing learner perspectives, theory without practice.',
  }
  return guidance[domain] || 'Look for: missing connections between related concepts, underdeveloped branches, missing examples, structural imbalances.'
}
