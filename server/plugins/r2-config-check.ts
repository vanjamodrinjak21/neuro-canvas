// Boot-time sanity check for the Document RAG object-storage (Cloudflare R2)
// configuration.
//
// Document upload/download mints presigned R2 URLs server-side. If any R2
// secret is missing — or the endpoint is pointed at something that isn't an
// R2 account endpoint — every upload silently fails: the presigned URL is
// either un-mintable or points nowhere, and the user just sees a stuck
// "uploading…" with no obvious cause. The actual values live in the deploy
// environment (Railway env), not the repo, so all Nitro can assert is that
// each var is set and the endpoint LOOKS like a real R2 account endpoint. A
// loud warning at startup beats chasing a dead upload in the field. This logs
// only; it never throws.
//
// R2 account endpoints look like:
//   https://<accountid>.r2.cloudflarestorage.com
// We accept an optional trailing path (bucket can be path-style) but require
// the https + r2.cloudflarestorage.com host so a stray S3/MinIO endpoint or a
// placeholder gets flagged.
const R2_ENDPOINT_RE = /^https:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com(?:\/|$)/i

export default defineNitroPlugin(() => {
  // Only nag in production — local dev often runs without R2 / documents off.
  if ((process.env.NODE_ENV || '') !== 'production') return

  const config = useRuntimeConfig()
  // Feature-gated: if documents are disabled there is nothing to misconfigure.
  if (!config.documentsEnabled) return

  const endpoint = (config.r2Endpoint as string) || ''
  const accessKeyId = (config.r2AccessKeyId as string) || ''
  const secretAccessKey = (config.r2SecretAccessKey as string) || ''
  const bucket = (config.r2DocumentsBucket as string) || ''

  const issues: string[] = []

  if (!endpoint) {
    issues.push('R2_ENDPOINT is empty — presigned upload/download URLs cannot be minted; document uploads will fail.')
  } else if (!R2_ENDPOINT_RE.test(endpoint)) {
    issues.push(`R2_ENDPOINT "${endpoint}" does not look like a Cloudflare R2 account endpoint (expected https://<accountid>.r2.cloudflarestorage.com).`)
  }

  if (!accessKeyId) {
    issues.push('R2_ACCESS_KEY_ID is empty — the S3 client cannot authenticate to R2.')
  }

  if (!secretAccessKey) {
    issues.push('R2_SECRET_ACCESS_KEY is empty — the S3 client cannot authenticate to R2.')
  }

  if (!bucket) {
    issues.push('R2_DOCUMENTS_BUCKET is empty — there is no target bucket for document objects.')
  }

  if (issues.length === 0) return

  console.warn(
    [
      '[r2-config] Document RAG object storage (Cloudflare R2) is misconfigured:',
      ...issues.map(i => `  - ${i}`),
      '  Set these on the Nitro/Railway environment (DOCUMENTS_ENABLED=true):',
      '    R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_DOCUMENTS_BUCKET',
      '  Without them, every document upload fails to mint a presigned URL.',
    ].join('\n'),
  )
})
