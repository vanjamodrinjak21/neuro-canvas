<script setup lang="ts">
/**
 * /download — public landing for the latest desktop / mobile builds.
 *
 * Pulls /api/releases/latest (cached, rate-limited), auto-detects the
 * visitor's OS + arch, and surfaces a recommended download up top with the
 * full per-platform list below. Server-rendered for fast first paint and
 * crawler indexing.
 */

definePageMeta({ layout: false })

useHead({
  title: 'Download NeuroCanvas — desktop & mobile',
  meta: [
    { name: 'description', content: 'Download NeuroCanvas for macOS, Windows, Linux, iOS, and Android.' },
  ],
})

interface Asset {
  name: string
  url: string
  size: number
  contentType: string
  platform: 'macos' | 'windows' | 'linux' | 'android' | 'ios' | 'unknown'
  arch: 'x86_64' | 'aarch64' | 'i686' | 'universal' | null
  format: string
}
interface Release {
  tag: string
  name: string
  publishedAt: string | null
  notesMarkdown: string
  htmlUrl: string
  prerelease: boolean
  assets: Asset[]
}

const { data: release, error, pending } = await useFetch<Release>('/api/releases/latest', {
  // Server fetch on first load, client-side hydrate from the cached payload.
  key: 'releases:latest',
  default: () => null,
})

// ---------------------------------------------------------------------------
// Detect visitor platform/arch from the user-agent (best effort — the
// per-platform grid below covers everything explicitly).
// ---------------------------------------------------------------------------
type Detected = { platform: Asset['platform']; arch: Asset['arch'] }

const detected = ref<Detected>({ platform: 'unknown', arch: null })

onMounted(() => {
  if (typeof navigator === 'undefined') return
  const ua = navigator.userAgent.toLowerCase()
  const platformStr = (navigator.platform || '').toLowerCase()

  let platform: Asset['platform'] = 'unknown'
  let arch: Asset['arch'] = null

  if (/iphone|ipad|ipod/.test(ua) || /ios/.test(platformStr)) {
    platform = 'ios'
  } else if (/android/.test(ua)) {
    platform = 'android'
  } else if (/mac/.test(platformStr) || /mac os x|macintosh/.test(ua)) {
    platform = 'macos'
    // navigator.userAgentData isn't widely available; sniff Apple Silicon
    // via the WebGL renderer if exposed, else fall back to "let user pick".
    arch = /arm64/.test(ua) ? 'aarch64' : null
  } else if (/win/.test(platformStr) || /windows/.test(ua)) {
    platform = 'windows'
    if (/wow64|win64|x64/.test(ua)) arch = 'x86_64'
    else if (/arm64/.test(ua)) arch = 'aarch64'
    else arch = 'i686'
  } else if (/linux/.test(platformStr) || /linux/.test(ua)) {
    platform = 'linux'
    arch = 'x86_64'
  }

  detected.value = { platform, arch }
})

// ---------------------------------------------------------------------------
// Bucket assets by platform; pick a "recommended" pick for the visitor.
// ---------------------------------------------------------------------------
const buckets = computed(() => {
  const out: Record<Asset['platform'], Asset[]> = {
    macos: [], windows: [], linux: [], android: [], ios: [], unknown: [],
  }
  for (const a of release.value?.assets ?? []) out[a.platform].push(a)
  return out
})

const recommended = computed<Asset | null>(() => {
  const list = buckets.value[detected.value.platform] ?? []
  if (!list.length) return null
  // Prefer matching arch, then a sensible default format, then the first asset.
  const archMatch = detected.value.arch ? list.find(a => a.arch === detected.value.arch) : null
  if (archMatch) return archMatch
  const preferred: Record<Asset['platform'], string[]> = {
    macos:   ['dmg', 'app.tar.gz'],
    windows: ['msi', 'exe', 'nsis.zip'],
    linux:   ['AppImage', 'deb'],
    android: ['apk', 'aab'],
    ios:     ['ipa'],
    unknown: [],
  }
  for (const fmt of preferred[detected.value.platform] ?? []) {
    const hit = list.find(a => a.format === fmt)
    if (hit) return hit
  }
  return list[0] ?? null
})

const platformLabels: Record<Asset['platform'], string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS',
  unknown: 'Other',
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function archLabel(a: Asset): string {
  if (a.arch === 'aarch64') return 'Apple Silicon / ARM64'
  if (a.arch === 'x86_64') return '64-bit Intel/AMD'
  if (a.arch === 'i686') return '32-bit'
  if (a.arch === 'universal') return 'Universal'
  return ''
}
</script>

