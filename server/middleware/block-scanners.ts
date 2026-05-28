import { isScannerPath } from '../utils/scannerPatterns'

export default defineEventHandler((event) => {
  const path = event.path || ''

  if (path === '/' || path.startsWith('/_nuxt/') || path.startsWith('/api/')) return

  if (isScannerPath(path)) {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
})
