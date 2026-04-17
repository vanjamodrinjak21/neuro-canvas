import { NuxtAuthHandler } from '#auth'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import EmailProvider from 'next-auth/providers/email'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcrypt'
import { Resend } from 'resend'
import { prisma } from '../../utils/prisma'

// ─── CJS/ESM interop ───────────────────────────────────────────────
// next-auth providers export differently depending on bundler resolution.
// Handle both `{ default: fn }` (CJS) and direct export (ESM).
function resolveProvider<T>(mod: T & { default?: T }): T {
  return (mod as Record<string, unknown>).default as T ?? mod
}

const Google = resolveProvider(GoogleProvider)
const GitHub = resolveProvider(GitHubProvider)
const Email = resolveProvider(EmailProvider)
const Credentials = resolveProvider(CredentialsProvider)

// ─── Runtime secret resolution ──────────────────────────────────────
// CRITICAL: Read secrets from process.env at runtime, not from
// useRuntimeConfig() which may freeze values at build time.
// In Docker/Railway, build-time env can differ from runtime env.
function getSecret(): string {
  const secret = process.env.AUTH_SECRET
    || process.env.NUXT_AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('[Auth] FATAL: AUTH_SECRET is not configured. Cannot start in production without a secret.')
  }
  return secret
}

function getAuthUrl(): string {
  return process.env.NEXTAUTH_URL
    || process.env.AUTH_ORIGIN
    || process.env.NUXT_PUBLIC_AUTH_ORIGIN
    || 'https://neuro-canvas.com'
}

// Set NEXTAUTH_URL — next-auth requires this at runtime
process.env.NEXTAUTH_URL = getAuthUrl()

// Validate secret at module load — getSecret() throws in production if missing

// ─── Email transport ────────────────────────────────────────────────
const resendKey = process.env.RESEND_API_KEY
const resend = resendKey ? new Resend(resendKey) : null
const emailFrom = process.env.EMAIL_FROM || 'NeuroCanvas <noreply@neurocanvas.app>'

// ─── Build providers ────────────────────────────────────────────────
// OAuth credentials read at module load — these rarely change between build/runtime
// but are read from process.env for consistency.
const isProduction = process.env.NODE_ENV === 'production'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: any[] = []

const googleClientId = process.env.GOOGLE_CLIENT_ID || ''
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
const githubClientId = process.env.GITHUB_CLIENT_ID || ''
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || ''

if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  )
}

if (githubClientId && githubClientSecret) {
  providers.push(
    GitHub({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      authorization: {
        url: 'https://github.com/login/oauth/authorize',
        params: { scope: 'read:user user:email' },
      },
      token: {
        url: 'https://github.com/login/oauth/access_token',
        async request(context: { params: { code?: string }; provider: { callbackUrl: string } }) {
          const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              client_id: githubClientId,
              client_secret: githubClientSecret,
              code: context.params.code,
              redirect_uri: context.provider.callbackUrl,
            }),
          })
          const tokens = await response.json()
          if (tokens.error) {
            console.error('[Auth] GitHub token exchange failed:', tokens.error)
            throw new Error(tokens.error_description || tokens.error)
          }
          // Strip fields not in our Prisma Account schema
          const { refresh_token_expires_in: _, ...clean } = tokens
          return { tokens: clean }
        },
      },
      userinfo: {
        url: 'https://api.github.com/user',
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const headers = {
            Authorization: `Bearer ${tokens.access_token || ''}`,
            'User-Agent': 'NeuroCanvas',
            Accept: 'application/json',
          }
          const res = await fetch('https://api.github.com/user', { headers })
          if (!res.ok) throw new Error(`GitHub user fetch failed: ${res.status}`)
          const profile = await res.json()

          // Fetch email if not in public profile
          if (!profile.email) {
            const emailRes = await fetch('https://api.github.com/user/emails', { headers })
            if (emailRes.ok) {
              const emails = await emailRes.json()
              const primary = emails.find((e: { primary: boolean }) => e.primary) || emails[0]
              if (primary) profile.email = primary.email
            }
          }
          return profile
        },
      },
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
        }
      },
    })
  )
}

