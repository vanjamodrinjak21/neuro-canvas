/**
 * AI Settings Types for BYOK (Bring Your Own Key) system
 */

export type AIProviderType = 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'custom' | 'local'

export interface AIModel {
  id: string
  name: string
  contextLength?: number
  maxOutputTokens?: number
  isVision?: boolean
}

export interface AIProviderConfig {
  id: string
  type: AIProviderType
  name: string
  credentialId?: string // Server vault credential ID
  localApiKey?: string  // Tauri desktop: API key stored locally in IndexedDB
  baseUrl?: string // For custom/Ollama providers
  models: AIModel[]
  selectedModelId?: string
  isEnabled: boolean
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export interface PersonaConfig {
  id: string
  name: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  isDefault: boolean
  providerId?: string // Optional: specific provider for this persona
  modelId?: string // Optional: specific model for this persona
  /** Optional domain override for persona-specific subject handling */
  domainOverride?: import('~/ai/types/subject').DomainType
  createdAt: number
  updatedAt: number
}

export interface AISettings {
  providers: AIProviderConfig[]
  personas: PersonaConfig[]
  defaultProviderId?: string
  defaultPersonaId?: string
  preferences: {
    autoSuggestConnections: boolean
    semanticFieldEnabled: boolean
    similarityThreshold: number
    /** Enable v2 rich context engine */
    useV2Context?: boolean
    /** Enable v2 prompt orchestration with personas */
    useV2Prompts?: boolean
    /** Enable SSE streaming for AI operations */
    useStreaming?: boolean
    /** Enable LLM-powered insights (requires provider) */
    useLLMInsights?: boolean
    /** Which embedding model variant to use (Tauri only) */
    embeddingModel?: 'quantized' | 'full'
  }
  updatedAt: number
}

// Built-in provider templates
export const PROVIDER_TEMPLATES: Record<AIProviderType, Partial<AIProviderConfig>> = {
  openai: {
    type: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1', contextLength: 1000000, maxOutputTokens: 32768, isVision: true },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextLength: 1000000, maxOutputTokens: 32768, isVision: true },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', contextLength: 1000000, maxOutputTokens: 32768, isVision: true },
      { id: 'o4-mini', name: 'o4-mini (Reasoning)', contextLength: 200000, maxOutputTokens: 100000, isVision: true },
      { id: 'o3-mini', name: 'o3-mini (Reasoning)', contextLength: 200000, maxOutputTokens: 100000, isVision: true },
      { id: 'gpt-4o', name: 'GPT-4o (Audio)', contextLength: 128000, maxOutputTokens: 16384, isVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextLength: 128000, maxOutputTokens: 16384, isVision: true }
    ]
  },
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', contextLength: 1000000, maxOutputTokens: 64000, isVision: true },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextLength: 200000, maxOutputTokens: 64000, isVision: true },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextLength: 200000, maxOutputTokens: 64000, isVision: true },
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', contextLength: 200000, maxOutputTokens: 64000, isVision: true },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', contextLength: 200000, maxOutputTokens: 64000, isVision: true }
    ]
  },
  ollama: {
    type: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    models: [] // Dynamically loaded from server
  },
  openrouter: {
    type: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [] // Dynamically loaded from API
  },
  custom: {
    type: 'custom',
    name: 'Custom Provider',
    baseUrl: '',
    models: []
  },
  local: {
    type: 'local',
    name: 'Gemma 4 (On-Device)',
    models: [
      { id: 'gemma4-2b', name: 'Gemma 4 2B', contextLength: 4096, maxOutputTokens: 2048 }
    ]
  }
}

// Default Mind Map Assistant persona
export const DEFAULT_PERSONA: Omit<PersonaConfig, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Mind Map Assistant',
  systemPrompt: `You are a helpful mind mapping assistant. Your role is to:
- Help users brainstorm and expand their ideas
- Suggest meaningful connections between concepts
- Provide concise, relevant suggestions (1-5 words per node)
- Maintain context awareness of the entire map
- Focus on clarity and organization of thoughts

When suggesting nodes, keep them brief and actionable. When explaining connections, be specific about the relationship.`,
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  isDefault: true
}

// Default AI Settings
export const DEFAULT_AI_SETTINGS: Omit<AISettings, 'updatedAt'> = {
  providers: [],
  personas: [],
  defaultProviderId: undefined,
  defaultPersonaId: undefined,
  preferences: {
    autoSuggestConnections: true,
    semanticFieldEnabled: true,
    similarityThreshold: 0.3,
    embeddingModel: 'quantized'
  }
}
