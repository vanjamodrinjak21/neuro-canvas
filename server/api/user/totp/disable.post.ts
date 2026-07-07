import { getToken } from '#auth'
import { TOTP, Secret } from 'otpauth'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'
import { serverDecrypt } from '../../../utils/encryption'

// Disabling 2FA proves possession of the SECOND FACTOR, not the password:
// a 6-digit authenticator code, or an 8-char backup code as the lost-device
// escape hatch. Password proof was wrong twice over — the session already
// proves the password, and OAuth accounts have none (they were locked out
// of ever disabling 2FA).
const disableSchema = z.object({
  code: z.string().regex(/^(\d{6}|[0-9a-f]{8})$/i, 'Enter the 6-digit code from your authenticator app or an 8-character backup code')
}).strict()

export default defineEventHandler(async (event) => {
  const token = await getToken({ event })

  if (!token?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Rate limit: 5 attempts per hour
  const { allowed } = await checkRateLimit(`totp-disable:${token.email as string}`, 5, 3600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again later.' })
  }

  const body = await readBody(event)
  const parsed = disableSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Invalid input' })
  }

  const user = await prisma.user.findUnique({
    where: { email: token.email as string },
    select: { id: true, totpEnabled: true, totpSecret: true, backupCodes: true }
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (!user.totpEnabled || !user.totpSecret) {
    throw createError({ statusCode: 400, statusMessage: '2FA is not enabled' })
  }

  const code = parsed.data.code
  let verified = false

  if (/^\d{6}$/.test(code)) {
    // Authenticator code — same validation shape as sign-in and verify.
    const { decrypted: secretBase32 } = serverDecrypt(user.totpSecret)
    const totp = new TOTP({
      issuer: 'NeuroCanvas',
      label: (token.email as string) || 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secretBase32)
    })
    verified = totp.validate({ token: code, window: 1 }) !== null
  } else {
    // Backup code — lets a user who lost the authenticator turn 2FA off.
    for (const hashed of user.backupCodes) {
      if (await bcrypt.compare(code.toLowerCase(), hashed)) {
        verified = true
        break
      }
    }
  }

  if (!verified) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid code. Please try again.' })
  }

  // Disable 2FA and clear secrets.
  //
  // We deliberately do NOT bump `sessionsValidFrom` here. A single epoch
  // watermark can't exclude the caller's own token: `iat` is stamped once at
  // sign-in and never refreshed, so stamping the epoch to "now" would reject
  // the very session that just disabled 2FA (self-lockout). The epoch is bumped
  // only by /api/auth/logout, which is the sole flow where forcing every token
  // (including the caller's) to re-authenticate is the intended outcome.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
      backupCodes: []
    }
  })

  return { success: true }
})
