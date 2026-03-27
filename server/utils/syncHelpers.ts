import { createHash } from 'crypto'
import { getServerSession } from '#auth'
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
 */
export async function requireAuthSession(event: H3Event): Promise<{ userId: string; email: string }> {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true }
  })

  if (!user || !user.email) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  return { userId: user.id, email: user.email }
}
