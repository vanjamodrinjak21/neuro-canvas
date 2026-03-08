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
 * Get style-specific instructions for prompts
 */
function getStyleInstructions(style: GenerationStyle): string {
  switch (style) {
    case 'concise':
      return 'Keep descriptions brief and to the point. Focus on key facts.'
    case 'detailed':
      return 'Provide thorough explanations with context and nuance.'
    case 'academic':
      return 'Use formal academic language with precise terminology. Include scholarly context.'
    default:
      return ''
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

  const system = `You are an expert mind mapping assistant who generates DIVERSE, INTERESTING concept suggestions. Don't just list obvious subcategories - provide a MIX of:
- Deeper explorations (what lies beneath this concept?)
- Practical applications (how is this used in real life?)
- Thought-provoking questions (what's controversial or unknown?)
- Concrete examples (specific instances, not abstract)
- Surprising connections (what unexpected things relate?)

${styleInstructions}

CRITICAL REQUIREMENTS:
1. Generate exactly ${maxSuggestions} suggestions with VARIED categories
2. Include at least 1 question and 1 example in your suggestions
3. Titles should be 2-8 words, SPECIFIC not generic
4. Descriptions must explain WHY it matters and HOW it connects
5. Use diverse relationship types (not all "related-to")
6. Avoid generic/obvious suggestions - surprise the user!
7. Don't repeat concepts from existing nodes
8. Return ONLY valid JSON array`

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
  style: GenerationStyle = 'detailed'
): { system: string; user: string } {
  const styleInstructions = getStyleInstructions(style)

  const system = `You are an expert knowledge synthesizer. Generate clear, informative descriptions for mind map nodes.

${styleInstructions}

IMPORTANT RULES:
1. The summary should explain WHY this concept matters, not just define it
2. Keywords should be useful for searching and categorization
3. Consider the surrounding context when crafting the description
4. Return ONLY valid JSON, no additional text`

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
    domain
  } = options

  const styleInstructions = getStyleInstructions(style)
  const domainContext = domain ? `\nDomain/Subject Area: ${domain}` : ''

  // Calculate complexity based on depth setting
  const minChildren = maxDepth >= 2 ? 2 : 1
  const maxChildren = maxDepth >= 3 ? 4 : 3
  const crossConnectionCount = includeCrossConnections ? Math.min(branchCount, 5) : 0

  const system = `You are an expert mind mapping architect who creates rich, interconnected knowledge maps. Your maps should be visually interesting with varied structure - NOT a boring flat hierarchy.

${styleInstructions}

CRITICAL STRUCTURE REQUIREMENTS:
1. Create ${branchCount} main branches with VARIED depths (some shallow, some deep)
2. Each branch should have ${minChildren}-${maxChildren} children, and grandchildren where appropriate
3. VARY the number of children per branch - don't make them all identical!
4. Use ALL category types across the map (concept, fact, question, example, definition, process)
5. Include thought-provoking questions and concrete examples, not just abstract concepts
${includeCrossConnections ? `6. Include ${crossConnectionCount}+ meaningful cross-connections between different branches` : ''}

STRUCTURE VARIETY GUIDELINES:
- Some branches should be deep (3+ levels) exploring details
- Some branches should be wide (4+ children) covering breadth
- Include at least 2 "question" nodes to spark curiosity
- Include at least 2 "example" nodes with real-world instances
- Make connections between seemingly unrelated branches
- Total nodes should be ${branchCount * 4}-${branchCount * 6} for an interesting map

AVOID:
- Uniform flat structures (1 root + N identical branches)
- All nodes being the same category
- Generic/vague descriptions
- Missing cross-connections between related concepts

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

Create a RICH, INTERESTING mind map with varied structure. Remember:
- Vary branch depths (some 1 level, some 2-3 levels deep)
- Mix categories (concepts, facts, questions, examples, definitions, processes)
- Include surprising connections between branches
- Make it visually interesting, not a flat boring tree!

Return JSON matching this schema:
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

  const system = `You are an expert mind mapping assistant creating RICH hierarchical expansions. Your output should create a mini-knowledge tree that explores "${nodeContent}" from multiple angles.

${styleInstructions}

STRUCTURE REQUIREMENTS:
1. Generate ${maxPerLevel} DIVERSE main branches (not just categories!)
2. Each branch gets ${maxPerLevel - 1}-${maxPerLevel} children exploring it deeper
3. Depth: ${depth} levels - use ALL levels, don't stop at 1
4. VARY the structure - some branches deeper, some wider

CONTENT REQUIREMENTS:
1. Mix categories across the tree (questions, examples, processes, etc.)
2. Include at least 1 "Why does this matter?" type question
3. Include at least 1 real-world example or case study
4. Use varied relationship types (causes, enables, opposes, etc.)
5. Make children GENUINELY explore their parent, not just restate it

AVOID:
- Generic labels like "Types of X", "Benefits of X"
- All nodes being the same category
- Flat structures (every branch same depth)
- Missing suggestedChildren on intermediate nodes

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
  maxSuggestions: number = 5
): { system: string; user: string } {
  const system = `You are an expert at discovering meaningful relationships between concepts. Analyze nodes and suggest connections that reveal hidden relationships and create a more interconnected knowledge graph.

IMPORTANT RULES:
1. Only suggest connections that add genuine insight
2. Don't suggest connections that already exist
3. Choose the most accurate relationship type
4. Explain WHY the connection is meaningful
5. Assign confidence based on how certain the relationship is
6. Return ONLY valid JSON array, no additional text`

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
