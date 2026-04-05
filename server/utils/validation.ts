import { z } from 'zod'

const MAX_MAP_DATA_BYTES = 10 * 1024 * 1024
const MAX_TITLE_LENGTH = 500
const MAX_LABEL_LENGTH = 200

export const safeString = z.string().max(10_000).trim()
export const safeTitle = z.string().min(1).max(MAX_TITLE_LENGTH).trim()
export const safeLabel = z.string().max(MAX_LABEL_LENGTH).trim()
export const cuid = z.string().min(1).max(128)

const aiProvider = z.enum(['openai', 'anthropic', 'ollama', 'openrouter', 'custom'])
const optionalUrl = z.string().max(500).optional().transform(v => v === '' ? undefined : v).pipe(z.string().url().optional())
const aiMessage = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(100_000)
})

export const aiCompletionSchema = z.object({
  provider: aiProvider,
  credentialId: z.string().optional(),
  apiKey: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
  messages: z.array(aiMessage).min(1).max(100),
  systemPrompt: z.string().max(50_000).optional(),
  maxTokens: z.number().int().min(1).max(200_000).default(500),
  temperature: z.number().min(0).max(2).default(0.7),
  baseUrl: optionalUrl,
})

export const aiTestConnectionSchema = z.object({
  provider: aiProvider,
  credentialId: z.string().optional(),
  apiKey: z.string().max(500).optional(),
  baseUrl: optionalUrl,
})

export const aiCachePostSchema = z.object({
  hash: z.string().min(1).max(256),
  response: z.string().min(1).max(500_000),
  usage: z.unknown().optional(),
  ttlSeconds: z.number().int().min(60).max(86_400).optional()
})

export const aiMemoryPostSchema = z.object({
  data: z.record(z.string(), z.any())
})

export const syncPushSchema = z.object({
  mapId: cuid,
  data: z.record(z.string(), z.any()).refine(
    (d) => JSON.stringify(d).length <= MAX_MAP_DATA_BYTES,
    { message: `Map data exceeds ${MAX_MAP_DATA_BYTES / 1024 / 1024}MB limit` }
  ),
  title: safeTitle,
  syncVersion: z.number().int().min(0),
  checksum: z.string().min(1).max(128),
  deviceId: z.string().max(200).optional(),
  preview: z.string().max(2_000_000).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  action: z.enum(['save', 'delete']).optional()
})

export const syncBulkPushSchema = z.object({
  maps: z.array(z.object({
    mapId: cuid,
    data: z.record(z.string(), z.any()),
    title: safeTitle,
    syncVersion: z.number().int().min(0),
    checksum: z.string().min(1).max(128),
    preview: z.string().max(2_000_000).optional(),
    tags: z.array(z.string().max(100)).max(50).optional()
  })).min(1).max(100),
  deviceId: z.string().max(200).optional()
})

export const vaultStoreSchema = z.object({
  provider: z.string().min(1).max(100),
  label: safeLabel.optional(),
  encryptedValue: z.string().min(1).max(10_000),
  keyPrefix: z.string().max(20).optional(),
  encryptionVersion: z.number().int().min(1).max(3).default(2)
})

export const vaultUpdateSchema = z.object({
  encryptedValue: z.string().min(1).max(10_000).optional(),
  encryptionVersion: z.number().int().min(1).max(3).optional()
}).refine(d => d.encryptedValue || d.encryptionVersion, {
  message: 'At least one of encryptedValue or encryptionVersion must be provided'
})

export const embeddingPostSchema = z.object({
  mapId: cuid,
  embeddings: z.array(z.object({
    nodeId: z.string().min(1).max(128),
    text: z.string().min(1).max(50_000),
    embedding: z.array(z.number()).min(1).max(4096)
  })).min(1).max(500)
})

export function validateBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstIssue = result.error.issues[0]
    throw createError({
      statusCode: 400,
      statusMessage: `Validation failed: ${firstIssue?.path.join('.')} — ${firstIssue?.message}`
    })
  }
  return result.data
}
