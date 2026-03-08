// Enhanced expand prompts with persona + context + ontology

import type { RichContext } from '../types/context'
import type { AIBehaviorConfig } from '../types/cognitive'
import type { PersonaDefinition } from './SystemPersonas'
import type { UserHistory } from '../types/context'

export function buildSmartExpandV2(
  nodeContent: string,
  context: RichContext,
  persona: PersonaDefinition,
  behavior: AIBehaviorConfig,
  memory?: UserHistory
): { system: string; user: string } {
  const suggestionCount = behavior.suggestionCount || 5
  const domainVocab = context.subject.guidance.vocabularyHints.join('. ')

  // Build memory-aware preferences block
  let preferencesBlock = ''
  if (memory && (memory.rejectedSuggestions.length > 0 || memory.preferredCategories.length > 0)) {
    preferencesBlock = `\n\nUSER PREFERENCES (learned):
- ${memory.terminologyLevel} terminology level
- ${memory.avgTitleLength ? `Preferred title length: ~${memory.avgTitleLength} words` : 'Standard title length'}
- ${memory.preferredCategories.length > 0 ? `Favored categories: ${[...new Set(memory.preferredCategories)].slice(0, 3).join(', ')}` : 'No strong category preference'}`
  }

  const system = `${persona.systemPrompt}

${persona.expandBehavior}

DOMAIN CONTEXT: ${domainVocab}

CRITICAL REQUIREMENTS:
1. Generate exactly ${suggestionCount} suggestions with VARIED categories
${behavior.includeQuestions ? '2. Include at least 1 thought-provoking question' : ''}
${behavior.includeWildcards ? '3. Include 1 wildcard/surprising connection' : ''}
${behavior.includeContrarian ? '4. Include 1 contrarian or challenging perspective' : ''}
5. Titles: 2-8 words, SPECIFIC not generic
6. Use relationship types from: ${context.subject.guidance.preferredRelationships.join(', ')}
7. Use categories from: ${context.subject.guidance.preferredCategories.join(', ')}
8. Don't repeat concepts from existing nodes
9. Confidence: 0-1 reflecting certainty of relevance
10. Return ONLY valid JSON array

AVOID: ${context.subject.guidance.antiPatterns.join('. ')}${preferencesBlock}`

  const rejectedBlock = context.userHistory.rejectedSuggestions.length > 0
    ? `\n\nPREVIOUSLY REJECTED (do NOT suggest similar): ${context.userHistory.rejectedSuggestions.slice(0, 5).map(s => `"${s}"`).join(', ')}`
    : ''

  const user = `## Current Node: "${nodeContent}"
${context.mapTitle ? `## Map: "${context.mapTitle}"` : ''}

## Map Context:
${context.snapshot.graphTopology.slice(0, 1500)}
${context.snapshot.localNeighborhood ? `\n${context.snapshot.localNeighborhood.slice(0, 500)}` : ''}
${rejectedBlock}

Generate ${suggestionCount} DIVERSE suggestions. Return a JSON array:
[{
  "title": "string (2-8 words)",
  "description": { "summary": "string", "keywords": ["string"] },
  "category": "${context.subject.guidance.preferredCategories.join('" | "')}",
  "relationshipToParent": "${context.subject.guidance.preferredRelationships.join('" | "')}",
  "confidence": number
}]

Return ONLY the JSON array:`

  return { system, user }
}
