// Enhanced map generation prompts with domain ontology

import type { RichContext } from '../types/context'
import type { PersonaDefinition } from './SystemPersonas'
import type { MapGenerationOptions } from '~/types/ai-generation'
import { getLanguageInstruction } from '~/utils/ai-prompts'

export function buildMapGenerationV2(
  topic: string,
  context: RichContext,
  persona: PersonaDefinition,
  options: MapGenerationOptions = {}
): { system: string; user: string } {
  const {
    branchCount = 5,
    maxDepth = 2,
    includeCrossConnections = true
  } = options

  const minChildren = maxDepth >= 2 ? 2 : 1
  const maxChildren = maxDepth >= 3 ? 4 : 3
  const crossConnectionCount = includeCrossConnections ? Math.min(branchCount, 5) : 0
  const langInstruction = getLanguageInstruction(context.locale)

  const system = `${persona.systemPrompt}

You are creating a rich, interconnected knowledge map about "${topic}".
${langInstruction}
DOMAIN CONTEXT: ${context.subject.guidance.vocabularyHints.join('. ')}

STRUCTURE REQUIREMENTS:
1. Create ${branchCount} main branches with VARIED depths (some shallow, some deep)
2. Each branch: ${minChildren}-${maxChildren} children, with grandchildren where appropriate
3. VARY children count per branch — not all identical!
4. Use categories: ${context.subject.guidance.preferredCategories.join(', ')}
5. Include thought-provoking questions and concrete examples
${includeCrossConnections ? `6. Include ${crossConnectionCount}+ meaningful cross-connections` : ''}

STRUCTURE VARIETY:
- Some branches deep (3+ levels) exploring details
- Some branches wide (4+ children) covering breadth
- At least 2 "question" nodes to spark curiosity
- At least 2 "example" nodes with real-world instances
- Total nodes: ${branchCount * 4}-${branchCount * 6}

DOMAIN GUIDANCE:
- ${context.subject.guidance.structuralGuidance}
- Preferred relationships: ${context.subject.guidance.preferredRelationships.join(', ')}

AVOID:
- Uniform flat structures
- All nodes same category
- Generic/vague descriptions
- ${context.subject.guidance.antiPatterns.join('. ')}

Return ONLY valid JSON, no additional text.`

  const crossConnectionsSchema = includeCrossConnections
    ? `,\n  "crossConnections": [{ "sourceRef": "title", "targetRef": "title", "relationshipType": "${context.subject.guidance.preferredRelationships.slice(0, 5).join('" | "')}", "reason": "string" }]`
    : ''

  const user = `Create a RICH mind map about: "${topic}"

Return JSON:
{
  "rootTopic": "${topic}",
  "rootDescription": { "summary": "string", "keywords": ["string"] },
  "branches": [{
    "title": "string (2-8 words)",
    "description": { "summary": "string", "keywords": ["string"] },
    "category": "${context.subject.guidance.preferredCategories.join('" | "')}",
    "depth": 0,
    "children": [{ ... recursive, depth: 1, 2, ... }]
  }]${crossConnectionsSchema}
}

Return ONLY the JSON object:`

  return { system, user }
}
