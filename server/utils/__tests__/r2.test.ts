import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks. The util builds the S3Client lazily inside each function, so we mock
// the SDK + presigner at the module boundary and assert on the command inputs
// the util constructs. No real network/credentials are ever exercised.
// ---------------------------------------------------------------------------

// Capture the config passed to the S3Client constructor so we can assert the
// checksum flags + credentials wiring.
const s3ClientCtor = vi.fn()

class FakeS3Client {
  config: unknown
  send: ReturnType<typeof vi.fn>
  constructor(config: unknown) {
    this.config = config
    s3ClientCtor(config)
    // `send` is rebound per-test via the shared `sendMock`.
    this.send = sendMock
  }
}

const sendMock = vi.fn()

// Each command class just records the input object it was constructed with so
// the tests can introspect Bucket/Key/ContentType, etc.
function makeCommandClass(tag: string) {
  return class {
    static __tag = tag
    input: Record<string, unknown>
    __tag: string
    constructor(input: Record<string, unknown>) {
      this.input = input
      this.__tag = tag
    }
  }
}

const PutObjectCommand = makeCommandClass('PutObject')
const GetObjectCommand = makeCommandClass('GetObject')
const HeadObjectCommand = makeCommandClass('HeadObject')
const DeleteObjectCommand = makeCommandClass('DeleteObject')
const DeleteObjectsCommand = makeCommandClass('DeleteObjects')
const ListObjectsV2Command = makeCommandClass('ListObjectsV2')

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: FakeS3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
}))

const getSignedUrlMock = vi.fn()
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}))

// useRuntimeConfig is a Nuxt auto-import; the util reads it lazily. We stub it
// on globalThis and let each test mutate the returned config.
const runtimeConfig: Record<string, string> = {}
;(globalThis as unknown as { useRuntimeConfig: () => Record<string, string> }).useRuntimeConfig =
  () => runtimeConfig

const VALID_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com'

function setConfig(overrides: Partial<Record<string, string>> = {}) {
  for (const k of Object.keys(runtimeConfig)) delete runtimeConfig[k]
  Object.assign(runtimeConfig, {
    r2Endpoint: VALID_ENDPOINT,
    r2AccessKeyId: 'AKIA_TEST',
    r2SecretAccessKey: 'secret_test',
    r2DocumentsBucket: 'documents',
    ...overrides,
  })
}

// Re-import the SUT fresh per test so module-level state (if any) can't leak.
async function loadR2() {
  vi.resetModules()
  return await import('../r2')
}

beforeEach(() => {
  setConfig()
  s3ClientCtor.mockClear()
  sendMock.mockReset()
  getSignedUrlMock.mockReset()
  getSignedUrlMock.mockResolvedValue('https://signed.example/url')
})

describe('S3Client construction', () => {
  it('wires endpoint, auto region, credentials, and BOTH checksum flags', async () => {
    const { headDocObject } = await loadR2()
    sendMock.mockResolvedValue({ ContentLength: 10, ContentType: 'application/pdf' })

    await headDocObject('docs/u1/d1/file.pdf')

    expect(s3ClientCtor).toHaveBeenCalledTimes(1)
    const cfg = s3ClientCtor.mock.calls[0]![0] as Record<string, unknown>
    expect(cfg.endpoint).toBe(VALID_ENDPOINT)
    expect(cfg.region).toBe('auto')
    expect(cfg.credentials).toEqual({
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'secret_test',
    })
    // REQUIRED for R2 on @aws-sdk/client-s3 >= 3.729 or PutObject 500s NotImplemented CRC32.
    expect(cfg.requestChecksumCalculation).toBe('WHEN_REQUIRED')
    expect(cfg.responseChecksumValidation).toBe('WHEN_REQUIRED')
  })

  it('does NOT construct a client at module load (lazy)', async () => {
    // Importing alone must not touch useRuntimeConfig / build a client.
    await loadR2()
    expect(s3ClientCtor).not.toHaveBeenCalled()
  })

  it('throws on a non-R2 endpoint (SSRF guard) — metadata host', async () => {
    setConfig({ r2Endpoint: 'http://169.254.169.254/latest/meta-data' })
    const { headDocObject } = await loadR2()
    await expect(headDocObject('docs/u1/d1/file.pdf')).rejects.toThrow(/endpoint/i)
    expect(s3ClientCtor).not.toHaveBeenCalled()
  })

  it('throws on a non-R2 endpoint (SSRF guard) — wrong host', async () => {
    setConfig({ r2Endpoint: 'https://evil.example.com' })
    const { headDocObject } = await loadR2()
    await expect(headDocObject('docs/u1/d1/file.pdf')).rejects.toThrow(/endpoint/i)
  })

  it('rejects an http (non-https) r2 host', async () => {
    setConfig({ r2Endpoint: 'http://abc.r2.cloudflarestorage.com' })
    const { headDocObject } = await loadR2()
    await expect(headDocObject('docs/u1/d1/file.pdf')).rejects.toThrow(/endpoint/i)
  })

  it('throws when the bucket is not configured', async () => {
    setConfig({ r2DocumentsBucket: '' })
    const { headDocObject } = await loadR2()
    await expect(headDocObject('docs/u1/d1/file.pdf')).rejects.toThrow(/bucket/i)
  })
})

