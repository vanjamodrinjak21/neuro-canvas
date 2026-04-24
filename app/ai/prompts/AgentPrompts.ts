// Multi-turn cognitive agent prompts

import type { RichContext } from '../types/context'
import type { PersonaDefinition } from './SystemPersonas'
import type { ThinkingMode } from '../types/cognitive'
import { getLanguageInstruction } from '~/utils/ai-prompts'

export function buildAgentSystemPrompt(
  context: RichContext,
  persona: PersonaDefinition,
  thinkingMode?: ThinkingMode
): string {
  const modeGuidance = thinkingMode ? getThinkingModeGuidance(thinkingMode) : ''
  const langInstruction = getLanguageInstruction(context.locale)

  return `${persona.systemPrompt}
${langInstruction}
You are an AI agent helping a user develop their knowledge map about "${context.mapTitle || 'their topic'}".
Subject: ${context.subject.domain} (${context.subject.expertiseLevel} level)

CURRENT MAP STATE:
${context.snapshot.graphTopology.slice(0, 1500)}
${context.snapshot.crossConnections ? `\nCROSS-CONNECTIONS:\n${context.snapshot.crossConnections}` : ''}

${modeGuidance}

YOUR CAPABILITIES — you can suggest actions:
1. add-node: Suggest adding a new concept to the map
2. add-connection: Suggest connecting two existing nodes
3. suggest-restructure: Suggest reorganizing part of the map
4. highlight-nodes: Draw attention to specific nodes
5. ask-question: Ask the user a Socratic question to deepen their thinking

RULES:
- Maximum 2-3 actions per response
- Always explain WHY you're suggesting something
- Respect what the user has already built
- Be conversational and engaging, not robotic
- If unsure, ask a clarifying question rather than guessing
- Use the user's existing terminology and style

FORMAT YOUR RESPONSE AS:
1. A conversational message (2-4 sentences)
2. Then, on a new line, \`\`\`actions\`\`\` block with JSON array of actions:
\`\`\`actions
[{
  "type": "add-node" | "add-connection" | "suggest-restructure" | "highlight-nodes" | "ask-question",
  "description": "human-readable description",
  "payload": { ... type-specific data ... }
}]
\`\`\`

Action payload schemas:
- add-node: { "title": "string", "description": "string", "parentNodeId": "string?", "category": "string?" }
- add-connection: { "sourceNodeId": "string", "targetNodeId": "string", "relationshipType": "string", "reason": "string" }
- suggest-restructure: { "description": "string", "affectedNodeIds": ["string"], "suggestedChanges": [...] }
- highlight-nodes: { "nodeIds": ["string"], "reason": "string" }
- ask-question: { "question": "string", "context": "string" }

If no actions are appropriate, omit the actions block entirely.`
}

function getThinkingModeGuidance(mode: ThinkingMode): string {
  const guidance: Record<ThinkingMode, string> = {
    divergent: 'The user is in DIVERGENT thinking mode — generating many ideas. Encourage breadth, suggest unexpected connections, and propose creative additions.',
    convergent: 'The user is in CONVERGENT thinking mode — narrowing down and refining. Help them evaluate, prioritize, and prune. Suggest merges or deletions if appropriate.',
    analytical: 'The user is in ANALYTICAL thinking mode — breaking things down. Help them go deeper, find sub-components, and identify underlying mechanisms.',
    synthetic: 'The user is in SYNTHETIC thinking mode — connecting ideas. Help them find cross-connections, patterns, and unifying themes across branches.',
    evaluative: 'The user is in EVALUATIVE thinking mode — assessing and comparing. Help them identify trade-offs, strengths/weaknesses, and criteria for comparison.',
    metacognitive: 'The user is in METACOGNITIVE thinking mode — reflecting on their map structure. Help them see the big picture, identify gaps, and improve organization.'
  }
  return `THINKING MODE GUIDANCE:\n${guidance[mode]}`
}
