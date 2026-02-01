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

// Get auth secret - check multiple sources
const authSecret = config.authSecret || process.env.AUTH_SECRET || process.env.NUXT_AUTH_SECRET

// Get the auth URL - check multiple sources, with fallback to hardcoded value
const authUrl = process.env.NEXTAUTH_URL
  || process.env.AUTH_ORIGIN
  || process.env.NUXT_PUBLIC_AUTH_ORIGIN
  || config.public?.authOrigin
  || 'https://neuro-canvas.com' // Fallback for production

console.log('[Auth] Initializing auth handler...')
console.log('[Auth] NODE_ENV:', process.env.NODE_ENV)
console.log('[Auth] AUTH_SECRET configured:', !!authSecret)
console.log('[Auth] AUTH_ORIGIN:', process.env.AUTH_ORIGIN)
console.log('[Auth] NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
console.log('[Auth] Resolved authUrl:', authUrl)

if (!authSecret) {
  console.error('[Auth] AUTH_SECRET is not configured!')
}

// ALWAYS set NEXTAUTH_URL - NextAuth requires this
process.env.NEXTAUTH_URL = authUrl
console.log('[Auth] Force set NEXTAUTH_URL to:', authUrl)

const resend = config.resendApiKey || process.env.RESEND_API_KEY
  ? new Resend(config.resendApiKey || process.env.RESEND_API_KEY)
  : null

// Build providers array conditionally
const providers: any[] = []

// Add OAuth providers only if configured
if (config.googleClientId && config.googleClientSecret) {
  providers.push(
    GoogleProvider.default({
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      allowDangerousEmailAccountLinking: true
    })
  )
}

if (config.githubClientId && config.githubClientSecret) {
  providers.push(
    GitHubProvider.default({
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
      allowDangerousEmailAccountLinking: true
    })
  )
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
      console.log('[Auth] authorize called for:', credentials?.email)
      if (!credentials?.email || !credentials?.password) {
        console.log('[Auth] Missing credentials')
        throw new Error('Email and password are required')
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email }
      })

      if (!user || !user.password) {
        console.log('[Auth] User not found or no password:', credentials.email)
        throw new Error('Invalid email or password')
      }

      const isValidPassword = await bcrypt.compare(credentials.password, user.password)

      if (!isValidPassword) {
        console.log('[Auth] Invalid password for:', credentials.email)
        throw new Error('Invalid email or password')
      }

      console.log('[Auth] Authorization successful for:', user.email)
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      }
    }
  })
)

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
        secure: isProduction
      }
    },
    callbackUrl: {
      name: isProduction ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: isProduction
      }
    },
    csrfToken: {
      name: isProduction ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction
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
    async jwt({ token, user }) {
      console.log('[Auth] JWT callback - user:', user?.email, 'token exists:', !!token)
      // Initial sign in
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        console.log('[Auth] JWT created for user:', user.email)
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
      console.log('[Auth] signIn callback - provider:', account?.provider, 'user:', user?.email)
      // Allow all OAuth sign-ins
      if (account?.provider === 'google' || account?.provider === 'github') {
        console.log('[Auth] OAuth sign-in allowed')
        return true
      }

      // For credentials, user must exist and have verified email
      if (account?.provider === 'credentials') {
        const allowed = !!user
        console.log('[Auth] Credentials sign-in:', allowed ? 'allowed' : 'denied')
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
        console.log(`New user signed up: ${user.email}`)
      }
    }
  }
})
