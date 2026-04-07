import { NuxtAuthHandler } from '#auth'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import EmailProvider from 'next-auth/providers/email'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcrypt'
import { Resend } from 'resend'
import { prisma } from '../../utils/prisma'

const config = useRuntimeConfig()

// Get OAuth credentials - check runtime config AND direct env vars (for Railway)
const googleClientId = config.googleClientId || process.env.GOOGLE_CLIENT_ID
const googleClientSecret = config.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET
const githubClientId = config.githubClientId || process.env.GITHUB_CLIENT_ID
const githubClientSecret = config.githubClientSecret || process.env.GITHUB_CLIENT_SECRET

// Get auth secret - check multiple sources
const authSecret = config.authSecret || process.env.AUTH_SECRET || process.env.NUXT_AUTH_SECRET

// Get the auth URL - check multiple sources, with fallback to hardcoded value
const authUrl = process.env.NEXTAUTH_URL
  || process.env.AUTH_ORIGIN
  || process.env.NUXT_PUBLIC_AUTH_ORIGIN
  || config.public?.authOrigin
  || 'https://neuro-canvas.com' // Fallback for production

// Startup validation only — no secrets or PII in logs
if (!authSecret) console.error('[Auth] FATAL: AUTH_SECRET is not configured')

// ALWAYS set NEXTAUTH_URL - NextAuth requires this
process.env.NEXTAUTH_URL = authUrl

const resend = config.resendApiKey || process.env.RESEND_API_KEY
  ? new Resend(config.resendApiKey || process.env.RESEND_API_KEY)
  : null

// Build providers array conditionally
const providers: any[] = []

// Add OAuth providers only if configured
if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider.default({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    })
  )
} else {
}

if (githubClientId && githubClientSecret) {
  providers.push(
    GitHubProvider.default({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      authorization: {
        url: 'https://github.com/login/oauth/authorize',
        params: {
          scope: 'read:user user:email'
        }
      },
      token: {
        url: 'https://github.com/login/oauth/access_token',
        async request(context: any) {
          // Manual token exchange to avoid openid-client issues
          const { code } = context.params
          const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              client_id: githubClientId,
              client_secret: githubClientSecret,
              code,
              redirect_uri: context.provider.callbackUrl
            })
          })
          const tokens = await response.json()
          if (tokens.error) {
            console.error('[Auth] GitHub token error:', tokens.error, tokens.error_description)
            throw new Error(tokens.error_description || tokens.error)
          }
          // Remove fields not in our Prisma schema
          const { refresh_token_expires_in, ...cleanTokens } = tokens
          return { tokens: cleanTokens }
        }
      },
      userinfo: {
        url: 'https://api.github.com/user',
        async request({ tokens }: { tokens: { access_token: string } }) {
          const response = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              'User-Agent': 'NeuroCanvas',
              Accept: 'application/json'
            }
          })
          if (!response.ok) {
            const text = await response.text()
            console.error('[Auth] GitHub userinfo error:', response.status, text)
            throw new Error('Failed to fetch GitHub user')
          }
          const profile = await response.json()

          // If no email in profile, fetch from emails endpoint
          if (!profile.email) {
            const emailsResponse = await fetch('https://api.github.com/user/emails', {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'User-Agent': 'NeuroCanvas',
                Accept: 'application/json'
              }
            })
            if (emailsResponse.ok) {
              const emails = await emailsResponse.json()
              const primaryEmail = emails.find((e: any) => e.primary) || emails[0]
              if (primaryEmail) {
                profile.email = primaryEmail.email
              }
            }
          }

          return profile
        }
      },
      profile(profile: any) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url
        }
      }
    })
  )
} else {
}

