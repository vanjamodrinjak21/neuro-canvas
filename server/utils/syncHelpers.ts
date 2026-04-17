import { createHash } from 'node:crypto'
import { getServerSession } from '#auth'
import type { H3Event } from 'h3'
import { parseCookies } from 'h3'
import { prisma } from './prisma'

/**
 * Generate SHA-256 checksum from data
 */
export function generateChecksum(data: unknown): string {
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  return createHash('sha256').update(json).digest('hex')
}

/**
 * Compute byte size of data
 */
export function computeByteSize(data: unknown): number {
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  return Buffer.byteLength(json, 'utf8')
}

/**
 * Require authenticated session — returns userId + email or throws 401
 */
export async function requireAuthSession(event: H3Event): Promise<{ userId: string; email: string }> {
  const session = await getServerSession(event)

  // Prefer ID-based lookup (from JWT token.id) over email to prevent TOCTOU issues
  const sessionUser = session?.user as { id?: string; email?: string } | undefined
  if (!sessionUser?.id && !sessionUser?.email) {
    // Diagnostic: log session state for debugging (no PII)
    const path = getRequestURL(event).pathname
    const cookies = parseCookies(event)
    const hasSecureCookie = !!cookies['__Secure-next-auth.session-token']
    const hasDevCookie = !!cookies['next-auth.session-token']
    const hasAnyAuthCookie = Object.keys(cookies).some(n => n.includes('auth') || n.includes('session'))
    const sessionKeys = session ? Object.keys(session) : []
    const userKeys = session?.user ? Object.keys(session.user as object) : []
    console.warn(`[Auth] 401 on ${path}: session=${session ? 'obj(' + sessionKeys.join(',') + ')' : 'null'}, user=${sessionUser ? 'obj(' + userKeys.join(',') + ')' : 'null'}, secureCookie=${hasSecureCookie}, devCookie=${hasDevCookie}, anyAuthCookie=${hasAnyAuthCookie}, secretSet=${!!process.env.AUTH_SECRET}`)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const user = sessionUser.id
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { id: true, email: true }
      })
    : await prisma.user.findUnique({
        where: { email: sessionUser.email! },
        select: { id: true, email: true }
      })

  if (!user || !user.email) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  return { userId: user.id, email: user.email }
}