if (resend) {
  providers.push(
    Email({
      from: emailFrom,
      sendVerificationRequest: async ({ identifier: email, url }: { identifier: string; url: string }) => {
        try {
          await resend.emails.send({
            from: emailFrom,
            to: email,
            subject: 'Sign in to NeuroCanvas',
            html: buildSignInEmail(url),
          })
        } catch (error) {
          console.error('[Auth] Failed to send verification email:', error)
          throw new Error('Failed to send verification email')
        }
      },
    })
  )
}

providers.push(
  Credentials({
    id: 'credentials',
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
      totpCode: { label: 'TOTP Code', type: 'text' },
    },
    async authorize(credentials) {
      const email = credentials?.email as string | undefined
      const password = credentials?.password as string | undefined
      const totpCode = credentials?.totpCode as string | undefined

      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          password: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          totpEnabled: true,
          totpSecret: true,
          lastTotpDelta: true,
          backupCodes: true,
        },
      })

      if (!user || !user.password) {
        throw new Error('Invalid email or password')
      }

      // Account lockout — same error as invalid credentials to prevent enumeration
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new Error('Invalid email or password')
      }

      const validPassword = await bcrypt.compare(password, user.password)

      if (!validPassword) {
        const attempts = (user.failedLoginAttempts || 0) + 1
        const lockData: { failedLoginAttempts: number; lockedUntil?: Date } = { failedLoginAttempts: attempts }
        if (attempts >= 5) {
          const lockMinutes = Math.min(Math.pow(2, Math.floor(attempts / 5) - 1), 60)
          lockData.lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000)
        }
        await prisma.user.update({ where: { id: user.id }, data: lockData })
        throw new Error('Invalid email or password')
      }

      // Reset failed attempts on success
      if (user.failedLoginAttempts > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        })
      }

      // 2FA verification
      if (user.totpEnabled && user.totpSecret) {
        await verifyTOTP({ id: user.id, totpSecret: user.totpSecret!, lastTotpDelta: user.lastTotpDelta, backupCodes: user.backupCodes }, totpCode)
      }

      return { id: user.id, email: user.email, name: user.name, image: user.image }
    },
  })
)

// ─── Auth handler ───────────────────────────────────────────────────

export default NuxtAuthHandler({
  secret: getSecret(),

  // @ts-expect-error -- next-auth types don't include trustHost but sidebase/nuxt-auth supports it
  trustHost: true,

  adapter: PrismaAdapter(prisma as never) as never,

  session: {
    strategy: 'jwt',
    maxAge: 6 * 60 * 60, // 6 hours
  },

  useSecureCookies: isProduction,

  cookies: {
    sessionToken: {
      name: isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isProduction },
    },
    callbackUrl: {
      name: isProduction ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: { httpOnly: false, sameSite: 'lax' as const, path: '/', secure: isProduction },
    },
    csrfToken: {
      name: isProduction ? '__Secure-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isProduction },
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isProduction, maxAge: 900 },
    },
    state: {
      name: 'next-auth.state',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isProduction, maxAge: 900 },
    },
    nonce: {
      name: 'next-auth.nonce',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isProduction, maxAge: 900 },
    },
  },

  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
    newUser: '/dashboard',
  },

  providers,

  callbacks: {
    async redirect({ url, baseUrl }) {
      const safeBase = baseUrl || 'https://neuro-canvas.com'

      // Relative URL — prepend base
      if (url.startsWith('/')) return `${safeBase}${url}`

      // Same-origin check (prevents open redirect via prefix matching)
      try {
        if (new URL(url).origin === new URL(safeBase).origin) return url
      } catch {
        // Malformed URL — fall through
      }

      return safeBase
    },

    async jwt({ token, user }) {
      // Initial sign-in: populate token from user record
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = (user as { image?: string }).image
        token.iat = Math.floor(Date.now() / 1000)
        delete (token as Record<string, unknown>).expired
        delete (token as Record<string, unknown>).lastPwCheck
      }

      // Password-change invalidation (check every 5 min to avoid DB spam)
      const now = Date.now()
      const lastCheck = (token.lastPwCheck as number) || 0
      const shouldCheck = !!(token as Record<string, unknown>).expired || (now - lastCheck > 5 * 60 * 1000)

      if (token.email && token.iat && shouldCheck) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { passwordChangedAt: true },
          })
          ;(token as Record<string, unknown>).lastPwCheck = now

          if (dbUser?.passwordChangedAt) {
            const changedAt = Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
            if (changedAt > (token.iat as number)) {
              return { ...token, expired: true }
            }
          }

          // Clear stale expired flag if password check passes
          if ((token as Record<string, unknown>).expired) {
            delete (token as Record<string, unknown>).expired
          }
        } catch {
          // DB unreachable — fail open for reads
        }
      }

      return token
    },

    async session({ session, token }) {
      // Reject expired tokens (password changed after token issued)
      if ((token as Record<string, unknown>).expired) {
        console.warn('[Auth] Session rejected: token expired (password changed)')
        return { ...session, user: undefined as never, expires: new Date(0).toISOString() }
      }

      if (token) {
        // Extend session.user with id from JWT
        ;(session.user as Record<string, unknown>) = {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          image: token.picture as string,
        }
      }
      return session
    },

    async signIn({ account }) {
      // All provider types are allowed
      if (!account) return false
      return true
    },
  },
})

