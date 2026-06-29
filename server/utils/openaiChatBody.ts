/**
 * OpenAI-family chat-completions parameter shaping.
 *
 * Why this exists: GPT-5 and the o-series on api.openai.com changed the
 * /chat/completions contract. They REJECT the legacy `max_tokens` (they
 * require `max_completion_tokens`) and REJECT any non-default `temperature`
 * (only the default value `1` is allowed). The app defaults OpenAI to
 * `gpt-5.4-mini`/`gpt-5.4` yet sent BOTH `max_tokens` and a custom
 * `temperature` at every call site, so every OpenAI generation 400'd and
 * surfaced as a generic 502 — while Anthropic worked. This brings OpenAI to
 * full parity with Claude by emitting the right params per provider + model.
 *
 * OpenRouter and custom OpenAI-compatible servers (vLLM, LM Studio, Ollama's
 * OpenAI endpoint, …) keep the classic `max_tokens` + `temperature` shape
 * they expect; OpenRouter normalizes/drops unsupported params upstream.
 *
 * Ref: OpenAI deprecated `max_tokens` for `max_completion_tokens` (Sep 2024);
 * GPT-5 / o-series additionally lock `temperature` to the default.
 */

/** Models on the OpenAI endpoint that reject `max_tokens` and custom temperature. */
const OPENAI_REASONING = /^(?:o\d|gpt-5)/i

export function openaiTokenParams(
  provider: string,
  model: string,
  maxTokens: number,
  temperature?: number
): Record<string, number> {
  if (provider === 'openai') {
    // GPT-5 / o-series require `max_completion_tokens`; it is also accepted by
    // gpt-4o / gpt-4.1, so use it for all OpenAI requests.
    const params: Record<string, number> = { max_completion_tokens: maxTokens }
    // Reasoning models accept ONLY the default temperature — omit it entirely.
    if (temperature !== undefined && !OPENAI_REASONING.test(model || '')) {
      params.temperature = temperature
    }
    return params
  }

  // openrouter / custom — classic OpenAI-compatible shape.
  const params: Record<string, number> = { max_tokens: maxTokens }
  if (temperature !== undefined) params.temperature = temperature
  return params
}
