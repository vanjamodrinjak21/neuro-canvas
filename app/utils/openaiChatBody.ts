/**
 * OpenAI-family chat-completions parameter shaping (client/native mirror of
 * server/utils/openaiChatBody.ts — keep the two in sync).
 *
 * GPT-5 / o-series on api.openai.com reject the legacy `max_tokens` (they
 * require `max_completion_tokens`) and reject any non-default `temperature`
 * (only the default `1` is allowed). The native shell (Tauri/Capacitor) calls
 * OpenAI directly, so it needs the same shaping the server applies to bring
 * OpenAI to parity with Claude. OpenRouter / custom servers keep the classic
 * `max_tokens` + `temperature` shape.
 */

const OPENAI_REASONING = /^(?:o\d|gpt-5)/i

export function openaiTokenParams(
  provider: string,
  model: string,
  maxTokens: number,
  temperature?: number
): Record<string, number> {
  if (provider === 'openai') {
    const params: Record<string, number> = { max_completion_tokens: maxTokens }
    if (temperature !== undefined && !OPENAI_REASONING.test(model || '')) {
      params.temperature = temperature
    }
    return params
  }
  const params: Record<string, number> = { max_tokens: maxTokens }
  if (temperature !== undefined) params.temperature = temperature
  return params
}
