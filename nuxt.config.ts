import { fileURLToPath } from 'node:url'

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
    '@sidebase/nuxt-auth',
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxtjs/i18n'
  ],

  // i18n configuration
  i18n: {
    locales: [
      { code: 'en', name: 'English', files: ['en/common.json', 'en/auth.json', 'en/landing.json', 'en/dashboard.json', 'en/canvas.json', 'en/settings.json', 'en/templates.json', 'en/legal.json'] },
      { code: 'hr', name: 'Hrvatski', files: ['hr/common.json', 'hr/auth.json', 'hr/landing.json', 'hr/dashboard.json', 'hr/canvas.json', 'hr/settings.json', 'hr/templates.json', 'hr/legal.json'] }
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    langDir: 'locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      fallbackLocale: 'en',
      alwaysRedirect: false
    },
    vueI18n: './i18n/i18n.config.ts'
  },

  // Nuxt Content configuration
  content: {
    build: {
      markdown: {
        toc: { depth: 3, searchDepth: 3 },
        highlight: {
          theme: { default: 'github-dark', light: 'github-light' },
          langs: ['typescript', 'javascript', 'vue', 'bash', 'json', 'yaml', 'markdown', 'rust', 'html', 'css', 'dockerfile', 'sql']
        }
      }
    }
  },

  // Auth configuration
  auth: {
    // Always use absolute URL so Tauri desktop doesn't resolve to local assets
    baseURL: 'https://neuro-canvas.com/api/auth',
    provider: {
      type: 'authjs'
    },
    globalAppMiddleware: false, // We'll handle middleware manually per-page
    sessionRefresh: {
      enableOnWindowFocus: true,
      enablePeriodically: 5 * 60 * 1000 // Refresh every 5 minutes
    }
  },

  // Runtime config
  runtimeConfig: {
    // Server-side only
    authSecret: process.env.AUTH_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Desktop (Tauri) — separate Web-application OAuth client; secret is
    // never bundled in the binary, only used by the server endpoint.
    googleDesktopClientId: process.env.GOOGLE_DESKTOP_CLIENT_ID || '',
    googleDesktopClientSecret: process.env.GOOGLE_DESKTOP_CLIENT_SECRET || '',
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM || 'NeuroCanvas <noreply@neurocanvas.app>',
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    // Real-time collab
    partykitFlushSecret: process.env.PARTYKIT_FLUSH_SECRET || '',
    partykitJwtSecret: process.env.PARTYKIT_JWT_SECRET || '',
    // Releases — used by /api/releases/latest. GITHUB_RELEASES_REPO is e.g.
    // "owner/name" (defaults to inferring from package.json repository field
    // at runtime). GITHUB_TOKEN lifts the public 60-req/hr unauth rate limit
    // to 5000-req/hr; safe to leave empty in dev.
    githubReleasesRepo: process.env.GITHUB_RELEASES_REPO || '',
    githubToken: process.env.GITHUB_TOKEN || '',
    // Public (exposed to client)
    public: {
      authOrigin: process.env.AUTH_ORIGIN || 'http://localhost:3000',
      collabEnabled: process.env.NUXT_PUBLIC_COLLAB_ENABLED === 'true',
      partykitHost: process.env.NUXT_PUBLIC_PARTYKIT_HOST || '',
      // Public read-only for the /download page; if unset the client falls
      // back to /api/releases/latest, which derives the repo server-side.
      releasesRepo: process.env.NUXT_PUBLIC_RELEASES_REPO || '',
      // Desktop (Tauri) Google client — public so the in-app WebviewWindow
      // can build the auth URL. The matching client *secret* stays server-side.
      googleDesktopClientId: process.env.GOOGLE_DESKTOP_CLIENT_ID || '',
      // Native (Android / iOS) Google client IDs — public, used by the
      // platform's Google Sign-In SDK on device. The audience check in
      // /api/auth/desktop-google guarantees only these specific clients
      // can mint a NeuroCanvas session.
      googleAndroidClientId: process.env.NUXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
      googleIosClientId: process.env.NUXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || ''
    }
  },

  // Route rules
  routeRules: {
    '/api/auth/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    },
    '/docs/**': { ssr: true },
    '/docs': { redirect: '/docs/getting-started/introduction' },
    '/privacy': { ssr: true },
    '/terms': { ssr: true }
  },

  // App configuration
  app: {
    pageTransition: { name: 'page' },
    head: {
      title: 'NeuroCanvas',
      // Tauri auth fix: intercept /api/auth/* fetch calls BEFORE Nuxt boots
      script: [
        {
          innerHTML: `if(window.__TAURI__||window.__TAURI_INTERNALS__){var _f=window.fetch.bind(window);window.fetch=function(u,o){var s=typeof u==='string'?u:u instanceof URL?u.toString():u.url;if(s.indexOf('/api/auth/')!==-1)return Promise.resolve(new Response(JSON.stringify({}),{status:200,headers:{'Content-Type':'application/json'}}));return _f(u,o)}}`,
          tagPosition: 'head',
          type: 'text/javascript'
        }
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'description', content: 'AI-powered mind mapping for students' },
        { name: 'theme-color', content: '#050508' }
      ],
      link: [
        // Favicon
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        // Fontshare preconnect
        { rel: 'preconnect', href: 'https://api.fontshare.com' },
        // Google Fonts preconnect
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        // Cabinet Grotesk + Instrument Serif from Fontshare
        { rel: 'stylesheet', href: 'https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,600,500,400&f[]=instrument-serif@400,400-italic&display=swap' },
        // JetBrains Mono for code
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap' },
        // Inter (primary for landing page)
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap' }
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
    },
    // Stub out mobile-only packages that don't exist in Docker/server builds
    resolve: {
      alias: {
        'capacitor-plugin-local-llm': fileURLToPath(new URL('./stubs/empty.ts', import.meta.url)),
      }
    }
  },

  // Nitro server configuration
  nitro: {
    esbuild: {
      options: {
        target: 'es2022'
      }
    },
    prerender: {
      failOnError: false
    }
  },

  // TypeScript configuration
  typescript: {
    strict: true,
    typeCheck: false
  }
})
