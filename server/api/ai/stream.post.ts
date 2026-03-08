/**
 * AI Streaming Proxy API
 * SSE streaming endpoint for AI providers
 */

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { provider, apiKey, model, messages, systemPrompt, maxTokens = 500, temperature = 0.7 } = body

  if (!provider || !apiKey) {
    throw createError({ statusCode: 400, message: 'Missing provider or apiKey' })
  }

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const responseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function sendEvent(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        switch (provider) {
          case 'openai':
          case 'openrouter':
          case 'custom': {
            const baseUrl = body.baseUrl || (provider === 'openrouter'
              ? 'https://openrouter.ai/api/v1'
              : provider === 'custom' ? body.baseUrl : 'https://api.openai.com/v1')

            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                ...(provider === 'openrouter' && {
                  'HTTP-Referer': 'https://neuro-canvas.com',
                  'X-Title': 'NeuroCanvas'
                })
              },
              body: JSON.stringify({
                model: model || (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
                messages: systemPrompt
                  ? [{ role: 'system', content: systemPrompt }, ...messages]
                  : messages,
                temperature,
                max_tokens: maxTokens,
                stream: true
              })
            })

            if (!response.ok) {
              const err = await response.json().catch(() => ({}))
              sendEvent({ type: 'error', message: err.error?.message || `API error: ${response.status}` })
              controller.close()
              return
            }

            const reader = response.body?.getReader()
            if (!reader) {
              sendEvent({ type: 'error', message: 'No response body' })
              controller.close()
              return
            }

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim()
                  if (data === '[DONE]') {
                    sendEvent({ type: 'done', usage: null })
                    continue
                  }
                  try {
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content
                    if (content) {
                      sendEvent({ type: 'delta', content })
                    }
                    if (parsed.usage) {
                      sendEvent({ type: 'done', usage: parsed.usage })
                    }
                  } catch {
                    // Skip malformed SSE data
                  }
                }
              }
            }

            sendEvent({ type: 'done', usage: null })
            break
          }

          case 'anthropic': {
            const baseUrl = body.baseUrl || 'https://api.anthropic.com/v1'

            const response = await fetch(`${baseUrl}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: model || 'claude-sonnet-4-20250514',
                max_tokens: maxTokens,
                system: systemPrompt,
                messages,
                stream: true
              })
            })

            if (!response.ok) {
              const err = await response.json().catch(() => ({}))
              sendEvent({ type: 'error', message: err.error?.message || `API error: ${response.status}` })
              controller.close()
              return
            }

            const reader = response.body?.getReader()
            if (!reader) {
              sendEvent({ type: 'error', message: 'No response body' })
              controller.close()
              return
            }

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const parsed = JSON.parse(line.slice(6))
                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                      sendEvent({ type: 'delta', content: parsed.delta.text })
                    }
                    if (parsed.type === 'message_delta' && parsed.usage) {
                      sendEvent({ type: 'done', usage: parsed.usage })
                    }
                    if (parsed.type === 'message_stop') {
                      sendEvent({ type: 'done', usage: null })
                    }
                  } catch {
                    // Skip malformed lines
                  }
                }
              }
            }

            sendEvent({ type: 'done', usage: null })
            break
          }

          case 'ollama': {
            const baseUrl = body.baseUrl || 'http://localhost:11434'

            const response = await fetch(`${baseUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: model || 'llama3.2',
                messages: systemPrompt
                  ? [{ role: 'system', content: systemPrompt }, ...messages]
                  : messages,
                stream: true
              })
            })

            if (!response.ok) {
              sendEvent({ type: 'error', message: `Ollama error: ${response.status}` })
              controller.close()
              return
            }

            const reader = response.body?.getReader()
            if (!reader) {
              sendEvent({ type: 'error', message: 'No response body' })
              controller.close()
              return
            }

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (!line.trim()) continue
                try {
                  const parsed = JSON.parse(line)
                  if (parsed.message?.content) {
                    sendEvent({ type: 'delta', content: parsed.message.content })
                  }
                  if (parsed.done) {
                    sendEvent({ type: 'done', usage: null })
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }

            sendEvent({ type: 'done', usage: null })
            break
          }

          default:
            sendEvent({ type: 'error', message: `Unsupported provider: ${provider}` })
        }
      } catch (e) {
        sendEvent({ type: 'error', message: e instanceof Error ? e.message : 'Stream failed' })
      } finally {
        controller.close()
      }
    }
  })

  return sendStream(event, responseStream as unknown as ReadableStream<any>)
})
