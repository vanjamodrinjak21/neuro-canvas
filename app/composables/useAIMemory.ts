// Vue composable wrapping MemoryEngine
// Provides reactive state for user preference learning

import { getMemoryEngine, type UserMemoryData } from '~/ai/engine/MemoryEngine'
import { getCognitiveEngine } from '~/ai/engine/CognitiveEngine'
import { getAIBehaviorForMode, describeBehavior } from '~/ai/engine/CognitiveEngine.behavior'
import type { ThinkingMode, AIBehaviorConfig, UserAction } from '~/ai/types/cognitive'

export function useAIMemory() {
  const memory = getMemoryEngine()
  const cognitive = getCognitiveEngine()

  // Reactive state
  const currentMode = ref<ThinkingMode>('divergent')
  const modeConfidence = ref(0)
  const suggestedNextMode = ref<ThinkingMode | undefined>(undefined)
  const modeDescription = ref(describeBehavior('divergent'))
  const isLoaded = ref(false)

  // Load memory on init
  async function init(): Promise<void> {
    await memory.load()
    isLoaded.value = true
  }

  /**
   * Record a suggestion feedback (accepted/rejected).
   * Updates the memory engine and schedules persistence.
   */
  function recordSuggestionFeedback(
    suggestion: { title: string; category?: string; relationship?: string },
    accepted: boolean
  ): void {
    memory.recordFeedback(suggestion, accepted)

    // Also record as cognitive action
    cognitive.recordAction({
      type: accepted ? 'accept-suggestion' : 'reject-suggestion',
      timestamp: Date.now()
    })
    syncCognitiveState()
  }

  /**
   * Record a user action for cognitive mode detection.
   */
  function recordAction(action: UserAction): void {
    cognitive.recordAction(action)
    syncCognitiveState()
  }

  /**
   * Get the current AI behavior config based on detected thinking mode.
   */
  function getCurrentBehavior(): AIBehaviorConfig {
    return getAIBehaviorForMode(currentMode.value)
  }

  /**
   * Get user preferences for prompt injection.
   */
  function getUserPreferences() {
    return {
      style: memory.getStylePreferences(),
      topCategories: memory.getTopCategories(),
      rejectedSuggestions: memory.getRejectedSuggestions(),
      categoryWeights: memory.computeCategoryWeights()
    }
  }

  /**
   * Get domain expertise level from memory.
   */
  function getDomainExpertise(domain: string) {
    return memory.getDomainExpertise(domain)
  }

  /**
   * Record a domain session.
   */
  function recordDomain(domain: string, level: 'beginner' | 'intermediate' | 'advanced'): void {
    memory.recordDomain(domain, level)
  }

  /**
   * Get full memory data.
   */
  function getMemoryData(): UserMemoryData {
    return memory.getData()
  }

  /**
   * Force persist memory.
   */
  async function persist(): Promise<void> {
    await memory.persist()
  }

  function syncCognitiveState(): void {
    const state = cognitive.getState()
    currentMode.value = state.currentMode
    modeConfidence.value = state.confidence
    suggestedNextMode.value = state.suggestedNextMode ?? undefined
    modeDescription.value = describeBehavior(state.currentMode)
  }

  // Auto-load when in browser
  if (typeof window !== 'undefined') {
    init()
  }

  return {
    // Reactive state
    currentMode: readonly(currentMode),
    modeConfidence: readonly(modeConfidence),
    suggestedNextMode: readonly(suggestedNextMode),
    modeDescription: readonly(modeDescription),
    isLoaded: readonly(isLoaded),

    // Methods
    init,
    recordSuggestionFeedback,
    recordAction,
    getCurrentBehavior,
    getUserPreferences,
    getDomainExpertise,
    recordDomain,
    getMemoryData,
    persist
  }
}
