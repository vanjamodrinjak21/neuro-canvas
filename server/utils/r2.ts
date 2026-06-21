// ---------------------------------------------------------------------------
// Cloudflare R2 object storage for the Document RAG feature (server-only).
//
// Design constraints (docs/architecture/document-rag-implementation-plan.md
// §2/§4/§0(a) + research-guidance §4 R2):
//
//   - R2 supports presigned PUT only (NOT POST policies / content-length-range).
//     Size is therefore NOT enforced at upload; the `confirm` endpoint runs
//     HeadObject-after-upload and deletes oversized objects. We still sign the
//     Content-Type into the PUT URL so R2 returns 403 on a MIME mismatch.
//   - @aws-sdk/client-s3 >= 3.729 adds default request/response checksums that
//     R2 rejects (PutObject => 500 NotImplemented CRC32). Both checksum modes
//     MUST be 'WHEN_REQUIRED' on the S3Client or every upload-side call fails.
//   - SSRF guard: the endpoint MUST be a real R2 host. A misconfigured
//     R2_ENDPOINT pointing at an internal metadata host (e.g. 169.254.169.254)
//     would let an in-process GetObject reach link-local addresses.
//   - The S3Client is built LAZILY inside each function from useRuntimeConfig()
//     — never at module top — so importing this file with missing env never
//     crashes load (the feature is gated by `documentsEnabled`).
// ---------------------------------------------------------------------------

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// SSRF guard: only canonical R2 endpoints over https. Shared with
// server/plugins/r2-config-check.ts so a bad endpoint also fails loudly at boot.
const R2_ENDPOINT_RE = /^https:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com(\/|$)/i

interface R2Config {
  client: S3Client
  bucket: string
}

/**
 * Build an S3Client for R2 from runtime config. Lazy + per-call: the SDK client
 * is cheap to construct and this keeps a missing-env import from crashing.
 */
function getR2(): R2Config {
  const config = useRuntimeConfig()
  const endpoint = (config.r2Endpoint as string) || ''
  const accessKeyId = (config.r2AccessKeyId as string) || ''
  const secretAccessKey = (config.r2SecretAccessKey as string) || ''
  const bucket = (config.r2DocumentsBucket as string) || ''

  // SSRF guard FIRST — never construct a client pointed at a non-R2 host.
  if (!R2_ENDPOINT_RE.test(endpoint)) {
    throw new Error(
      `R2 endpoint is invalid or unsafe: "${endpoint}". ` +
        'Expected https://<account>.r2.cloudflarestorage.com',
    )
  }
  if (!bucket) {
    throw new Error('R2 documents bucket is not configured (R2_DOCUMENTS_BUCKET).')
  }

  const client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
    // REQUIRED for R2 on @aws-sdk/client-s3 >= 3.729 — without these PutObject
    // fails with `NotImplemented` because R2 does not support the SDK's default
    // CRC32 checksum behavior.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  return { client, bucket }
}

/**
 * Build the canonical object key for a user's document upload:
 *   docs/{userId}/{docId}/{sanitizedFilename}
 *
 * The filename is fully server-controlled in practice (we set the extension),
 * but we still defensively flatten it: strip any directory components and any
 * '..' traversal so a hostile filename can never escape the doc prefix.
 */
export function makeDocKey(userId: string, docId: string, filename: string): string {
  // Take only the final path component, dropping any '/' or '\' segments, then
  // strip '..' sequences and leading dots/slashes. The doc prefix is fixed and
  // is built from server-trusted ids.
  const base = filename.split(/[\\/]/).pop() ?? ''
  const sanitized = base
    .replace(/\.\./g, '') // no traversal
    .replace(/^[./]+/, '') // no leading slash/dot
    .trim()
  return `docs/${userId}/${docId}/${sanitized}`
}

/**
 * Mint a presigned PUT URL the browser uploads bytes directly to. The
 * Content-Type is signed into the URL so R2 returns 403 if the client uploads
 * a different MIME than declared. Size is NOT enforced here (R2 limitation) —
 * the `confirm` endpoint's HeadObject is the authoritative size gate.
 *
 * Uses getSignedUrl(new PutObjectCommand) — NOT createPresignedPost, which R2
 * does not support.
 */
export async function createPresignedUpload(
  key: string,
  contentType: string,
  maxTtlSec = 300,
): Promise<string> {
  const { client, bucket } = getR2()
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: maxTtlSec },
  )
}

/**
 * HEAD an object to read its server-recorded size + content type. This is the
 * authoritative size enforcement point for uploads (R2 does not enforce
 * content-length on presigned PUT).
 */
export async function headDocObject(
  key: string,
): Promise<{ contentLength: number; contentType: string }> {
  const { client, bucket } = getR2()
  const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  return {
    contentLength: Number(res.ContentLength ?? 0),
    contentType: res.ContentType ?? '',
  }
}

/**
 * Mint a presigned GET URL for download. ASSERTS the key belongs to the caller
 * (`docs/{userId}/`) before signing so a tampered/forged key can never produce
 * a cross-tenant download URL, regardless of upstream ownership checks.
 */
export async function getSignedDownloadUrl(
  key: string,
  userId: string,
  ttlSec = 900,
): Promise<string> {
  const expectedPrefix = `docs/${userId}/`
  if (!key.startsWith(expectedPrefix)) {
    throw new Error('Refusing to sign download URL: key does not belong to the requesting user.')
  }
  const { client, bucket } = getR2()
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: ttlSec,
  })
}

/**
 * GetObject → fully-buffered bytes. Used by the ingestion worker (§P4) to pull
 * the uploaded file for parsing. We stream the SDK response body and concatenate
 * into a single Buffer — no signed-URL self-fetch (which would open an SSRF
 * surface), and no proxying of bytes through any HTTP boundary.
 *
 * Callers MUST bound this by the upstream size gate (the `confirm` HeadObject
 * check enforces the ≤20 MB cap before the row ever reaches QUEUED), so the full
 * buffer is safe to hold in memory.
 */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const { client, bucket } = getR2()
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const body = res.Body

  if (!body) {
    throw new Error('R2 GetObject returned an empty body')
  }

  // The AWS SDK v3 Node stream is an async iterable of Uint8Array chunks. This
  // path also tolerates a Web ReadableStream (transformToByteArray) and a raw
  // Buffer, so it is robust across runtimes/test doubles.
  const maybe = body as {
    transformToByteArray?: () => Promise<Uint8Array>
    [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>
  }

  if (typeof maybe.transformToByteArray === 'function') {
    return Buffer.from(await maybe.transformToByteArray())
  }

  if (typeof maybe[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  if (Buffer.isBuffer(body)) return body

  throw new Error('R2 GetObject returned an unreadable body type')
}

/**
 * Delete a single object.
 */
export async function deleteDocObject(key: string): Promise<void> {
  const { client, bucket } = getR2()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

/**
 * Delete every object under a prefix (e.g. all chunks/blobs for a document).
 * Paginates ListObjectsV2 and batches DeleteObjects at <= 1000 keys/request
 * (the S3/R2 hard limit).
 */
export async function deleteDocPrefix(prefix: string): Promise<void> {
  const { client, bucket } = getR2()
  let continuationToken: string | undefined

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )

    const objects = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => typeof k === 'string')

    // DeleteObjects accepts at most 1000 keys per request; ListObjectsV2 caps a
    // page at 1000 so a single page is always within the batch limit, but we
    // chunk defensively in case the limit ever changes.
    for (let i = 0; i < objects.length; i += 1000) {
      const batch = objects.slice(i, i + 1000)
      if (batch.length === 0) continue
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      )
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
  } while (continuationToken)
}
