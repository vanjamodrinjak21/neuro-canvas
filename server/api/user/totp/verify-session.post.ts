import { z } from 'zod'
import { TOTP, Secret } from 'otpauth'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'
import { serverDecrypt } from '../../../utils/encryption'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { markTotpStepUp } from '../../../utils/totpStepUp'

/**
 * Post-login TOTP verification for an EXISTING session (AER-84).
 *
 * OAuth sign-ins complete without a second factor, so 2FA-enabled accounts
 * verify their code here once per session (the /auth/2fa page, reached via
 * the auth middleware); success marks the session (userId + token.iat) in
 * Redis, which clears `session.user.totpPending`.
 *
 * Distinct from totp/verify.post.ts, which is the one-time ENABLE flow
 * (generates backup codes and flips totpEnabled).
 */

const bodySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits')
}).strict()

export default defineEventHandler(async (event) => {
  const { userId, iat } = await requireAuthSession(event)

  // Same budget as the sign-in TOTP path: 10 attempts per 15 minutes.
  const { allowed } = await checkRateLimit(`totp-stepup-verify:${userId}`, 10, 900)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again later.' })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Invalid code' })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, totpSecret: true, totpEnabled: true, lastTotpDelta: true }
  })
  if (!user?.totpEnabled || !user.totpSecret) {
    throw createError({ statusCode: 400, statusMessage: 'Two-factor authentication is not enabled.' })
  }

  const { decrypted: secretBase32 } = serverDecrypt(user.totpSecret)
  const totp = new TOTP({
    issuer: 'NeuroCanvas',
    label: user.email || 'user',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32)
  })

  const delta = totp.validate({ token: parsed.data.code, window: 1 })
  if (delta === null) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid code. Please try again.' })
  }

  // Replay protection — identical encoding to the sign-in path (period*10 +
  // delta+1), so a code consumed at login can't be replayed for step-up.
  const encoded = Math.floor(Date.now() / 30000) * 10 + (delta + 1)
  if (user.lastTotpDelta !== null && encoded <= user.lastTotpDelta) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid code. Please try again.' })
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastTotpDelta: encoded } })

  await markTotpStepUp(userId, iat)

  return { success: true }
})
