// Vue composable for multi-turn AI agent conversations

import { getCognitiveAgent } from '~/ai/engine/CognitiveAgent'
import type { AgentMessage, AgentAction } from '~/ai/types/agent'
import type { ThinkingMode } from '~/ai/types/cognitive'
import type { Node, Edge } from '~/types/canvas'

export function useAIAgent() {
  const agent = getCognitiveAgent()

  // Reactive state
  const isActive = ref(false)
  const isThinking = ref(false)
  const messages = ref<AgentMessage[]>([])
  const pendingActions = ref<AgentAction[]>([])
  const streamingContent = ref('')
  const error = ref<string | null>(null)

  /**
   * Start a new agent session.
   */
  async function startSession(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    mapTitle?: string,
    thinkingMode?: ThinkingMode
  ): Promise<void> {
    error.value = null
    try {
      await agent.startSession(nodes, edges, mapTitle, thinkingMode)
      isActive.value = true
      messages.value = []
      pendingActions.value = []
      streamingContent.value = ''
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to start session'
      throw e
    }
  }

  /**
   * Send a message to the agent. Streams response token-by-token.
   */
  async function sendMessage(text: string): Promise<void> {
    if (!isActive.value) {
      throw new Error('No active session')
    }

    error.value = null
    isThinking.value = true
    streamingContent.value = ''

    // Add user message immediately
    messages.value.push({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    })

    try {
      const { message, actions } = await agent.sendMessage(
        text,
        (_chunk, accumulated) => {
          streamingContent.value = accumulated
        }
      )

      // Clear streaming content and add final message
      streamingContent.value = ''
      messages.value.push(message)

      // Add pending actions
      if (actions.length > 0) {
        pendingActions.value.push(...actions)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to send message'
      // Add error message to chat
      messages.value.push({
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.value}`,
        timestamp: Date.now()
      })
    } finally {
      isThinking.value = false
    }
  }

  /**
   * Apply an agent action (user accepted it).
   */
  function applyAction(action: AgentAction): void {
    const idx = pendingActions.value.indexOf(action)
    if (idx !== -1) {
      pendingActions.value.splice(idx, 1)
    }
    // The actual map modification is handled by the parent component
    // which receives the action via the emitted event
  }

  /**
   * Dismiss an agent action (user rejected it).
   */
  function dismissAction(action: AgentAction): void {
    const idx = pendingActions.value.indexOf(action)
    if (idx !== -1) {
      pendingActions.value.splice(idx, 1)
    }
  }

  /**
   * End the current session.
   */
  function endSession(): void {
    agent.endSession()
    isActive.value = false
    messages.value = []
    pendingActions.value = []
    streamingContent.value = ''
    error.value = null
  }

  return {
    // State
    isActive: readonly(isActive),
    isThinking: readonly(isThinking),
    messages: readonly(messages),
    pendingActions: readonly(pendingActions),
    streamingContent: readonly(streamingContent),
    error: readonly(error),

    // Methods
    startSession,
    sendMessage,
    applyAction,
    dismissAction,
    endSession
  }
}