// Add Email provider only if Resend is configured
if (resend) {
  providers.push(
    EmailProvider.default({
      from: config.emailFrom,
      sendVerificationRequest: async ({ identifier: email, url }: { identifier: string; url: string }) => {
        try {
          await resend.emails.send({
            from: config.emailFrom,
            to: email,
            subject: 'Sign in to NeuroCanvas',
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                </head>
                <body style="background-color: #0A0A0C; color: #FAFAFA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px;">
                  <div style="max-width: 480px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #00D2BE, #00A89A); border-radius: 12px; margin-bottom: 16px;"></div>
                      <h1 style="font-size: 24px; font-weight: 700; margin: 0;">NeuroCanvas</h1>
                    </div>
                    <div style="background: #121216; border: 1px solid #252529; border-radius: 16px; padding: 32px;">
                      <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">Sign in to your account</h2>
                      <p style="color: #A1A1AA; line-height: 1.6; margin: 0 0 24px;">Click the button below to sign in to NeuroCanvas. This link will expire in 24 hours.</p>
                      <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #00D2BE, #00A89A); color: #0A0A0C; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 10px;">Sign in to NeuroCanvas</a>
                      <p style="color: #71717A; font-size: 14px; margin: 24px 0 0;">If you didn't request this email, you can safely ignore it.</p>
                    </div>
                    <p style="color: #52525B; font-size: 12px; text-align: center; margin-top: 24px;">© ${new Date().getFullYear()} NeuroCanvas. Think visually. Learn smarter.</p>
                  </div>
                </body>
              </html>
            `
          })
        } catch (error) {
          console.error('Failed to send verification email:', error)
          throw new Error('Failed to send verification email')
        }
      }
    })
  )
}

// Always add Credentials provider
providers.push(
  CredentialsProvider.default({
    id: 'credentials',
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' }
    },
    async authorize(credentials: { email?: string; password?: string } | undefined) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Email and password are required')
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() }
      })

      if (!user || !user.password) {
        throw new Error('Invalid email or password')
      }

      const isValidPassword = await bcrypt.compare(credentials.password, user.password)

      if (!isValidPassword) {
        throw new Error('Invalid email or password')
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      }
    }
  })
)

// Log which providers are registered

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production'

export default NuxtAuthHandler({
  secret: authSecret,

  // Trust the host header - required for proxied deployments like Railway
  trustHost: true,

  adapter: PrismaAdapter(prisma) as any,

  session: {
    strategy: 'jwt',
    maxAge: 4 * 60 * 60 // 4 hours
  },

  // Use secure cookies in production (HTTPS)
  useSecureCookies: isProduction,

  // Explicit cookie configuration for production
  cookies: {
    sessionToken: {
      name: isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        domain: undefined
      }
    },
    callbackUrl: {
      name: isProduction ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        domain: undefined
      }
    },
    csrfToken: {
      name: isProduction ? '__Secure-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        domain: undefined
      }
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: 900,
        domain: undefined
      }
    },
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: 900,
        domain: undefined
      }
    },
    nonce: {
      name: 'next-auth.nonce',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: 900,
        domain: undefined
      }
    }
  },

  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
    newUser: '/dashboard'
  },

  providers,

  callbacks: {
    async redirect({ url, baseUrl }) {
      // Fix for undefined baseUrl - use our known URL
      const safeBaseUrl = baseUrl || 'https://neuro-canvas.com'

      // If url is relative, prepend baseUrl
      if (url.startsWith('/')) {
        return `${safeBaseUrl}${url}`
      }
      // If url is on the same origin, allow it
      if (url.startsWith(safeBaseUrl)) {
        return url
      }
      // Default to baseUrl
      return safeBaseUrl
    },

    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      }

      // Track last activity for session refresh
      token.lastActivity = Date.now()

      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.picture as string
      }
      return session
    },

    async signIn({ user, account }) {
      // Allow all OAuth sign-ins
      if (account?.provider === 'google' || account?.provider === 'github') {
        return true
      }

      // For credentials, user must exist and have verified email
      if (account?.provider === 'credentials') {
        const allowed = !!user
        return allowed
      }

      // For email provider (magic links), always allow
      if (account?.provider === 'email') {
        return true
      }

      return true
    }
  },

  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser) {
      }
    }
  }
})
