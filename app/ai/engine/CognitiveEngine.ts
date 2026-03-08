// Cognitive Pattern Recognition Engine
// Detects user thinking modes from behavioral signals

import type { ThinkingMode, CognitiveState, UserAction } from '../types/cognitive'

type ActionType = UserAction['type']

interface ActionRecord {
  actionType: ActionType
  timestamp: number
}

const WINDOW_SIZE = 20
const CONFIDENCE_THRESHOLD = 0.4

/**
 * Signal weights for each thinking mode.
 * Each action type contributes to one or more modes.
 */
const MODE_SIGNALS: Record<string, Partial<Record<ThinkingMode, number>>> = {
  'create-node': { divergent: 0.8, analytical: 0.3 },
  'delete-node': { convergent: 0.9, evaluative: 0.3 },
  'edit-node': { analytical: 0.4 },
  'create-edge': { synthetic: 0.8, analytical: 0.3 },
  'delete-edge': { convergent: 0.5, evaluative: 0.3 },
  'expand-node': { divergent: 0.6, analytical: 0.5 },
  'accept-suggestion': { divergent: 0.3 },
  'reject-suggestion': { convergent: 0.7, evaluative: 0.5 },
  'search': { metacognitive: 0.6, analytical: 0.3 },
  'overview': { metacognitive: 0.7 },
  'undo': { evaluative: 0.4 },
  'redo': { evaluative: 0.2 }
}

/**
 * Temporal patterns: rapid consecutive actions of the same type
 * boost the associated mode.
 */
function computeTemporalBoost(actions: ActionRecord[]): Partial<Record<ThinkingMode, number>> {
  const boost: Partial<Record<ThinkingMode, number>> = {}
  if (actions.length < 3) return boost

  let consecutiveCount = 0
  let lastType = actions[0]?.actionType

  for (let i = 1; i < actions.length; i++) {
    const curr = actions[i]!
    const prev = actions[i - 1]!
    const timeDiff = curr.timestamp - prev.timestamp
    if (curr.actionType === lastType && timeDiff < 3000) {
      consecutiveCount++
    } else {
      consecutiveCount = 0
      lastType = curr.actionType
    }

    if (consecutiveCount >= 2 && lastType) {
      const signals = MODE_SIGNALS[lastType]
      if (signals) {
        for (const [mode, weight] of Object.entries(signals)) {
          const m = mode as ThinkingMode
          boost[m] = (boost[m] || 0) + (weight as number) * 0.3
        }
      }
    }
  }

  return boost
}

export class CognitiveEngine {
  private actionHistory: ActionRecord[] = []
  private modeTransitions: Array<{ mode: ThinkingMode; timestamp: number; trigger: string }> = []
  private currentState: CognitiveState = {
    currentMode: 'divergent',
    confidence: 0,
    modeHistory: [],
    suggestedNextMode: undefined
  }

  /**
   * Record a user action for cognitive analysis.
   */
  recordAction(action: UserAction): void {
    this.actionHistory.push({
      actionType: action.type,
      timestamp: action.timestamp || Date.now()
    })

    if (this.actionHistory.length > WINDOW_SIZE * 2) {
      this.actionHistory = this.actionHistory.slice(-WINDOW_SIZE)
    }

    this.recompute(action.type)
  }

  /**
   * Get the current cognitive state.
   */
  getState(): CognitiveState {
    return { ...this.currentState }
  }

  /**
   * Get the current detected thinking mode.
   */
  getCurrentMode(): ThinkingMode {
    return this.currentState.currentMode
  }

  /**
   * Get confidence in the current mode detection.
   */
  getConfidence(): number {
    return this.currentState.confidence
  }

  /**
   * Reset the engine state.
   */
  reset(): void {
    this.actionHistory = []
    this.modeTransitions = []
    this.currentState = {
      currentMode: 'divergent',
      confidence: 0,
      modeHistory: [],
      suggestedNextMode: undefined
    }
  }

  private recompute(trigger: string): void {
    const recentActions = this.actionHistory.slice(-WINDOW_SIZE)
    if (recentActions.length < 2) return

    const scores: Record<ThinkingMode, number> = {
      divergent: 0,
      convergent: 0,
      analytical: 0,
      synthetic: 0,
      evaluative: 0,
      metacognitive: 0
    }

    const now = Date.now()
    for (const record of recentActions) {
      const age = (now - record.timestamp) / 1000
      const recencyWeight = Math.exp(-age / 60)
      const signals = MODE_SIGNALS[record.actionType]

      if (signals) {
        for (const [mode, weight] of Object.entries(signals)) {
          scores[mode as ThinkingMode] += (weight as number) * recencyWeight
        }
      }
    }

    const boost = computeTemporalBoost(recentActions)
    for (const [mode, val] of Object.entries(boost)) {
      scores[mode as ThinkingMode] += val as number
    }

    let maxScore = 0
    let dominantMode: ThinkingMode = 'divergent'
    let totalScore = 0

    for (const [mode, score] of Object.entries(scores)) {
      totalScore += score
      if (score > maxScore) {
        maxScore = score
        dominantMode = mode as ThinkingMode
      }
    }

    const confidence = totalScore > 0 ? maxScore / totalScore : 0

    if (confidence >= CONFIDENCE_THRESHOLD) {
      if (dominantMode !== this.currentState.currentMode) {
        this.modeTransitions.push({ mode: dominantMode, timestamp: now, trigger })
      }

      this.currentState = {
        currentMode: dominantMode,
        confidence,
        modeHistory: this.modeTransitions.slice(-10),
        suggestedNextMode: this.suggestNextMode(dominantMode, scores)
      }
    }
  }

  private suggestNextMode(
    current: ThinkingMode,
    scores: Record<ThinkingMode, number>
  ): ThinkingMode | undefined {
    const transitions: Record<ThinkingMode, ThinkingMode[]> = {
      divergent: ['convergent', 'synthetic'],
      convergent: ['analytical', 'evaluative'],
      analytical: ['synthetic', 'divergent'],
      synthetic: ['evaluative', 'metacognitive'],
      evaluative: ['metacognitive', 'divergent'],
      metacognitive: ['divergent', 'analytical']
    }

    const candidates = transitions[current]
    if (!candidates) return undefined

    let best: ThinkingMode | undefined
    let bestScore = -1

    for (const candidate of candidates) {
      if ((scores[candidate] || 0) > bestScore) {
        bestScore = scores[candidate] || 0
        best = candidate
      }
    }

    return best
  }
}

// Singleton
let _instance: CognitiveEngine | null = null

export function getCognitiveEngine(): CognitiveEngine {
  if (!_instance) {
    _instance = new CognitiveEngine()
  }
  return _instance
}
