/**
 * Releases service — pulls the latest GitHub Release for the configured
 * repo, normalises the asset list into a per-platform shape the /download
 * page can render, and caches the result in Redis for 5 minutes so we
 * never hammer the GitHub API.
 *
 * The endpoint is public and read-only. We never forward the GitHub token
 * to the client; it is only used server-side to lift the unauth rate limit.
 */
import { cache } from './redis'

export interface NormalisedAsset {
  name: string
  url: string
  size: number
  contentType: string
  platform: Platform
  arch: Arch | null
  format: string
}

export type Platform = 'macos' | 'windows' | 'linux' | 'android' | 'ios' | 'unknown'
export type Arch = 'x86_64' | 'aarch64' | 'i686' | 'universal'

export interface ReleaseSummary {
  tag: string
  name: string
  publishedAt: string | null
  notesMarkdown: string
  htmlUrl: string
  prerelease: boolean
  assets: NormalisedAsset[]
}

const CACHE_TTL_SECONDS = 300

function classify(name: string): { platform: Platform; arch: Arch | null; format: string } {
  const n = name.toLowerCase()

  // Format
  let format = 'bin'
  if (n.endsWith('.dmg')) format = 'dmg'
  else if (n.endsWith('.app.tar.gz')) format = 'app.tar.gz'
  else if (n.endsWith('.msi')) format = 'msi'
  else if (n.endsWith('.exe')) format = 'exe'
  else if (n.endsWith('.nsis.zip')) format = 'nsis.zip'
  else if (n.endsWith('.deb')) format = 'deb'
  else if (n.endsWith('.appimage')) format = 'AppImage'
  else if (n.endsWith('.appimage.tar.gz')) format = 'AppImage.tar.gz'
  else if (n.endsWith('.apk')) format = 'apk'
  else if (n.endsWith('.aab')) format = 'aab'
  else if (n.endsWith('.ipa')) format = 'ipa'
  else if (n.endsWith('.xcarchive.tar.gz')) format = 'xcarchive'
  else if (n.endsWith('.sig')) format = 'sig'

  // Platform
  let platform: Platform = 'unknown'
  if (/(darwin|macos|\.dmg$|\.app\.tar\.gz$)/.test(n)) platform = 'macos'
  else if (/(windows|\.msi$|\.exe$|\.nsis\.zip$)/.test(n)) platform = 'windows'
  else if (/(linux|\.deb$|appimage)/.test(n)) platform = 'linux'
  else if (/(android|\.apk$|\.aab$)/.test(n)) platform = 'android'
  else if (/(ios|\.ipa$|xcarchive)/.test(n)) platform = 'ios'

  // Arch
  let arch: Arch | null = null
  if (/(aarch64|arm64|apple[- ]?silicon)/.test(n)) arch = 'aarch64'
  else if (/(x86_64|x64|amd64|intel)/.test(n)) arch = 'x86_64'
  else if (/(i686|x86\b|32-bit)/.test(n)) arch = 'i686'
  else if (/universal/.test(n)) arch = 'universal'

  return { platform, arch, format }
}

/**
 * Build the canonical CDN URL for an asset given the release tag.
 *
 * During the unsigned-beta phase the bucket uses a single rolling channel
 * (`{cdnBaseUrl}/beta/<filename>`) — every push to the beta tag overwrites
 * the prior artifacts. Set RELEASES_CHANNEL=stable (and write per-version
 * folders in the workflow) once we're shipping signed builds.
 */
function buildCdnUrl(cdnBaseUrl: string, tag: string, filename: string): string {
  const base = cdnBaseUrl.replace(/\/+$/, '')
  const channel = (process.env.RELEASES_CHANNEL || 'beta').toLowerCase()
  const dir = channel === 'stable'
    ? (tag.startsWith('v') ? tag : `v${tag}`)
    : channel
  return `${base}/${dir}/${encodeURIComponent(filename)}`
}

