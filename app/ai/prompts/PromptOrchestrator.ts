// Prompt Orchestrator — single entry point for ALL prompt construction

import type { RichContext } from '../types/context'
import type { AIBehaviorConfig, ThinkingMode } from '../types/cognitive'
import type { MapGenerationOptions } from '~/types/ai-generation'
import { selectPersona } from './SystemPersonas'
import { buildSmartExpandV2 } from './ExpandPrompts'
import { buildMapGenerationV2 } from './MapGenPrompts'
import { buildInsightAnalysisPrompt } from './InsightPrompts'
import { buildAgentSystemPrompt } from './AgentPrompts'
import { buildSelfEvaluationPrompt } from './MetaPrompts'

export type PromptRequestType = 'expand' | 'map-generate' | 'insight' | 'agent' | 'self-evaluate'

export interface PromptRequest {
  type: PromptRequestType
  context: RichContext
  // Type-specific params
  nodeContent?: string           // for expand
  mapGenerationOptions?: MapGenerationOptions  // for map-generate
  behavior?: AIBehaviorConfig    // for expand (cognitive mode)
  thinkingMode?: ThinkingMode    // for agent
  originalPrompt?: string        // for self-evaluate
  aiOutput?: string              // for self-evaluate
}

export interface AssembledPrompt {
  system: string
  user: string
  /** Recommended max tokens for this prompt type */
  maxTokens: number
  /** Recommended temperature */
  temperature: number
}

/** Default behavior config */
const DEFAULT_BEHAVIOR: AIBehaviorConfig = {
  suggestionCount: 5,
  temperature: 0.7,
  diversityWeight: 0.6,
  includeQuestions: true,
  includeWildcards: true,
  includeContrarian: false,
  validationStrictness: 'normal',
  suggestDeletions: false,
  suggestMerges: false
}

/**
 * Assemble a complete prompt from a request.
 * Pipeline: subject → persona → context → task-specific → meta
 */
export function assemblePrompt(request: PromptRequest): AssembledPrompt {
  const { type, context } = request

  // Select persona based on domain
  const persona = selectPersona(context.subject.domain)

  switch (type) {
    case 'expand': {
      const behavior = request.behavior || DEFAULT_BEHAVIOR
      const { system, user } = buildSmartExpandV2(
        request.nodeContent || '',
        context,
        persona,
        behavior,
        context.userHistory
      )
      return {
        system,
        user,
        maxTokens: 2000,
        temperature: behavior.temperature
      }
    }

    case 'map-generate': {
      const { system, user } = buildMapGenerationV2(
        request.nodeContent || context.mapTitle || 'Knowledge Map',
        context,
        persona,
        request.mapGenerationOptions
      )
      return {
        system,
        user,
        maxTokens: 4000,
        temperature: 0.7
      }
    }

    case 'insight': {
      const { system, user } = buildInsightAnalysisPrompt(context, persona)
      return {
        system,
        user,
        maxTokens: 2500,
        temperature: 0.6
      }
    }

    case 'agent': {
      const system = buildAgentSystemPrompt(context, persona, request.thinkingMode)
      return {
        system,
        user: '', // Agent user messages come from conversation
        maxTokens: 1500,
        temperature: 0.7
      }
    }

    case 'self-evaluate': {
      const { system, user } = buildSelfEvaluationPrompt(
        request.originalPrompt || '',
        request.aiOutput || '',
        context.subject.domain
      )
      return {
        system,
        user,
        maxTokens: 2000,
        temperature: 0.3
      }
    }

    default:
      throw new Error(`Unknown prompt type: ${type}`)
  }
}
