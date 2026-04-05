import { requireAuthSession } from '../../utils/syncHelpers'
import { checkRateLimit } from '../../utils/redis'
import { serverFullDecrypt } from '../../utils/encryption'
import { prisma } from '../../utils/prisma'
import { validateBody, aiCompletionSchema } from '../../utils/validation'
import { validateOutboundUrl } from '../../utils/ssrf'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`ai:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'AI rate limit exceeded' })
  }

  const body = validateBody(aiCompletionSchema, await readBody(event))

  let apiKey: string | null = null

  if (body.credentialId) {
    const credential = await prisma.credential.findFirst({
      where: { id: body.credentialId, userId },
      select: { id: true, encryptedValue: true }
    })
    if (!credential) {
      throw createError({ statusCode: 404, statusMessage: 'Credential not found' })
    }
    try {
      const result = serverFullDecrypt(userId, credential.encryptedValue)
      apiKey = result.plaintext
      // Self-heal: re-encrypt with current AUTH_SECRET if rotated
      const updateData: { lastUsed: Date; encryptedValue?: string; encryptionVersion?: number } = { lastUsed: new Date() }
      if (result.credentialUpdate) {
        updateData.encryptedValue = result.credentialUpdate.encryptedValue
        updateData.encryptionVersion = result.credentialUpdate.encryptionVersion
      }
      prisma.credential.update({
        where: { id: credential.id },
        data: updateData
      }).catch(() => {})
    } catch {
      throw createError({ statusCode: 500, statusMessage: 'Failed to decrypt credential', data: { code: 'CREDENTIAL_DECRYPT_FAILED' } })
    }
  } else if (body.apiKey) {
    apiKey = body.apiKey
  }

  if (!apiKey && body.provider !== 'ollama') {
    throw createError({ statusCode: 400, statusMessage: 'API key required' })
  }

  const urlCheck = validateOutboundUrl(body.baseUrl, body.provider)
  if (!urlCheck.safe) {
    throw createError({ statusCode: 400, statusMessage: urlCheck.error || 'Invalid base URL' })
  }
  const baseUrl = urlCheck.resolvedUrl

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
        switch (body.provider) {
          case 'openai':
          case 'openrouter':
          case 'custom': {
            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                ...(body.provider === 'openrouter' && {
                  'HTTP-Referer': 'https://neuro-canvas.com',
                  'X-Title': 'NeuroCanvas'
                })
              },
              body: JSON.stringify({
                model: body.model || (body.provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
                messages: body.systemPrompt
                  ? [{ role: 'system', content: body.systemPrompt }, ...body.messages]
                  : body.messages,
                temperature: body.temperature,
                max_tokens: body.maxTokens,
                stream: true
              })
            })

            if (!response.ok) {
              const err = await response.json().catch(() => ({}))
              sendEvent({ type: 'error', message: (err as any).error?.message || `API error: ${response.status}` })
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
                    if (content) sendEvent({ type: 'delta', content })
                    if (parsed.usage) sendEvent({ type: 'done', usage: parsed.usage })
                  } catch { /* skip malformed */ }
                }
              }
            }

            sendEvent({ type: 'done', usage: null })
            break
          }

          case 'anthropic': {
            const response = await fetch(`${baseUrl}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey!,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: body.model || 'claude-sonnet-4-20250514',
                max_tokens: body.maxTokens,
                system: body.systemPrompt,
                messages: body.messages,
                stream: true
              })
            })

            if (!response.ok) {
              const err = await response.json().catch(() => ({}))
              sendEvent({ type: 'error', message: (err as any).error?.message || `API error: ${response.status}` })
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
                  } catch { /* skip malformed */ }
                }
              }
            }

            sendEvent({ type: 'done', usage: null })
            break
          }

          case 'ollama': {
            const response = await fetch(`${baseUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: body.model || 'llama3.2',
                messages: body.systemPrompt
                  ? [{ role: 'system', content: body.systemPrompt }, ...body.messages]
                  : body.messages,
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
                  if (parsed.message?.content) sendEvent({ type: 'delta', content: parsed.message.content })
                  if (parsed.done) sendEvent({ type: 'done', usage: null })
                } catch { /* skip malformed */ }
              }
            }

            sendEvent({ type: 'done', usage: null })
            break
          }

          default:
            sendEvent({ type: 'error', message: `Unsupported provider: ${body.provider}` })
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
