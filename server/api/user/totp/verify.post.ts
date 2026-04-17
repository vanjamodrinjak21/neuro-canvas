import { getToken } from '#auth'
import { TOTP, Secret } from 'otpauth'
import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'
import { serverDecrypt } from '../../../utils/encryption'

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits')
}).strict()

export default defineEventHandler(async (event) => {
  const token = await getToken({ event })

  if (!token?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Rate limit: 10 verify attempts per 15 minutes
  const { allowed } = await checkRateLimit(`totp-verify:${token.email as string}`, 10, 900)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again later.' })
  }

  const body = await readBody(event)
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.errors[0]?.message || 'Invalid code' })
  }

  const user = await prisma.user.findUnique({
    where: { email: token.email as string },
    select: { id: true, totpSecret: true, totpEnabled: true }
  })

  if (!user || !user.totpSecret) {
    throw createError({ statusCode: 400, statusMessage: 'TOTP not set up. Start setup first.' })
  }

  // Decrypt stored secret
  const { decrypted: secretBase32 } = serverDecrypt(user.totpSecret)
  const secret = Secret.fromBase32(secretBase32)

  const totp = new TOTP({
    issuer: 'NeuroCanvas',
    label: (token.email as string) || 'user',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret
  })

  // Validate the TOTP code (allow 1 period window)
  const delta = totp.validate({ token: parsed.data.code, window: 1 })

  if (delta === null) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid code. Please try again.' })
  }

  // Generate backup codes (10 codes, 8 chars each)
  const backupCodes: string[] = []
  const hashedBackupCodes: string[] = []

  for (let i = 0; i < 10; i++) {
    const code = randomBytes(4).toString('hex') // 8 hex chars
    backupCodes.push(code)
    hashedBackupCodes.push(await bcrypt.hash(code, 12))
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: true,
      backupCodes: hashedBackupCodes
    }
  })

  return {
    success: true,
    backupCodes // Show once, never again
  }
})
