import { applyFlush, FlushError } from '../../utils/collabFlush'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.partykitFlushSecret as string

  const signature = getRequestHeader(event, 'x-collab-signature') ?? ''
  const mapId = getRequestHeader(event, 'x-collab-mapid') ?? ''
  const authorId = getRequestHeader(event, 'x-collab-author') ?? null

  if (!mapId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing x-collab-mapid' })
  }

  const raw = await readRawBody(event, false)
  const body: Buffer = Buffer.isBuffer(raw)
    ? raw
    : Buffer.from((raw ?? '') as string)

  try {
    const result = await applyFlush({ body, signature, mapId, authorId, secret })
    return { ok: true, ...result }
  } catch (err) {
    if (err instanceof FlushError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
