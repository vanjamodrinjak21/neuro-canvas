/**
 * GET /api/releases/manifest
 *
 * Lightweight passthrough to {cdnBaseUrl}/latest.json. The CDN manifest is
 * the source of truth for "what is the current shipped version" — written by
 * the release pipeline alongside each new build. This endpoint exists so
 * desktop / mobile clients can hit our origin (already CORS-allowed, no
 * extra DNS) instead of binding to the bare CDN host.
 *
 * Cached briefly server-side; the CDN itself caches the underlying file.
 */
import { cache } from '../../utils/redis'

interface CdnManifest {
  version: string
  published_at: string
  release_url?: string
}

const CACHE_KEY = 'releases:manifest'
const CACHE_TTL_SECONDS = 60

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig()
  const cdnBaseUrl = (cfg.cdnBaseUrl as string) || ''
  if (!cdnBaseUrl) {
    throw createError({ statusCode: 503, statusMessage: 'CDN not configured' })
  }

  const cached = await cache.get<CdnManifest>(CACHE_KEY)
  if (cached) {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=30, s-maxage=60')
    return cached
  }

  const url = `${cdnBaseUrl.replace(/\/+$/, '')}/latest.json`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw createError({
      statusCode: res.status === 404 ? 404 : 502,
      statusMessage: res.status === 404 ? 'Manifest not yet published' : 'CDN upstream error',
    })
  }
  const data = (await res.json()) as CdnManifest
  await cache.set(CACHE_KEY, data, CACHE_TTL_SECONDS)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=30, s-maxage=60')
  return data
})
