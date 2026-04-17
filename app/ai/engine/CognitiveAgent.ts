// Multi-turn Cognitive Agent
// Manages conversation sessions with map context awareness

import type { AgentSession, AgentMessage, AgentAction, AgentActionType } from '../types/agent'
import type { ThinkingMode } from '../types/cognitive'
import { assemblePrompt } from '../prompts/PromptOrchestrator'
import { buildContext } from './ContextEngine'
import { streamCompletion } from '../pipeline/StreamingPipeline'
import { resolveProvider } from '../utils/resolveProvider'
import type { ResolvedProvider } from '../utils/resolveProvider'
import type { Node, Edge } from '~/types/canvas'

const VALID_ACTION_TYPES = new Set<string>([
  'add-node', 'add-connection', 'suggest-restructure', 'highlight-nodes', 'ask-question'
])

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Parse agent response to extract actions from ```actions code blocks.
 */
function parseAgentResponse(response: string): { text: string; actions: AgentAction[] } {
  const actionsMatch = response.match(/```actions\s*([\s\S]*?)```/)
  const text = response.replace(/```actions[\s\S]*?```/, '').trim()

  let actions: AgentAction[] = []
  if (actionsMatch && actionsMatch[1]) {
    try {
      const parsed = JSON.parse(actionsMatch[1])
      if (Array.isArray(parsed)) {
        actions = parsed
          .filter(a => a && typeof a === 'object' && VALID_ACTION_TYPES.has(a.type))
          .slice(0, 3)
          .map(a => ({
            type: a.type as AgentActionType,
            description: a.description || '',
            payload: a.payload || {}
          }))
      }
    } catch {
      // Couldn't parse actions block
    }
  }

  return { text, actions }
}

export class CognitiveAgent {
  private session: AgentSession | null = null
  private provider: ResolvedProvider | null = null
  private systemPrompt: string = ''

  /**
   * Start a new agent session with map context.
   */
  async startSession(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    mapTitle?: string,
    thinkingMode?: ThinkingMode
  ): Promise<AgentSession> {
    this.provider = await resolveProvider()

    // Build Maps for ContextEngine
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
      operation: 'restructure' // closest to 'explore'
    }, this.provider)

    // Assemble agent system prompt
    const { system } = assemblePrompt({
      type: 'agent',
      context,
      thinkingMode
    })

    this.systemPrompt = system
    const now = Date.now()

    this.session = {
      id: `agent-${now}`,
      mapId: mapTitle || 'current',
      subject: context.subject,
      thinkingMode,
      messages: [],
      isActive: true,
      createdAt: now,
      updatedAt: now
    }

    return this.session
  }

  /**
   * Send a user message and get agent response with streaming.
   */
  async sendMessage(
    userText: string,
    onDelta?: (chunk: string, accumulated: string) => void
  ): Promise<{ message: AgentMessage; actions: AgentAction[] }> {
    if (!this.session || !this.provider) {
      throw new Error('No active session. Call startSession() first.')
    }

    // Add user message
    const userMessage: AgentMessage = {
      id: generateId(),
      role: 'user',
      content: userText,
      timestamp: Date.now()
    }
    this.session.messages.push(userMessage)
    this.session.updatedAt = Date.now()

    // Build messages array for API
    const apiMessages = this.session.messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    // Stream response
    const fullContent = await streamCompletion(
      {
        provider: this.provider.type,
        credentialId: this.provider.credentialId,
        baseUrl: this.provider.baseUrl,
        model: this.provider.selectedModelId,
        systemPrompt: this.systemPrompt,
        messages: apiMessages,
        maxTokens: 1500,
        temperature: 0.7
      },
      {
        onDelta: (chunk, accumulated) => {
          onDelta?.(chunk, accumulated)
        }
      }
    )

    // Parse response for actions
    const { text, actions } = parseAgentResponse(fullContent)

    // Add assistant message
    const assistantMessage: AgentMessage = {
      id: generateId(),
      role: 'assistant',
      content: text,
      timestamp: Date.now(),
      actions: actions.length > 0 ? actions : undefined
    }
    this.session.messages.push(assistantMessage)
    this.session.updatedAt = Date.now()

    return { message: assistantMessage, actions }
  }

  /**
   * Get the current session.
   */
  getSession(): AgentSession | null {
    return this.session
  }

  /**
   * End the current session.
   */
  endSession(): void {
    if (this.session) {
      this.session.isActive = false
    }
    this.session = null
    this.provider = null
    this.systemPrompt = ''
  }

  /**
   * Check if a session is active.
   */
  isActive(): boolean {
    return this.session !== null && this.session.isActive
  }
}

// Singleton
let _instance: CognitiveAgent | null = null

export function getCognitiveAgent(): CognitiveAgent {
  if (!_instance) {
    _instance = new CognitiveAgent()
  }
  return _instance
}
