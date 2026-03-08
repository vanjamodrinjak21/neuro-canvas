// Maps thinking modes to AI behavior configurations

import type { ThinkingMode, AIBehaviorConfig } from '../types/cognitive'

/**
 * Get the recommended AI behavior config for a given thinking mode.
 * Controls suggestion count, temperature, diversity, and feature flags.
 */
export function getAIBehaviorForMode(mode: ThinkingMode): AIBehaviorConfig {
  return BEHAVIOR_MAP[mode]
}

const BEHAVIOR_MAP: Record<ThinkingMode, AIBehaviorConfig> = {
  divergent: {
    suggestionCount: 7,
    temperature: 0.85,
    diversityWeight: 0.9,
    includeQuestions: true,
    includeWildcards: true,
    includeContrarian: false,
    validationStrictness: 'loose',
    suggestDeletions: false,
    suggestMerges: false
  },

  convergent: {
    suggestionCount: 3,
    temperature: 0.4,
    diversityWeight: 0.3,
    includeQuestions: false,
    includeWildcards: false,
    includeContrarian: false,
    validationStrictness: 'strict',
    suggestDeletions: true,
    suggestMerges: true
  },

  analytical: {
    suggestionCount: 5,
    temperature: 0.5,
    diversityWeight: 0.5,
    includeQuestions: true,
    includeWildcards: false,
    includeContrarian: false,
    validationStrictness: 'normal',
    suggestDeletions: false,
    suggestMerges: false
  },

  synthetic: {
    suggestionCount: 5,
    temperature: 0.7,
    diversityWeight: 0.7,
    includeQuestions: true,
    includeWildcards: true,
    includeContrarian: false,
    validationStrictness: 'normal',
    suggestDeletions: false,
    suggestMerges: true
  },

  evaluative: {
    suggestionCount: 4,
    temperature: 0.3,
    diversityWeight: 0.4,
    includeQuestions: true,
    includeWildcards: false,
    includeContrarian: true,
    validationStrictness: 'strict',
    suggestDeletions: true,
    suggestMerges: false
  },

  metacognitive: {
    suggestionCount: 4,
    temperature: 0.6,
    diversityWeight: 0.6,
    includeQuestions: true,
    includeWildcards: false,
    includeContrarian: true,
    validationStrictness: 'normal',
    suggestDeletions: true,
    suggestMerges: true
  }
}

/**
 * Get a human-readable description of the current mode behavior.
 */
export function describeBehavior(mode: ThinkingMode): string {
  const descriptions: Record<ThinkingMode, string> = {
    divergent: 'Generating many ideas — higher variety, more wildcards, more suggestions',
    convergent: 'Narrowing down — fewer but focused suggestions, may suggest deletions/merges',
    analytical: 'Breaking things down — moderate suggestions with deeper sub-topics',
    synthetic: 'Connecting ideas — cross-connections, pattern finding, merge suggestions',
    evaluative: 'Assessing quality — contrarian views, strict validation, deletion suggestions',
    metacognitive: 'Reflecting on structure — organizational suggestions, gap detection'
  }
  return descriptions[mode]
}
