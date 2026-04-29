/**
 * GET /api/releases/latest
 *
 * Public, read-only proxy over the GitHub Releases API for the configured
 * repo. Cached in Redis for 5 minutes. Used by the /download page.
 *
 * Rate-limited per IP so a misbehaving client cannot drain the GitHub
 * unauth quota for everyone else.
 */
import { fetchLatestRelease, resolveRepo } from '../../utils/releases'
import { checkRateLimit } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const { allowed } = await checkRateLimit(`releases:${ip}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const repo = resolveRepo()
  if (!repo) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Releases not configured (set GITHUB_RELEASES_REPO=owner/name)',
    })
  }

  const cfg = useRuntimeConfig()
  try {
    const release = await fetchLatestRelease(
      repo,
      cfg.githubToken as string,
      (cfg.cdnBaseUrl as string) || null,
    )
    if (!release) {
      throw createError({ statusCode: 404, statusMessage: 'No releases yet' })
    }
    // Allow CDN / browser to cache for a minute — server-side Redis already
    // covers the 5-min window, this just reduces our origin hits.
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300')
    return release
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) throw err
    throw createError({ statusCode: 502, statusMessage: 'GitHub upstream error' })
  }
})
