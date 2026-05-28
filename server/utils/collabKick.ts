import { signFlushBody } from './collabAuth'
import { prisma } from './prisma'

/**
 * POST a kick request to the PartyKit room. The room's onRequest handler
 * matches each open connection's stashed `shareToken` / `userId` / `jti`
 * against the body and closes only the matching ones, so revoking a
 * single share doesn't disconnect every collaborator in the room.
 *
 * Best-effort: failures are swallowed by the caller. PartyKit will also
 * naturally re-mint tokens against Postgres state at the next 1-hour TTL,
 * so a missed kick at most leaves a stale connection live for ~1 hour.
 */
async function postKick(mapId: string, body: Record<string, string>): Promise<void> {
  const config = useRuntimeConfig()
  const host = config.public.partykitHost as string
  const secret = config.partykitFlushSecret as string
  if (!host || !secret) return

  const json = JSON.stringify(body)
  const sig = signFlushBody(Buffer.from(json), secret)
  const url = `https://${host}/parties/main/${encodeURIComponent(mapId)}/kick`

  await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-collab-signature': sig
    },
    body: json
  })
}

/**
 * Close any open connection in `mapId` whose JWT was minted from this share.
 */
export async function kickShareFromRoom(mapId: string, shareToken: string): Promise<void> {
  return postKick(mapId, { shareToken })
}

/**
 * Close any open connection in `mapId` whose JWT was minted for this user.
 * Used after password change / sign-out so a captured token can't keep
 * editing past the credential rotation.
 */
export async function kickUserFromRoom(mapId: string, userId: string): Promise<void> {
  return postKick(mapId, { userId })
}

/**
 * Close every active connection across every map the user has touched.
 * Used on password change — we don't know which maps have live sockets
 * so we hit each map the user owns or has a share for.
 *
 * Bounded by recent activity: only maps with `lastUsedAt` in the last 24h
 * are kicked, since sockets older than that have already expired.
 */
export async function kickUserEverywhere(userId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const owned = await prisma.map.findMany({
    where: { userId, updatedAt: { gte: since } },
    select: { id: true },
    take: 100,
  })
  // Fire-and-forget; we don't block password-change on PartyKit RPCs.
  await Promise.allSettled(owned.map(m => kickUserFromRoom(m.id, userId)))
}
