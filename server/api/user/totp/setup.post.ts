import { getToken } from '#auth'
import { TOTP, Secret } from 'otpauth'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'
import { serverEncrypt } from '../../../utils/encryption'

export default defineEventHandler(async (event) => {
  const token = await getToken({ event })

  if (!token?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Rate limit: 5 setup attempts per hour
  const { allowed } = await checkRateLimit(`totp-setup:${token.email as string}`, 5, 3600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again later.' })
  }

  const user = await prisma.user.findUnique({
    where: { email: token.email as string },
    select: { id: true, totpEnabled: true, email: true }
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (user.totpEnabled) {
    throw createError({ statusCode: 400, statusMessage: '2FA is already enabled' })
  }

  // Generate TOTP secret
  const secret = new Secret({ size: 20 })
  const totp = new TOTP({
    issuer: 'NeuroCanvas',
    label: user.email || 'user',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret
  })

  const otpauthUrl = totp.toString()

  // Encrypt secret before storing temporarily
  const encryptedSecret = serverEncrypt(secret.base32)

  // Store encrypted secret temporarily (not yet enabled)
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptedSecret }
  })

  // Generate QR code as data URL
  let qrCodeDataUrl = ''
  try {
    const QRCode = await import('qrcode')
    const toDataURL = QRCode.toDataURL || QRCode.default?.toDataURL
    qrCodeDataUrl = await toDataURL(otpauthUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#FAFAFA', light: '#00000000' }
    })
  } catch {
    // QR generation failed — client can use the manual key
  }

  return {
    qrCode: qrCodeDataUrl,
    secret: secret.base32, // Show to user for manual entry
    otpauthUrl
  }
})
