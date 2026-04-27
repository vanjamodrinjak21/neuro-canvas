import { mintCollabToken, TokenError } from '../../utils/collabTokenMint'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, collabTokenSchema } from '../../utils/validation'
import { checkRateLimit } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const jwtSecret = config.partykitJwtSecret as string
  const partykitHost = config.public.partykitHost as string

  const body = validateBody(collabTokenSchema, await readBody(event))

  // Resolve auth optionally — owners are authenticated, anon viewers are not
  let authedUserId: string | null = null
  try {
    const { userId } = await requireAuthSession(event)
    authedUserId = userId
  } catch { /* anonymous */ }

  // Rate-limit per user (or per IP for anon) so a hostile peer cannot spam
  // the JWT mint endpoint.
  const rlKey = authedUserId
    ? `collab-token:user:${authedUserId}`
    : `collab-token:ip:${getRequestIP(event, { xForwardedFor: true }) || 'unknown'}`
  const { allowed } = await checkRateLimit(rlKey, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many collab token requests' })
  }

  try {
    const result = await mintCollabToken({
      mapId: body.mapId,
      authedUserId,
      shareToken: body.shareToken ?? null,
      jwtSecret,
      ttlSeconds: 60 * 60,
    })
    return {
      ok: true,
      wsUrl: partykitHost ? `wss://${partykitHost}/parties/main/${body.mapId}` : '',
      ...result,
    }
  } catch (err) {
    if (err instanceof TokenError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
