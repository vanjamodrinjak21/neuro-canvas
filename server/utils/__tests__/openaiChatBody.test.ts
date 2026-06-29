import { describe, it, expect } from 'vitest'
import { openaiTokenParams } from '../openaiChatBody'

describe('openaiTokenParams', () => {
  it('uses max_completion_tokens and omits temperature for OpenAI GPT-5 models', () => {
    const p = openaiTokenParams('openai', 'gpt-5.4-mini', 16000, 0.7)
    expect(p).toEqual({ max_completion_tokens: 16000 })
    expect('max_tokens' in p).toBe(false)
    expect('temperature' in p).toBe(false)
  })

  it('omits temperature for OpenAI o-series reasoning models', () => {
    expect(openaiTokenParams('openai', 'o3-mini', 8000, 0.5)).toEqual({ max_completion_tokens: 8000 })
    expect(openaiTokenParams('openai', 'o1', 8000, 0.2)).toEqual({ max_completion_tokens: 8000 })
  })

  it('keeps temperature for non-reasoning OpenAI models but still uses max_completion_tokens', () => {
    const p = openaiTokenParams('openai', 'gpt-4o', 4000, 0.3)
    expect(p).toEqual({ max_completion_tokens: 4000, temperature: 0.3 })
  })

  it('keeps the classic max_tokens + temperature shape for openrouter', () => {
    const p = openaiTokenParams('openrouter', 'openai/gpt-5.4-mini', 16000, 0.7)
    expect(p).toEqual({ max_tokens: 16000, temperature: 0.7 })
  })

  it('keeps the classic shape for custom OpenAI-compatible servers', () => {
    const p = openaiTokenParams('custom', 'default', 2000, 0.6)
    expect(p).toEqual({ max_tokens: 2000, temperature: 0.6 })
  })

  it('omits temperature when none is provided', () => {
    expect(openaiTokenParams('openai', 'gpt-5.4', 12000)).toEqual({ max_completion_tokens: 12000 })
    expect(openaiTokenParams('openrouter', 'x', 12000)).toEqual({ max_tokens: 12000 })
  })
})
