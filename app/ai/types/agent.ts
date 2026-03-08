// Multi-Turn Cognitive Agent Types

import type { ThinkingMode } from './cognitive'
import type { SubjectProfile } from './subject'

export type AgentActionType =
  | 'add-node'
  | 'add-connection'
  | 'suggest-restructure'
  | 'highlight-nodes'
  | 'ask-question'

export interface AgentAction {
  type: AgentActionType
  /** Human-readable description of the action */
  description: string
  /** Action-specific payload */
  payload: AgentAddNodePayload | AgentAddConnectionPayload
    | AgentRestructurePayload | AgentHighlightPayload | AgentQuestionPayload
}

export interface AgentAddNodePayload {
  title: string
  description?: string
  parentNodeId?: string
  category?: string
  keywords?: string[]
}

export interface AgentAddConnectionPayload {
  sourceNodeId: string
  targetNodeId: string
  relationshipType: string
  reason: string
}

export interface AgentRestructurePayload {
  description: string
  affectedNodeIds: string[]
  suggestedChanges: Array<{
    nodeId: string
    action: 'move' | 'merge' | 'split' | 'reparent'
    details: string
  }>
}

export interface AgentHighlightPayload {
  nodeIds: string[]
  reason: string
}

export interface AgentQuestionPayload {
  question: string
  options?: string[]
  context: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: AgentAction[]
  timestamp: number
}

export interface AgentSession {
  id: string
  mapId: string
  subject?: SubjectProfile
  thinkingMode?: ThinkingMode
  messages: AgentMessage[]
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface AgentConversation {
  /** Messages for LLM context (system + history) */
  messages: Array<{ role: string; content: string }>
  /** Current session state */
  session: AgentSession
}
