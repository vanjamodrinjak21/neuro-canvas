// Centralized AI Prompt Builders for Enhanced Map Creation

import type {
  GenerationContext,
  GenerationStyle,
  GenerationDepth,
  MapGenerationOptions,
  HierarchicalExpandOptions,
  NodeCategory,
  RelationshipType
} from '~/types/ai-generation'

/**
 * Get language instruction for AI prompts based on locale.
 * Returns an instruction string that tells the LLM to generate content in the specified language.
 * JSON keys stay in English; only user-facing values (titles, descriptions, labels) are translated.
 */
export function getLanguageInstruction(locale?: string): string {
  if (!locale || locale === 'en') return ''
  const languageNames: Record<string, string> = {
    hr: 'Croatian (Hrvatski)',
    de: 'German (Deutsch)',
    fr: 'French (Français)',
    es: 'Spanish (Español)'
  }
  const langName = languageNames[locale] || locale
  return `\nIMPORTANT: Generate ALL user-facing text (titles, descriptions, labels, questions) in ${langName}. JSON property names must remain in English. Only the string VALUES should be in ${langName}.`
}

/**
 * Get style-specific instructions for prompts
 */
function getStyleInstructions(style: GenerationStyle): string {
  switch (style) {
    case 'concise':
      return 'TONE: Concise and punchy. Each summary is one tight sentence carrying a real insight — no filler, no restating the title.'
    case 'detailed':
      return 'TONE: Rich and explanatory. Summaries give context, mechanism, and significance in 1-2 sentences, using concrete nouns and verbs over vague abstractions.'
    case 'academic':
      return 'TONE: Rigorous and precise. Use correct domain terminology, name key theories, figures, or works where relevant, and be careful with claims — scholarly but still readable.'
    default:
      return 'TONE: Clear, specific, and genuinely informative.'
  }
}

/**
 * Get depth-specific instructions for prompts
 */
function getDepthInstructions(depth: GenerationDepth): { branchCount: number; childDepth: number } {
  switch (depth) {
    case 'shallow':
      return { branchCount: 3, childDepth: 1 }
    case 'medium':
      return { branchCount: 5, childDepth: 2 }
    case 'deep':
      return { branchCount: 7, childDepth: 3 }
    default:
      return { branchCount: 5, childDepth: 2 }
  }
}

/**
 * Format existing nodes for context
 */
function formatExistingNodesContext(context: GenerationContext): string {
  if (context.existingNodes.length === 0) {
    return 'No existing nodes.'
  }

  return context.existingNodes
    .slice(0, 10) // Limit to 10 nodes for context
    .map(node => {
      const desc = node.description?.summary ? `: ${node.description.summary}` : ''
      return `- ${node.content}${desc}`
    })
    .join('\n')
}

/**
 * Build the JSON schema for rich node suggestions
 */
function getRichNodeSuggestionSchema(): string {
  return `{
  "title": "string (2-8 words, clear and specific)",
  "description": {
    "summary": "string (1-2 sentences explaining why this matters)",
    "keywords": ["string"] (3-5 relevant keywords)
  },
  "category": "concept" | "fact" | "question" | "example" | "definition" | "process",
  "relationshipToParent": "is-a" | "has-a" | "related-to" | "causes" | "enables" | "opposes" | "example-of" | "part-of" | "leads-to",
  "confidence": number (0-1)
}`
}

/**
 * Build enhanced expand prompt for generating rich suggestions
 */
