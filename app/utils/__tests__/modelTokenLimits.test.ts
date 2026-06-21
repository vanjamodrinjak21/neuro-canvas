import { describe, it, expect } from 'vitest'
import { getMaxOutputTokens } from '../modelTokenLimits'

describe('getMaxOutputTokens — dynamic tokenization', () => {
  it('gives map generation a much larger non-streaming budget than the old 4000 cap', () => {
    const sonnet = getMaxOutputTokens('anthropic', 'claude-sonnet-4-6', 'map')
    expect(sonnet).toBe(16_000) // clamped to the non-streaming ceiling
    expect(sonnet).toBeGreaterThan(4000)
  })

  it('lifts the budget for streaming and scales it up for bigger models', () => {
    expect(getMaxOutputTokens('anthropic', 'claude-sonnet-4-6', 'map', { streaming: true })).toBe(48_000)
    expect(getMaxOutputTokens('anthropic', 'claude-opus-4-8', 'map', { streaming: true })).toBe(64_000)
  })

  it('treats small / cheap variants more conservatively than frontier models', () => {
    expect(getMaxOutputTokens('openai', 'gpt-5.4-mini', 'map', { streaming: true })).toBe(16_000)
    expect(getMaxOutputTokens('openai', 'gpt-5.4', 'map', { streaming: true })).toBe(32_000)
  })

  it('keeps on-device / ollama models small so they do not choke on huge JSON', () => {
    expect(getMaxOutputTokens('ollama', undefined, 'map')).toBe(4_000)
    expect(getMaxOutputTokens('local', 'local', 'map')).toBe(4_000)
  })

  it('clamps native shells to keep mobile memory in check', () => {
    expect(getMaxOutputTokens('anthropic', 'claude-opus-4-8', 'map', { streaming: true, nativeShell: true })).toBe(8_000)
  })

  it('sizes smaller tasks below map generation', () => {
    const map = getMaxOutputTokens('anthropic', 'claude-sonnet-4-6', 'map')
    const expand = getMaxOutputTokens('anthropic', 'claude-sonnet-4-6', 'expand')
    const describe = getMaxOutputTokens('anthropic', 'claude-sonnet-4-6', 'describe')
    expect(expand).toBeLessThanOrEqual(map)
    expect(describe).toBeLessThan(expand)
    expect(describe).toBeGreaterThanOrEqual(600)
  })
})