<template>
  <main class="download">
    <header class="hero">
      <h1>Download NeuroCanvas</h1>
      <p class="lede">
        AI-powered mind mapping for desktop and mobile. Free for personal use.
      </p>
    </header>

    <section v-if="pending" class="card">
      <p>Loading the latest release…</p>
    </section>

    <section v-else-if="error || !release" class="card">
      <h2>No release available yet</h2>
      <p>Check back soon, or browse releases on
        <a :href="`https://github.com/${$config.public.releasesRepo || ''}/releases`" target="_blank" rel="noopener noreferrer">GitHub</a>.
      </p>
    </section>

    <template v-else>
      <section class="card recommended" v-if="recommended">
        <p class="eyebrow">Recommended for your device</p>
        <h2>{{ platformLabels[recommended.platform] }} <span class="muted" v-if="archLabel(recommended)">— {{ archLabel(recommended) }}</span></h2>
        <a class="btn-primary" :href="recommended.url">
          Download {{ recommended.format }}
          <span class="muted">({{ fmtSize(recommended.size) }})</span>
        </a>
        <p class="muted small">
          {{ release.name }} · released
          <time v-if="release.publishedAt" :datetime="release.publishedAt">
            {{ new Date(release.publishedAt).toLocaleDateString() }}
          </time>
        </p>
      </section>

      <section class="card">
        <h2>All platforms</h2>
        <div class="grid">
          <article
            v-for="(items, platform) in buckets"
            v-show="items.length"
            :key="platform"
            class="platform"
          >
            <h3>{{ platformLabels[platform as Asset['platform']] }}</h3>
            <ul>
              <li v-for="a in items" :key="a.name">
                <a :href="a.url" :download="a.name">
                  <span class="fmt">{{ a.format.toUpperCase() }}</span>
                  <span v-if="archLabel(a)" class="arch">{{ archLabel(a) }}</span>
                  <span class="size">{{ fmtSize(a.size) }}</span>
                </a>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section class="card">
        <h2>Verifying your download</h2>
        <p>
          Every desktop bundle ships with a matching <code>.sig</code> file produced by the
          Tauri updater key. The desktop app verifies these automatically when auto-updating;
          if you want to verify a manual download, follow the
          <a :href="release.htmlUrl" target="_blank" rel="noopener noreferrer">release notes</a>.
        </p>
      </section>

      <section class="card">
        <h2>Stores</h2>
        <p>
          On iOS and Android, prefer the App Store / Google Play builds — they include
          automatic updates and are signed by Apple / Google. The <code>.ipa</code> /
          <code>.apk</code> files here are intended for sideloading by developers and CI.
        </p>
      </section>
    </template>

    <footer class="foot">
      <p>
        Looking for source? View this release on
        <a v-if="release" :href="release.htmlUrl" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span v-else>GitHub</span>.
      </p>
    </footer>
  </main>
</template>

<style scoped>
.download {
  max-width: 980px;
  margin: 0 auto;
  padding: 4rem 1.5rem 6rem;
  color: var(--nc-fg, #e8e8ec);
  font-family: 'Inter', system-ui, sans-serif;
}
.hero h1 {
  font-family: 'Cabinet Grotesk', 'Inter', sans-serif;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  margin: 0 0 .5rem;
  letter-spacing: -0.02em;
}
.hero .lede { color: rgba(232, 232, 236, 0.7); margin: 0 0 2.5rem; }

.card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 1.75rem 2rem;
  margin-bottom: 1.25rem;
}
.card h2 {
  font-family: 'Cabinet Grotesk', sans-serif;
  font-size: 1.5rem;
  margin: 0 0 .75rem;
  font-weight: 700;
}
.card h3 {
  font-size: 1rem;
  margin: 0 0 .5rem;
  letter-spacing: -0.01em;
  color: rgba(232, 232, 236, 0.85);
}
.eyebrow {
  text-transform: uppercase;
  font-size: .75rem;
  letter-spacing: 0.12em;
  color: rgba(232, 232, 236, 0.55);
  margin: 0 0 .5rem;
}
.muted { color: rgba(232, 232, 236, 0.6); font-weight: 400; }
.small { font-size: .875rem; margin-top: .75rem; }

.recommended .btn-primary {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  padding: .9rem 1.4rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #5b6cff, #7d3df0);
  color: white;
  font-weight: 600;
  text-decoration: none;
  margin-top: .75rem;
  transition: transform .15s ease;
}
.recommended .btn-primary:hover { transform: translateY(-1px); }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
.platform ul { list-style: none; padding: 0; margin: 0; }
.platform li + li { margin-top: .35rem; }
.platform a {
  display: flex;
  align-items: baseline;
  gap: .65rem;
  padding: .55rem .75rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  text-decoration: none;
  color: inherit;
  font-size: .9rem;
}
.platform a:hover { background: rgba(255, 255, 255, 0.08); }
.fmt { font-weight: 600; }
.arch { color: rgba(232, 232, 236, 0.65); font-size: .825rem; }
.size { margin-left: auto; color: rgba(232, 232, 236, 0.5); font-variant-numeric: tabular-nums; font-size: .8rem; }

.foot {
  margin-top: 2.5rem;
  text-align: center;
  color: rgba(232, 232, 236, 0.4);
  font-size: .85rem;
}

@media (prefers-reduced-motion: reduce) {
  .recommended .btn-primary { transition: none; }
  .recommended .btn-primary:hover { transform: none; }
}
</style>
