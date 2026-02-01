// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-30',

  // Use app/ directory structure (Nuxt 4 style)
  future: {
    compatibilityVersion: 4
  },

  // Disable SSR for Tauri/Capacitor compatibility
  ssr: false,

  // Enable Vue devtools in development
  devtools: { enabled: true },

  // Modules
  modules: [
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@sidebase/nuxt-auth'
  ],

  // Auth configuration
  auth: {
    // baseURL is determined at runtime from environment
    baseURL: process.env.NUXT_PUBLIC_AUTH_ORIGIN || process.env.AUTH_ORIGIN || 'http://localhost:3000',
    provider: {
      type: 'authjs'
    },
    globalAppMiddleware: false // We'll handle middleware manually per-page
  },

  // Runtime config
  runtimeConfig: {
    // Server-side only
    authSecret: process.env.AUTH_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM || 'NeuroCanvas <noreply@neurocanvas.app>',
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    // Public (exposed to client)
    public: {
      authOrigin: process.env.AUTH_ORIGIN || 'http://localhost:3000'
    }
  },

  // Route rules for security headers
  routeRules: {
    '/api/auth/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    }
  },

  // App configuration
  app: {
    head: {
      title: 'NeuroCanvas',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'description', content: 'AI-powered mind mapping for students' },
        { name: 'theme-color', content: '#050508' }
      ],
      link: [
        // Fontshare preconnect
        { rel: 'preconnect', href: 'https://api.fontshare.com' },
        // Google Fonts preconnect
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        // Cabinet Grotesk + Instrument Serif from Fontshare
        { rel: 'stylesheet', href: 'https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,600,500,400&f[]=instrument-serif@400,400-italic&display=swap' },
        // JetBrains Mono for code
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap' },
        // Inter fallback
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }
      ]
    }
  },

  // CSS
  css: [
    '~/assets/css/main.css'
  ],

  // Vite configuration
  vite: {
    clearScreen: false,
    server: {
      strictPort: true
    }
  },

  // TypeScript configuration
  typescript: {
    strict: true,
    typeCheck: false
  }
})
