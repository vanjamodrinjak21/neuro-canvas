import { z } from 'zod'

const MAX_MAP_DATA_BYTES = 10 * 1024 * 1024
const MAX_TITLE_LENGTH = 500
const MAX_LABEL_LENGTH = 200

export const safeString = z.string().max(10_000).trim()
export const safeTitle = z.string().min(1).max(MAX_TITLE_LENGTH).trim()
export const safeLabel = z.string().max(MAX_LABEL_LENGTH).trim()
export const cuid = z.string().min(1).max(128)
// Strict cuid (v1): leading 'c' + 24 base36 chars. Use where the value is a
// freshly-minted Prisma id we control end-to-end (e.g. document/map ids passed
// across presign→upload→confirm). `cuid` above stays lenient for legacy callers.
export const cuidStrict = z.string().refine(v => /^c[a-z0-9]{24}$/.test(v), {
  message: 'must be a valid cuid',
})

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
  maxTokens: z.number().int().min(1).max(200_000).default(8000),
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

const syncPushSave = z.object({
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
  action: z.enum(['save']).optional()
})

const syncPushDelete = z.object({
  mapId: cuid,
  action: z.literal('delete'),
  deviceId: z.string().max(200).optional(),
  // Allow but ignore these fields for backwards compat
  data: z.any().optional(),
  title: z.any().optional(),
  syncVersion: z.any().optional(),
  checksum: z.any().optional(),
  preview: z.any().optional(),
  tags: z.any().optional(),
})

export const syncPushSchema = z.union([syncPushDelete, syncPushSave])

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
  style: z.enum(['concise', 'detailed', 'academic']).default('concise'),
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
  style: z.enum(['concise', 'detailed', 'academic']).default('concise'),
  domain: z.string().max(200).trim().optional().transform(v => v === '' ? undefined : v),
})

// All embedding-bearing payloads must carry exactly 256-dim vectors
// (nomic-embed-text-v1.5 Matryoshka-truncated). The server normally accepts
// pre-computed embeddings from the client Web Worker, but it may also embed
// from raw text via the server-side pipeline (see server/utils/embeddings.ts).
const EMBEDDING_DIMS_REQUIRED = 256
const embeddingVector = z
  .array(z.number().finite())
  .length(EMBEDDING_DIMS_REQUIRED, {
    message: `embedding must have exactly ${EMBEDDING_DIMS_REQUIRED} dimensions`,
  })

// Per-entry rules:
//   - `text` is always required (we store it as `sourceText` for debug/RAG).
//   - `embedding` is OPTIONAL — when omitted, the server computes it from
//     `text` using the server-side pipeline.
//   - Sending BOTH `text` and `embedding` is allowed (the client did the
//     work already, the server just validates and stores).
//   - Sending NEITHER is impossible because `text` is required.
const embeddingPostEntry = z.object({
  nodeId: z.string().min(1).max(128),
  text: z.string().min(1).max(50_000),
  embedding: embeddingVector.optional(),
  contentHash: z.string().min(1).max(64),
})

export const embeddingPostSchema = z.object({
  mapId: cuid,
  embeddings: z.array(embeddingPostEntry).min(1).max(500),
})

export const semanticSearchSchema = z.object({
  query: z.string().min(1).max(10_000).trim(),
  mapIds: z.array(cuid).max(100).optional(),
  topK: z.number().int().min(1).max(100).default(20),
  threshold: z.number().min(0).max(1).default(0.3),
  queryEmbedding: embeddingVector
})

// Hybrid (RRF) search over DocumentChunk: combines an HNSW semantic leg with a
// websearch_to_tsquery full-text leg, fused via Reciprocal Rank Fusion in the
// app layer (server/utils/rrf.ts). Modeled on semanticSearchSchema.
//   - `queryText` is REQUIRED (drives the FTS leg + server-side query embedding
//     when no precomputed vector is supplied). \x00 is rejected so it cannot
//     reach Postgres' text parser.
//   - `queryEmbedding` is OPTIONAL — when omitted the server embeds queryText
//     via the server-side pipeline ('query' prefix).
//   - `documentIds` is REQUIRED and bounded; every id is ownership/readiness
//     checked before any SQL runs.
export const hybridSearchSchema = z.object({
  queryText: z.string().trim().min(1).max(500).refine(v => !v.includes('\0'), 'queryText contains a null byte'),
  queryEmbedding: embeddingVector.optional(),
  documentIds: z.array(cuidStrict).min(1).max(100),
  mapIds: z.array(cuidStrict).max(100).optional(),
  topK: z.number().int().min(1).max(50).default(10),
  rrfK: z.number().int().min(1).max(200).default(60),
  minRrfScore: z.number().min(0).default(0),
})

export const ragContextSchema = z.object({
  query: z.string().min(1).max(10_000).trim(),
  mapId: cuid,
  maxNodes: z.number().int().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.25),
  includeNeighbors: z.boolean().default(true),
  queryEmbedding: embeddingVector,
  // Optional document-RAG scope. When present, the endpoint retrieves the top
  // document chunks (scoped to these ids + the caller's userId) and returns
  // them in a SEPARATE `documentContext` array. Every id is ownership +
  // readiness checked before any retrieval SQL runs. cuidStrict because these
  // are freshly-minted Prisma document ids we control end-to-end.
  documentIds: z.array(cuidStrict).max(100).optional()
})