describe('makeDocKey', () => {
  it('builds docs/{userId}/{docId}/{filename}', async () => {
    const { makeDocKey } = await loadR2()
    expect(makeDocKey('u1', 'd1', 'report.pdf')).toBe('docs/u1/d1/report.pdf')
  })

  it('sanitizes path traversal in the filename', async () => {
    const { makeDocKey } = await loadR2()
    const key = makeDocKey('u1', 'd1', '../../etc/passwd')
    expect(key.startsWith('docs/u1/d1/')).toBe(true)
    expect(key).not.toContain('..')
    expect(key).not.toContain('docs/u1/d1//')
  })

  it('strips a leading slash from the filename', async () => {
    const { makeDocKey } = await loadR2()
    const key = makeDocKey('u1', 'd1', '/abs/name.pdf')
    expect(key.startsWith('docs/u1/d1/')).toBe(true)
    expect(key).not.toContain('docs/u1/d1//')
  })

  it('collapses nested directory separators to a flat filename', async () => {
    const { makeDocKey } = await loadR2()
    const key = makeDocKey('u1', 'd1', 'a/b/c.pdf')
    // The filename component must not introduce extra path segments under the doc.
    expect(key).toBe('docs/u1/d1/c.pdf')
  })
})

describe('createPresignedUpload', () => {
  it('signs a PutObjectCommand with Bucket, Key and ContentType', async () => {
    const { createPresignedUpload } = await loadR2()
    getSignedUrlMock.mockResolvedValue('https://signed.put/url')

    const url = await createPresignedUpload('docs/u1/d1/file.pdf', 'application/pdf')

    expect(url).toBe('https://signed.put/url')
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1)
    const [client, command, opts] = getSignedUrlMock.mock.calls[0]!
    expect(client).toBeInstanceOf(FakeS3Client)
    // Signs ContentType so R2 returns 403 on MIME mismatch.
    expect((command as { __tag: string }).__tag).toBe('PutObject')
    expect((command as { input: Record<string, unknown> }).input).toMatchObject({
      Bucket: 'documents',
      Key: 'docs/u1/d1/file.pdf',
      ContentType: 'application/pdf',
    })
    expect((opts as { expiresIn: number }).expiresIn).toBe(300)
  })

  it('honours a custom max TTL', async () => {
    const { createPresignedUpload } = await loadR2()
    await createPresignedUpload('docs/u1/d1/file.pdf', 'application/pdf', 120)
    const [, , opts] = getSignedUrlMock.mock.calls[0]!
    expect((opts as { expiresIn: number }).expiresIn).toBe(120)
  })
})

describe('headDocObject', () => {
  it('returns normalized contentLength + contentType', async () => {
    const { headDocObject } = await loadR2()
    sendMock.mockResolvedValue({ ContentLength: 1234, ContentType: 'application/pdf' })

    const res = await headDocObject('docs/u1/d1/file.pdf')

    expect(res).toEqual({ contentLength: 1234, contentType: 'application/pdf' })
    const cmd = sendMock.mock.calls[0]![0] as { __tag: string; input: Record<string, unknown> }
    expect(cmd.__tag).toBe('HeadObject')
    expect(cmd.input).toMatchObject({ Bucket: 'documents', Key: 'docs/u1/d1/file.pdf' })
  })
})