function normalise(
  asset: { name: string; browser_download_url: string; size: number; content_type: string },
  ctx: { tag: string; cdnBaseUrl: string | null },
): NormalisedAsset {
  const { platform, arch, format } = classify(asset.name)
  // When a CDN base URL is configured, point downloads at R2 instead of
  // GitHub. The R2 bucket mirrors the release contents under /v{tag}/<file>.
  const url = ctx.cdnBaseUrl
    ? buildCdnUrl(ctx.cdnBaseUrl, ctx.tag, asset.name)
    : asset.browser_download_url
  return {
    name: asset.name,
    url,
    size: asset.size,
    contentType: asset.content_type,
    platform,
    arch,
    format,
  }
}

function inferRepoFromConfig(serverConfigured: string | undefined): string | null {
  if (!serverConfigured) return null
  // Accept either a clean "owner/name" pair or a full GitHub URL like
  // "https://github.com/owner/name" or ".../releases/tag/beta".
  const urlMatch = serverConfigured.match(/github\.com\/([^/?#]+)\/([^/?#]+)/i)
  if (urlMatch && urlMatch[1] && urlMatch[2]) {
    return `${urlMatch[1]}/${urlMatch[2].replace(/\.git$/, '')}`
  }
  if (serverConfigured.includes('/')) return serverConfigured.replace(/^\/+|\/+$/g, '')
  return null
}

function channelTag(): string | null {
  const c = (process.env.RELEASES_CHANNEL || 'beta').toLowerCase()
  return c === 'stable' ? null : c
}

export async function fetchLatestRelease(
  repo: string,
  githubToken: string | undefined,
  cdnBaseUrl?: string | null,
): Promise<ReleaseSummary | null> {
  // Cache key includes CDN base so a config flip (e.g. enable/disable CDN)
  // doesn't serve a stale URL set.
  const cacheTag = cdnBaseUrl ? `cdn:${cdnBaseUrl}` : 'gh'
  const cacheKey = `releases:latest:${repo}:${cacheTag}`
  const cached = await cache.get<ReleaseSummary>(cacheKey)
  if (cached) return cached

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'NeuroCanvas-Releases-Proxy',
  }
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`

  // When RELEASES_CHANNEL is a rolling-tag channel (default: "beta"), fetch
  // that tag deterministically. Otherwise fall back to "most recent release"
  // semantics so semver tags surface as latest.
  const tag = channelTag()
  const repoPath = repo.replace(/\.\.|^\/+|\/+$/g, '')
  const url = tag
    ? `https://api.github.com/repos/${repoPath}/releases/tags/${encodeURIComponent(tag)}`
    : `https://api.github.com/repos/${repoPath}/releases?per_page=1`

  const res = await fetch(url, { headers, redirect: 'error' })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`GitHub releases fetch failed: ${res.status}`)
  }

  type RawRelease = {
    tag_name: string
    name: string | null
    published_at: string | null
    body: string | null
    html_url: string
    prerelease: boolean
    draft: boolean
    assets: Array<{ name: string; browser_download_url: string; size: number; content_type: string }>
  }
  const payload = await res.json()
  const live: RawRelease | null = tag
    ? (payload as RawRelease).draft ? null : (payload as RawRelease)
    : ((payload as RawRelease[]).find(r => !r.draft) ?? null)
  if (!live) return null

  const ctx = { tag: live.tag_name, cdnBaseUrl: cdnBaseUrl ?? null }
  const summary: ReleaseSummary = {
    tag: live.tag_name,
    name: live.name || live.tag_name,
    publishedAt: live.published_at,
    notesMarkdown: live.body ?? '',
    htmlUrl: live.html_url,
    prerelease: live.prerelease,
    assets: live.assets.map(a => normalise(a, ctx)),
  }

  await cache.set(cacheKey, summary, CACHE_TTL_SECONDS)
  return summary
}

export function resolveRepo(): string | null {
  // Read process.env first so a Railway "Add variable + Redeploy" (no rebuild)
  // takes effect immediately. Fall back to the build-time runtime config.
  const fromEnv = process.env.GITHUB_RELEASES_REPO
  if (fromEnv && fromEnv.trim()) {
    const inferred = inferRepoFromConfig(fromEnv)
    if (inferred) return inferred
  }
  const cfg = useRuntimeConfig()
  return inferRepoFromConfig(cfg.githubReleasesRepo as string | undefined)
}
