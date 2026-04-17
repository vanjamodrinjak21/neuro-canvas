import { createHash } from 'node:crypto'
import { getToken } from '#auth'
import type { H3Event } from 'h3'
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
 *
 * Uses getToken() instead of getServerSession() because sidebase/nuxt-auth's
 * getServerSession has a bug where it returns null despite valid JWE cookies.
 * getToken() directly decrypts the JWT from the cookie and works reliably.
 */
export async function requireAuthSession(event: H3Event): Promise<{ userId: string; email: string }> {
  const token = await getToken({ event })

  const id = token?.id as string | undefined
  const email = token?.email as string | undefined

  if (!id && !email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const user = id
    ? await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true },
      })
    : await prisma.user.findUnique({
        where: { email: email! },
        select: { id: true, email: true },
      })

  if (!user || !user.email) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  return { userId: user.id, email: user.email }
}