// ─── TOTP verification ──────────────────────────────────────────────

interface TOTPUser {
  id: string
  totpSecret: string
  lastTotpDelta: number | null
  backupCodes: string[]
}

async function verifyTOTP(user: TOTPUser, code: string | undefined): Promise<void> {
  if (!code) throw new Error('TOTP_REQUIRED')

  try {
    const { serverDecrypt } = await import('../../utils/encryption')
    const { TOTP, Secret } = await import('otpauth')

    const { decrypted: secretBase32 } = serverDecrypt(user.totpSecret)
    const totp = new TOTP({
      issuer: 'NeuroCanvas',
      label: 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secretBase32),
    })

    const delta = totp.validate({ token: code, window: 1 })

    if (delta !== null) {
      // Replay protection: reject reused TOTP codes within the same 30s period.
      // Store the current period number so we can distinguish cross-period reuse.
      const currentPeriod = Math.floor(Date.now() / 30000)
      // lastTotpDelta encodes: period * 10 + (delta + 1), so we can compare period+delta together
      const encoded = currentPeriod * 10 + (delta + 1)
      if (user.lastTotpDelta !== null && encoded <= user.lastTotpDelta) {
        throw new Error('Invalid 2FA code')
      }
      await prisma.user.update({ where: { id: user.id }, data: { lastTotpDelta: encoded } })
      return
    }

    // TOTP failed — try backup codes in a transaction
    let backupValid = false
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({
        where: { id: user.id },
        select: { backupCodes: true },
      })
      if (!fresh || fresh.backupCodes.length === 0) return

      for (let i = 0; i < fresh.backupCodes.length; i++) {
        if (await bcrypt.compare(code, fresh.backupCodes[i]!)) {
          backupValid = true
          const updated = [...fresh.backupCodes]
          updated.splice(i, 1)
          await tx.user.update({ where: { id: user.id }, data: { backupCodes: updated } })
          break
        }
      }
    })

    if (!backupValid) throw new Error('Invalid 2FA code')
  } catch (e) {
    if (e instanceof Error && (e.message === 'Invalid 2FA code' || e.message === 'TOTP_REQUIRED')) throw e
    throw new Error('2FA verification failed')
  }
}

// ─── Email template ─────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildSignInEmail(url: string): string {
  const safeUrl = escapeHtml(url)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="background-color:#0A0A0C;color:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#00D2BE,#00A89A);border-radius:12px;margin-bottom:16px;"></div>
      <h1 style="font-size:24px;font-weight:700;margin:0;">NeuroCanvas</h1>
    </div>
    <div style="background:#121216;border:1px solid #252529;border-radius:16px;padding:32px;">
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;">Sign in to your account</h2>
      <p style="color:#A1A1AA;line-height:1.6;margin:0 0 24px;">Click the button below to sign in. This link expires in 24 hours.</p>
      <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#00D2BE,#00A89A);color:#0A0A0C;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:10px;">Sign in to NeuroCanvas</a>
      <p style="color:#71717A;font-size:14px;margin:24px 0 0;">If you didn't request this email, you can safely ignore it.</p>
    </div>
    <p style="color:#52525B;font-size:12px;text-align:center;margin-top:24px;">&copy; ${new Date().getFullYear()} NeuroCanvas</p>
  </div>
</body>
</html>`
}