export function buildEnhancedExpandPrompt(
  nodeContent: string,
  context: GenerationContext,
  maxSuggestions: number = 5
): { system: string; user: string } {
  const styleInstructions = getStyleInstructions(context.style)
  const domainContext = context.domain ? `\nDomain/Subject Area: ${context.domain}` : ''

  const langInstruction = getLanguageInstruction(context.locale)

  const system = `You are an expert thinking partner who expands a single mind-map node into DIVERSE, non-obvious directions. Weak expansions list obvious sub-categories. Strong expansions mix:
- a deeper layer (what mechanism or detail sits beneath this concept?)
- a practical application (how is it used in the real world?)
- a sharp open question (something debated, unknown, or counter-intuitive)
- a concrete example naming a real person, event, product, or case
- a surprising link to an adjacent idea

${styleInstructions}${langInstruction}

CRITICAL REQUIREMENTS:
1. Generate exactly ${maxSuggestions} suggestions with VARIED categories (never all the same).
2. At least one must be a genuine question and at least one a concrete real-world example.
3. Titles are 2-8 words and SPECIFIC. Ban generic labels: "Types of X", "Benefits of X", "Overview", "Other".
4. Each summary explains WHY it matters or HOW it connects — never just restates the title.
5. Use diverse, accurate relationship types — not everything is "related-to".
6. Surprise the user with at least one angle they wouldn't have thought of.
7. Never duplicate or trivially rephrase an existing node.
8. Return ONLY a valid JSON array.`

  const user = `## Current Node: "${nodeContent}"
${context.mapTitle ? `## Map Title: "${context.mapTitle}"` : ''}${domainContext}

## Existing Nodes (avoid duplicating these):
${formatExistingNodesContext(context)}

Generate ${maxSuggestions} DIVERSE suggestions. Include:
- At least 1 thought-provoking question about "${nodeContent}"
- At least 1 specific real-world example
- Mix of categories: concept, fact, question, example, definition, process

Return a JSON array where each object matches this schema:
${getRichNodeSuggestionSchema()}

Return ONLY the JSON array:`

  return { system, user }
}

/**
 * Build prompt for generating description of an existing node
 */
export function buildNodeDescriptionPrompt(
  nodeContent: string,
  contextNodes: Array<{ content: string; description?: { summary: string } }>,
  style: GenerationStyle = 'detailed',
  locale?: string
): { system: string; user: string } {
  const styleInstructions = getStyleInstructions(style)
  const langInstruction = getLanguageInstruction(locale)

  const system = `You are an expert knowledge synthesizer. You write mind-map node descriptions that a curious reader actually learns something from.

${styleInstructions}${langInstruction}

IMPORTANT RULES:
1. The summary captures the essence AND why it matters — significance, not a dictionary definition.
2. "details" (optional) adds mechanism, nuance, a key example, or a common misconception — include it only when it adds real value.
3. Ground the description in the surrounding nodes so it fits THIS map, not a generic encyclopedia entry.
4. Keywords are search-useful terms (concepts, named entities, synonyms) — never stopwords.
5. Return ONLY valid JSON, no additional text.`

  const contextList = contextNodes
    .slice(0, 5)
    .map(n => `- ${n.content}${n.description?.summary ? `: ${n.description.summary}` : ''}`)
    .join('\n')

  const user = `## Node to Describe: "${nodeContent}"

## Surrounding Nodes:
${contextList || 'No surrounding nodes.'}

Generate a description for this node. Return JSON matching this schema:
{
  "summary": "string (1-2 sentences explaining the significance)",
  "details": "string (optional, 2-3 sentences with additional context)",
  "keywords": ["string"] (4-6 relevant keywords for search)
}

Return ONLY the JSON object:`

  return { system, user }
}

/**
 * Build prompt for generating entire map structure from topic
 */
export function buildMapStructurePrompt(
  topic: string,
  options: MapGenerationOptions = {}
): { system: string; user: string } {
  const {
    branchCount = 5,
    maxDepth = 2,
    style = 'detailed',
    includeCrossConnections = true,
    domain,
    locale
  } = options

  const styleInstructions = getStyleInstructions(style)
  const domainContext = domain ? `\nDomain/Subject Area: ${domain}` : ''
  const langInstruction = getLanguageInstruction(locale)

  // Calculate complexity based on depth setting
  const minChildren = maxDepth >= 2 ? 2 : 1
  const maxChildren = maxDepth >= 3 ? 4 : 3
  const crossConnectionCount = includeCrossConnections ? Math.min(branchCount, 5) : 0

  const system = `You are a world-class mind-mapping architect. You turn a single topic into a rich, multi-level knowledge map an expert would be proud of — structurally varied, intellectually interesting, and genuinely useful for learning or thinking.

${styleInstructions}${langInstruction}

NON-NEGOTIABLE STRUCTURE:
1. Create exactly ${branchCount} main branches, each a DISTINCT facet of the topic (not overlapping, not synonyms of each other).
2. EVERY main branch MUST have children. Depth target: ${maxDepth} level(s) below the root — take some branches the full ${maxDepth} levels deep, where appropriate add grandchildren.
3. Give each branch ${minChildren}-${maxChildren} children, and VARY the count — never make all branches the same shape.
4. Aim for ${branchCount * 4}-${branchCount * 6} total nodes. A root with ${branchCount} childless branches is a FAILURE, not a map.
5. Use ALL category types across the map: concept, fact, question, example, definition, process.
${includeCrossConnections ? `6. Add ${crossConnectionCount}+ cross-connections between nodes in DIFFERENT branches — the non-obvious links are what make a map insightful.` : ''}

CONTENT QUALITY:
- Include at least 2 "question" nodes that provoke real curiosity (not "What is X?").
- Include at least 2 "example" nodes naming concrete real-world instances — people, events, products, cases — not "an example of X".
- Every title is specific (2-8 words). Reject scaffolding like "Types of X", "Benefits of X", "Overview", "Introduction", "Other".
- Every summary teaches something — a mechanism, a why-it-matters, or a surprising fact — never just restates the title.

AVOID: flat 1-root + N-identical-branch trees, every node the same category, vague descriptions, and missing cross-connections.

Return ONLY valid JSON, no additional text.`

  const crossConnectionsSchema = includeCrossConnections
    ? `,
  "crossConnections": [
    {
      "sourceRef": "string (title of source node - can be any node, not just main branches)",
      "targetRef": "string (title of target node)",
      "relationshipType": "is-a" | "has-a" | "related-to" | "causes" | "enables" | "opposes" | "example-of" | "part-of" | "leads-to",
      "reason": "string (why this connection matters)"
    }
  ]`
    : ''

  const user = `## Topic: "${topic}"${domainContext}

Build the richest, most interesting map you can for this topic. Before writing, mentally pick ${branchCount} genuinely different angles on it, then go deep on each one and give every branch real children. Reward the reader with structure variety, concrete examples, and at least one connection they wouldn't have expected.

Return JSON matching this schema (JSON keys stay in English; values follow the tone/language rules above):
{
  "rootTopic": "${topic}",
  "rootDescription": {
    "summary": "string (compelling 1-2 sentence overview)",
    "keywords": ["string"] (5-7 key terms)
  },
  "branches": [
    {
      "title": "string (2-8 words, specific not generic)",
      "description": {
        "summary": "string (insightful 1-2 sentences)",
        "keywords": ["string"]
      },
      "category": "concept" | "fact" | "question" | "example" | "definition" | "process",
      "depth": 0,
      "children": [
        {
          "title": "...",
          "description": {...},
          "category": "...",
          "depth": 1,
          "children": [
            // Go deeper for some branches!
          ]
        }
      ]
    }
  ]${crossConnectionsSchema}
}

Return ONLY the JSON object:`

  return { system, user }
}

/**
 * Build prompt for hierarchical expansion (multi-level)
 */
export function buildHierarchicalExpandPrompt(
  nodeContent: string,
  context: GenerationContext,
  options: HierarchicalExpandOptions = {}
): { system: string; user: string } {
  const { depth = 2, maxPerLevel = 3, style = 'detailed' } = options
  const styleInstructions = getStyleInstructions(style)
  const domainContext = context.domain ? `\nDomain/Subject Area: ${context.domain}` : ''
  const langInstruction = getLanguageInstruction(context.locale)

  const system = `You are an expert mind-mapping assistant building a RICH, multi-level sub-tree under one node. The output is a mini knowledge tree that explores "${nodeContent}" from several genuinely different angles — not a flat list.

${styleInstructions}${langInstruction}

STRUCTURE REQUIREMENTS:
1. Generate ${maxPerLevel} DIVERSE main branches — distinct facets, not categories of the same thing.
2. Each main branch gets ${Math.max(1, maxPerLevel - 1)}-${maxPerLevel} children in "suggestedChildren" that explore it deeper.
3. Go ${depth} level(s) deep. For depth > 1, intermediate nodes MUST carry their own non-empty "suggestedChildren" — never stop at level 1.
4. VARY the structure — some branches deeper, some wider.

CONTENT REQUIREMENTS:
1. Mix categories across the tree (question, example, process, definition, fact, concept).
2. Include at least 1 question about why this matters or what's contested.
3. Include at least 1 concrete real-world example or case study (name it).
4. Use varied, accurate relationship types (causes, enables, opposes, part-of, …).
5. Children must GENUINELY explore their parent, not restate it.

AVOID: generic labels ("Types of X", "Benefits of X", "Overview", "Other"), every node the same category, uniform depth, and missing suggestedChildren on intermediate nodes.

Return ONLY valid JSON array.`

  const user = `## Node to Deep-Expand: "${nodeContent}"
${context.mapTitle ? `## Map Title: "${context.mapTitle}"` : ''}${domainContext}

## Existing Nodes (don't duplicate):
${formatExistingNodesContext(context)}

Create a ${depth}-level deep expansion tree. Each main branch should have its own children!

Return a JSON array where each object matches this schema:
{
  "title": "string (2-8 words, specific)",
  "description": {
    "summary": "string (insightful 1-2 sentences)",
    "keywords": ["string"]
  },
  "category": "concept" | "fact" | "question" | "example" | "definition" | "process",
  "relationshipToParent": "is-a" | "has-a" | "related-to" | "causes" | "enables" | "opposes" | "example-of" | "part-of" | "leads-to",
  "confidence": number (0-1),
  "suggestedChildren": [
    // REQUIRED for depth > 1! Same structure, recursively
  ]
}

Return ONLY the JSON array:`

  return { system, user }
}

/**
 * Build prompt for suggesting typed connections between existing nodes
 */
export function buildConnectionSuggestionPrompt(
  nodes: Array<{ id: string; content: string; description?: { summary: string } }>,
  existingEdges: Array<{ sourceId: string; targetId: string }>,
  maxSuggestions: number = 5,
  locale?: string
): { system: string; user: string } {
  const langInstruction = getLanguageInstruction(locale)
  const system = `You are an expert at uncovering the non-obvious relationships that turn a loose set of nodes into a connected knowledge graph. The best suggestions reveal a link the author hadn't drawn yet.${langInstruction}

IMPORTANT RULES:
1. Only suggest a connection that adds genuine insight — skip the trivial or already-implied.
2. Never suggest a connection that already exists (see the list below).
3. Pick the single most accurate relationshipType for the direction source → target.
4. The reason explains, in one specific sentence, why the link matters.
5. Assign confidence by how certain and meaningful the relationship is.
6. Return ONLY a valid JSON array, no additional text.`

  const nodesList = nodes
    .map(n => `- ID: "${n.id}" | Content: "${n.content}"${n.description?.summary ? ` | Summary: ${n.description.summary}` : ''}`)
    .join('\n')

  const existingList = existingEdges.length > 0
    ? existingEdges.map(e => `- ${e.sourceId} → ${e.targetId}`).join('\n')
    : 'None'

  const user = `## Nodes to Analyze:
${nodesList}

## Existing Connections (DO NOT suggest these):
${existingList}

Suggest up to ${maxSuggestions} meaningful new connections. Return a JSON array where each object matches this schema:
{
  "sourceId": "string (ID of source node)",
  "targetId": "string (ID of target node)",
  "relationshipType": "is-a" | "has-a" | "related-to" | "causes" | "enables" | "opposes" | "example-of" | "part-of" | "leads-to",
  "reason": "string (explanation of why this connection matters)",
  "confidence": number (0-1)
}

Return ONLY the JSON array:`

  return { system, user }
}

/**
 * Validate and parse relationship type from string
 */
export function parseRelationshipType(value: string): RelationshipType {
  const valid: RelationshipType[] = [
    'is-a', 'has-a', 'related-to', 'causes', 'enables',
    'opposes', 'example-of', 'part-of', 'leads-to',
    // v2 extended types
    'extends', 'implements', 'prerequisite-for', 'alternative-to',
    'evidence-for', 'evidence-against', 'depends-on', 'influences',
    'precedes', 'follows', 'co-occurs', 'trade-off',
    'stronger-than', 'complements'
  ]
  return valid.includes(value as RelationshipType)
    ? (value as RelationshipType)
    : 'related-to'
}

/**
 * Validate and parse node category from string
 */
export function parseNodeCategory(value: string): NodeCategory {
  const valid: NodeCategory[] = [
    'concept', 'fact', 'question', 'example', 'definition', 'process'
  ]
  return valid.includes(value as NodeCategory)
    ? (value as NodeCategory)
    : 'concept'
}

/**
 * Get display label for relationship type
 */
export function getRelationshipLabel(type: RelationshipType): string {
  const labels: Record<string, string> = {
    'is-a': 'Is A',
    'has-a': 'Has',
    'related-to': 'Related To',
    'causes': 'Causes',
    'enables': 'Enables',
    'opposes': 'Opposes',
    'example-of': 'Example Of',
    'part-of': 'Part Of',
    'leads-to': 'Leads To',
    // v2 extended types
    'extends': 'Extends',
    'implements': 'Implements',
    'prerequisite-for': 'Prerequisite For',
    'alternative-to': 'Alternative To',
    'evidence-for': 'Evidence For',
    'evidence-against': 'Evidence Against',
    'depends-on': 'Depends On',
    'influences': 'Influences',
    'precedes': 'Precedes',
    'follows': 'Follows',
    'co-occurs': 'Co-occurs',
    'trade-off': 'Trade-off',
    'stronger-than': 'Stronger Than',
    'complements': 'Complements'
  }
  return labels[type] || type
}

/**
 * Get display label for node category
 */
export function getCategoryLabel(category: NodeCategory): string {
  const labels: Record<NodeCategory, string> = {
    concept: 'Concept',
    fact: 'Fact',
    question: 'Question',
    example: 'Example',
    definition: 'Definition',
    process: 'Process'
  }
  return labels[category] || category
}

/**
 * Get icon class for node category
 */
export function getCategoryIcon(category: NodeCategory): string {
  const icons: Record<NodeCategory, string> = {
    concept: 'i-lucide-lightbulb',
    fact: 'i-lucide-check-circle',
    question: 'i-lucide-help-circle',
    example: 'i-lucide-code',
    definition: 'i-lucide-book-open',
    process: 'i-lucide-git-branch'
  }
  return icons[category] || 'i-lucide-circle'
}

/**
 * Get color for relationship type
 */
export function getRelationshipColor(type: RelationshipType): string {
  const colors: Record<string, string> = {
    'is-a': '#60A5FA',       // Blue
    'has-a': '#A78BFA',      // Purple
    'related-to': '#888890', // Gray
    'causes': '#F472B6',     // Pink
    'enables': '#4ADE80',    // Green
    'opposes': '#EF4444',    // Red
    'example-of': '#FB923C', // Orange
    'part-of': '#00D2BE',    // Teal
    'leads-to': '#FACC15',   // Yellow
    // v2 extended types
    'extends': '#818CF8',         // Indigo
    'implements': '#34D399',      // Emerald
    'prerequisite-for': '#F59E0B', // Amber
    'alternative-to': '#EC4899',  // Pink
    'evidence-for': '#10B981',    // Green
    'evidence-against': '#F43F5E', // Rose
    'depends-on': '#8B5CF6',      // Violet
    'influences': '#06B6D4',      // Cyan
    'precedes': '#D97706',        // Amber dark
    'follows': '#F97316',         // Orange
    'co-occurs': '#14B8A6',       // Teal
    'trade-off': '#E11D48',       // Rose
    'stronger-than': '#7C3AED',   // Purple
    'complements': '#059669'      // Emerald dark
  }
  return colors[type] || '#888890'
}
