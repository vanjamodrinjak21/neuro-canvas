// Schema validation for the template generate/adapt endpoints.
// Pure zod validation — no DB, no Redis. Guards against the client/server
// `GenerationStyle` enum drift that caused 400s on `.../adapt` when the user
// picked the "academic" style (client offered it; server rejected it).

import { describe, it, expect } from 'vitest'
import { templateAdaptSchema, templateGenerateSchema } from '../validation'

// Canonical client type — keep in sync with app/types/ai-generation.ts:
//   export type GenerationStyle = 'concise' | 'detailed' | 'academic'
const GENERATION_STYLES = ['concise', 'detailed', 'academic'] as const

describe.each([
  ['templateAdaptSchema', templateAdaptSchema],
  ['templateGenerateSchema', templateGenerateSchema],
])('%s', (_name, schema) => {
  it('accepts every canonical GenerationStyle value', () => {
    for (const style of GENERATION_STYLES) {
      const result = schema.safeParse({ topic: 'SWOT analiza', style })
      expect(result.success, `style "${style}" should be valid`).toBe(true)
    }
  })

  it('rejects a style that is not a GenerationStyle', () => {
    const result = schema.safeParse({ topic: 'SWOT analiza', style: 'creative' })
    expect(result.success).toBe(false)
  })

  it('defaults style and depth when omitted', () => {
    const result = schema.safeParse({ topic: 'SWOT analiza' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(GENERATION_STYLES).toContain(result.data.style)
      expect(['shallow', 'medium', 'deep']).toContain(result.data.depth)
    }
  })
})
