import { mintCollabToken, TokenError } from '../../utils/collabTokenMint'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const jwtSecret = config.partykitJwtSecret as string
  const partykitHost = config.public.partykitHost as string

  const body = await readBody<{ mapId?: string; shareToken?: string }>(event)
  const mapId = body?.mapId
  const shareToken = body?.shareToken ?? null
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'mapId required' })

  // Resolve auth optionally — owners are authenticated, anon viewers are not
  let authedUserId: string | null = null
  try {
    const { userId } = await requireAuthSession(event)
    authedUserId = userId
  } catch { /* anonymous */ }

  try {
    const result = await mintCollabToken({
      mapId, authedUserId, shareToken,
      jwtSecret, ttlSeconds: 60 * 60
    })
    return {
      ok: true,
      wsUrl: partykitHost ? `wss://${partykitHost}/parties/main/${mapId}` : '',
      ...result
    }
  } catch (err) {
    if (err instanceof TokenError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