describe('getSignedDownloadUrl', () => {
  it('signs a GetObject URL when the key belongs to the caller', async () => {
    const { getSignedDownloadUrl } = await loadR2()
    getSignedUrlMock.mockResolvedValue('https://signed.get/url')

    const url = await getSignedDownloadUrl('docs/u1/d1/file.pdf', 'u1')

    expect(url).toBe('https://signed.get/url')
    const [, command, opts] = getSignedUrlMock.mock.calls[0]!
    expect((command as { __tag: string }).__tag).toBe('GetObject')
    expect((command as { input: Record<string, unknown> }).input).toMatchObject({
      Bucket: 'documents',
      Key: 'docs/u1/d1/file.pdf',
    })
    expect((opts as { expiresIn: number }).expiresIn).toBe(900)
  })

  it('honours a custom ttl', async () => {
    const { getSignedDownloadUrl } = await loadR2()
    await getSignedDownloadUrl('docs/u1/d1/file.pdf', 'u1', 60)
    const [, , opts] = getSignedUrlMock.mock.calls[0]!
    expect((opts as { expiresIn: number }).expiresIn).toBe(60)
  })

  it('throws on cross-tenant access (key prefix != caller userId)', async () => {
    const { getSignedDownloadUrl } = await loadR2()
    await expect(getSignedDownloadUrl('docs/u2/d1/file.pdf', 'u1')).rejects.toThrow()
    expect(getSignedUrlMock).not.toHaveBeenCalled()
  })

  it('throws when a userId is a prefix of another (no partial match)', async () => {
    const { getSignedDownloadUrl } = await loadR2()
    // caller 'u1' must NOT be able to read 'docs/u12/...'
    await expect(getSignedDownloadUrl('docs/u12/d1/file.pdf', 'u1')).rejects.toThrow()
    expect(getSignedUrlMock).not.toHaveBeenCalled()
  })
})

describe('deleteDocObject', () => {
  it('issues a DeleteObjectCommand for the key', async () => {
    const { deleteDocObject } = await loadR2()
    sendMock.mockResolvedValue({})

    await deleteDocObject('docs/u1/d1/file.pdf')

    const cmd = sendMock.mock.calls[0]![0] as { __tag: string; input: Record<string, unknown> }
    expect(cmd.__tag).toBe('DeleteObject')
    expect(cmd.input).toMatchObject({ Bucket: 'documents', Key: 'docs/u1/d1/file.pdf' })
  })
})

describe('deleteDocPrefix', () => {
  it('lists then deletes all objects under a prefix (single page)', async () => {
    const { deleteDocPrefix } = await loadR2()
    sendMock
      .mockResolvedValueOnce({
        Contents: [{ Key: 'docs/u1/d1/a.pdf' }, { Key: 'docs/u1/d1/b.txt' }],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({}) // DeleteObjects

    await deleteDocPrefix('docs/u1/d1/')

    const list = sendMock.mock.calls[0]![0] as { __tag: string; input: Record<string, unknown> }
    expect(list.__tag).toBe('ListObjectsV2')
    expect(list.input).toMatchObject({ Bucket: 'documents', Prefix: 'docs/u1/d1/' })

    const del = sendMock.mock.calls[1]![0] as { __tag: string; input: Record<string, unknown> }
    expect(del.__tag).toBe('DeleteObjects')
    expect(del.input).toMatchObject({
      Bucket: 'documents',
      Delete: { Objects: [{ Key: 'docs/u1/d1/a.pdf' }, { Key: 'docs/u1/d1/b.txt' }] },
    })
  })

  it('paginates via ContinuationToken until IsTruncated is false', async () => {
    const { deleteDocPrefix } = await loadR2()
    sendMock
      .mockResolvedValueOnce({
        Contents: [{ Key: 'docs/u1/d1/a.pdf' }],
        IsTruncated: true,
        NextContinuationToken: 'TOKEN1',
      })
      .mockResolvedValueOnce({}) // delete page 1
      .mockResolvedValueOnce({
        Contents: [{ Key: 'docs/u1/d1/b.pdf' }],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({}) // delete page 2

    await deleteDocPrefix('docs/u1/d1/')

    // 2 list + 2 delete round-trips.
    expect(sendMock).toHaveBeenCalledTimes(4)
    const secondList = sendMock.mock.calls[2]![0] as { input: Record<string, unknown> }
    expect(secondList.input).toMatchObject({ ContinuationToken: 'TOKEN1' })
  })

  it('is a no-op delete when the prefix is empty', async () => {
    const { deleteDocPrefix } = await loadR2()
    sendMock.mockResolvedValueOnce({ Contents: [], IsTruncated: false })

    await deleteDocPrefix('docs/u1/d1/')

    // Only the list call — no DeleteObjects when there is nothing to delete.
    expect(sendMock).toHaveBeenCalledTimes(1)
    const list = sendMock.mock.calls[0]![0] as { __tag: string }
    expect(list.__tag).toBe('ListObjectsV2')
  })
})