export const embeddingsReindexSchema = z.object({
  force: z.boolean().optional().default(false)
})

// --------------------------------------------------------------------------
// Comments (per-map collaboration)
// --------------------------------------------------------------------------

const COMMENT_BODY_MAX = 5_000

export const commentCreateSchema = z.object({
  body: z.string().min(1).max(COMMENT_BODY_MAX).trim(),
  threadId: z.string().min(1).max(128).nullable().optional(),
  anchorNodeId: z.string().min(1).max(128).nullable().optional(),
  anchorX: z.number().finite().nullable().optional(),
  anchorY: z.number().finite().nullable().optional(),
  mentions: z.array(z.string().min(1).max(128)).max(50).optional(),
})

export const commentUpdateSchema = z.object({
  body: z.string().min(1).max(COMMENT_BODY_MAX).trim(),
})

// --------------------------------------------------------------------------
// Shares (map sharing CRUD)
// --------------------------------------------------------------------------

// COMMENTER is allowed in the schema even though the public type union is
// {viewer, editor} — the broader role enum lives in Prisma and is normalized
// inside sharesService.
const shareRole = z.enum(['viewer', 'commenter', 'editor'])
const shareLabel = z.string().max(64).trim().nullable().optional()
// ISO 8601 datetime; null clears, undefined leaves untouched.
const shareExpiresAt = z.string().datetime().max(64).nullable().optional()

export const shareCreateSchema = z.object({
  role: shareRole.default('viewer'),
  label: shareLabel,
  expiresAt: shareExpiresAt,
})

export const shareUpdateSchema = z.object({
  role: shareRole.optional(),
  label: shareLabel,
  expiresAt: shareExpiresAt,
}).refine(
  d => d.role !== undefined || d.label !== undefined || d.expiresAt !== undefined,
  { message: 'At least one of role, label, or expiresAt must be provided' }
)

// --------------------------------------------------------------------------
// Real-time collab (token mint)
// --------------------------------------------------------------------------

export const collabTokenSchema = z.object({
  mapId: cuid,
  shareToken: z.string().min(1).max(128).nullable().optional(),
})

// --------------------------------------------------------------------------
// Template instantiation (POST /api/templates/[slug]/use)
// --------------------------------------------------------------------------

export const templateUseSchema = z.object({
  mapId: cuid.optional(),
  title: safeTitle.optional(),
})

// --------------------------------------------------------------------------
// Document RAG ingestion (presigned upload → confirm)
// --------------------------------------------------------------------------
//
// R2 supports presigned PUT only (no POST/content-length-range), so the byte
// cap declared here is advisory at presign time and enforced server-side via a
// HeadObject-after-upload check at confirm time (see plan §0(a)).

const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024

const documentMime = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
])

export const documentPresignSchema = z.object({
  filename: z.string().min(1).max(255),
  declaredMime: documentMime,
  sizeBytes: z.number().int().min(1).max(DOCUMENT_MAX_BYTES),
  intent: z.enum(['generate_map', 'attach_source', 'none']).default('none'),
  attachToMapId: cuidStrict.optional(),
})

// Confirm carries no body — the document id is in the route path.
export const documentConfirmSchema = z.object({})

// Generate a mind map FROM an ingested document (POST /api/documents/[id]/
// generate-map). The document id is in the route path (validated cuidStrict at
// the call site); the body only selects the AI provider/model/credential —
// modeled on aiCompletionSchema but trimmed to the fields this NON-STREAMING,
// no-tools call needs. No `messages`/`systemPrompt`/`baseUrl` here: the prompt
// is assembled server-side from the document's own chunks via ragPromptGuard,
// never supplied by the client, and the base URL is resolved from the provider.
export const documentGenerateMapSchema = z.object({
  // 'custom' is intentionally excluded: this endpoint never accepts a
  // client-supplied baseUrl (the prompt is built server-side), and
  // validateOutboundUrl has no default URL for 'custom', so it could never
  // resolve. The four providers below all resolve to a known base URL.
  provider: z.enum(['openai', 'anthropic', 'ollama', 'openrouter']),
  // Optional: when omitted, resolveCredential falls back to the user's most
  // recent vault credential (same contract as aiCompletionSchema).
  credentialId: z.string().max(128).optional(),
  model: z.string().max(200).optional(),
})

// Attach an existing document to a map (user-initiated ATTACHED link). The
// document id is in the route path; the body carries the target mapId. Both
// ids are server-minted cuids, so cuidStrict.
export const documentAttachSchema = z.object({
  mapId: cuidStrict,
})

// Detach passes the mapId via querystring (?mapId=), so the value arrives as a
// raw string to be validated with cuidStrict at the call site.
export const documentDetachQuerySchema = z.object({
  mapId: cuidStrict,
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
