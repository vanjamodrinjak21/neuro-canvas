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
  model: z.string().max(200).optional(),
  messages: z.array(aiMessage).min(1).max(100),
  systemPrompt: z.string().max(50_000).optional(),
  maxTokens: z.number().int().min(1).max(200_000).default(500),
  temperature: z.number().min(0).max(2).default(0.7),
  baseUrl: optionalUrl,
})

// Printable ASCII only — blocks CRLF injection in HTTP headers
const safeApiKey = z.string().min(1).max(500).regex(/^[\x20-\x7E]+$/, 'API key contains invalid characters')

export const aiTestConnectionSchema = z.object({
  provider: aiProvider,
  credentialId: z.string().optional(),
  rawApiKey: safeApiKey.optional(),
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

export const vaultStoreV4Schema = z.object({
  provider: z.string().min(1).max(100),
  label: safeLabel.optional(),
  rawValue: z.string().min(1).max(10_000),
})

export const templateGenerateSchema = z.object({
  topic: z.string().min(1).max(1_000).trim(),
  depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
  style: z.enum(['detailed', 'concise', 'creative']).default('detailed'),
  domain: z.string().max(200).trim().optional().transform(v => v === '' ? undefined : v),
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

const templateCategory = z.enum(['education', 'business', 'creative', 'planning', 'research'])

export const templatePublishSchema = z.object({
  title: safeTitle,
  description: z.string().max(5_000).trim().optional(),
  category: templateCategory,
  tags: z.array(z.string().max(50)).max(20).default([]),
  aiEnhanced: z.boolean().default(false),
  sourceMapId: cuid.optional(),
  nodes: z.record(z.string(), z.any()).optional(),
  edges: z.record(z.string(), z.any()).optional(),
  settings: z.any().optional(),
}).refine(
  d => d.sourceMapId || (d.nodes && d.edges),
  { message: 'Either sourceMapId or nodes/edges data is required' }
).refine(
  d => !d.nodes || JSON.stringify(d.nodes).length <= 5 * 1024 * 1024,
  { message: 'Node data exceeds 5MB limit' }
).refine(
  d => !d.edges || JSON.stringify(d.edges).length <= 5 * 1024 * 1024,
  { message: 'Edge data exceeds 5MB limit' }
)

export const templateAdaptSchema = z.object({
  topic: z.string().min(1).max(1_000).trim(),
  depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
  style: z.enum(['detailed', 'concise', 'creative']).default('detailed'),
  domain: z.string().max(200).trim().optional().transform(v => v === '' ? undefined : v),
})

export const embeddingPostSchema = z.object({
  mapId: cuid,
  embeddings: z.array(z.object({
    nodeId: z.string().min(1).max(128),
    text: z.string().min(1).max(50_000),
    embedding: z.array(z.number()).min(1).max(4096),
    contentHash: z.string().min(1).max(64)
  })).min(1).max(500)
})

export const semanticSearchSchema = z.object({
  query: z.string().min(1).max(10_000).trim(),
  mapIds: z.array(cuid).max(100).optional(),
  topK: z.number().int().min(1).max(100).default(20),
  threshold: z.number().min(0).max(1).default(0.3),
  queryEmbedding: z.array(z.number()).min(1).max(4096)
})

export const ragContextSchema = z.object({
  query: z.string().min(1).max(10_000).trim(),
  mapId: cuid,
  maxNodes: z.number().int().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.25),
  includeNeighbors: z.boolean().default(true),
  queryEmbedding: z.array(z.number()).min(1).max(4096)
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
