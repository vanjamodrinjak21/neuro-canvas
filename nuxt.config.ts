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
    '@nuxt/eslint'
  ],

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
