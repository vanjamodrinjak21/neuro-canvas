<script setup lang="ts">
/**
 * /download — landing page for desktop & mobile builds.
 * Pulls /api/releases/latest, auto-detects visitor OS+arch, and surfaces
 * a recommended download up top with the per-platform list below.
 * Server-rendered for fast first paint and crawler indexing.
 *
 * Design parity: Paper artboards H42-0 (Web 1440), H76-0 (Laptop 1280),
 * HAA-0 (Mobile 390), with light variants HPS-0/HPT-0/HPU-0.
 */

definePageMeta({ layout: false })

useHead({
  title: 'Download NeuroCanvas — desktop & mobile',
  meta: [
    { name: 'description', content: 'Download NeuroCanvas for macOS, Windows, Linux, iOS, and Android. Free, forever. Direct from our CDN.' },
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
  key: 'releases:latest',
  default: () => null,
})

const { status } = useAuth()
const isAuthenticated = computed(() => status.value === 'authenticated')

type Platform = Asset['platform']
type Detected = { platform: Platform; arch: Asset['arch'] }
const detected = ref<Detected>({ platform: 'unknown', arch: null })

onMounted(() => {
  if (typeof navigator === 'undefined') return
  const ua = navigator.userAgent.toLowerCase()
  const platformStr = (navigator.platform || '').toLowerCase()
  let platform: Platform = 'unknown'
  let arch: Asset['arch'] = null
  if (/iphone|ipad|ipod/.test(ua) || /ios/.test(platformStr)) platform = 'ios'
  else if (/android/.test(ua)) platform = 'android'
  else if (/mac/.test(platformStr) || /mac os x|macintosh/.test(ua)) {
    platform = 'macos'
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

const buckets = computed(() => {
  const out: Record<Platform, Asset[]> = {
    macos: [], windows: [], linux: [], android: [], ios: [], unknown: [],
  }
  for (const a of release.value?.assets ?? []) out[a.platform].push(a)
  return out
})

const recommended = computed<Asset | null>(() => {
  const list = buckets.value[detected.value.platform] ?? []
  if (!list.length) return null
  const archMatch = detected.value.arch ? list.find(a => a.arch === detected.value.arch) : null
  if (archMatch) return archMatch
  const preferred: Record<Platform, string[]> = {
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

const platformLabels: Record<Platform, string> = {
  macos: 'macOS', windows: 'Windows', linux: 'Linux',
  android: 'Android', ios: 'iOS', unknown: 'Other',
}

const platformSubtitles: Record<Platform, string> = {
  macos: 'Universal binary · macOS 12 or later',
  windows: 'Windows 10 or later',
  linux: 'Debian, Ubuntu, Fedora',
  android: 'Android 9 or later · Sideload',
  ios: 'iOS 16 or later · Sideload via AltStore',
  unknown: '',
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function chipLabel(a: Asset): string {
  // Mirror the Paper chip text: Universal .dmg, x64 .exe, ARM64 .exe, .deb, .AppImage, .apk, .ipa
  if (a.platform === 'macos') return a.arch === 'universal' ? 'Universal .dmg' : `.${a.format}`
  if (a.platform === 'windows') {
    if (a.arch === 'x86_64') return `x64 .${a.format}`
    if (a.arch === 'aarch64') return `ARM64 .${a.format}`
    if (a.arch === 'i686') return `x86 .${a.format}`
    return `.${a.format}`
  }
  return `.${a.format}`
}

const orderedPlatforms: Platform[] = ['macos', 'windows', 'linux', 'android', 'ios']

// ── Release notes parsing — best-effort split into FEAT / FIX / PERF rows
interface NoteRow { kind: 'FEAT' | 'FIX' | 'PERF'; text: string }
const noteRows = computed<NoteRow[]>(() => {
  const md = release.value?.notesMarkdown ?? ''
  if (!md) return []
  const out: NoteRow[] = []
  const lines = md.split('\n')
  for (const raw of lines) {
    const line = raw.replace(/^[\s\-\*]+/, '').trim()
    if (!line || line.startsWith('#')) continue
    let kind: NoteRow['kind'] = 'FEAT'
    let text = line
    const lc = line.toLowerCase()
    if (/^(feat|feature)[\s:!]/i.test(line)) { kind = 'FEAT'; text = line.replace(/^feat(ure)?[\s:!]+/i, '') }
    else if (/^(fix|bug)[\s:!]/i.test(line)) { kind = 'FIX'; text = line.replace(/^(fix|bug)[\s:!]+/i, '') }
    else if (/^(perf|performance)[\s:!]/i.test(line)) { kind = 'PERF'; text = line.replace(/^perf(ormance)?[\s:!]+/i, '') }
    else if (lc.includes('faster') || lc.includes('improved performance')) kind = 'PERF'
    else if (lc.includes('fix') || lc.includes('resolve')) kind = 'FIX'
    out.push({ kind, text: text.replace(/^[\s:]+/, '') })
    if (out.length >= 6) break
  }
  return out
})

const versionLabel = computed(() => release.value?.tag ?? release.value?.name ?? 'v1.4.2')
</script>

<template>
  <div class="dl">
    <!-- ══════ TOP NAV ══════ -->
    <nav class="dl-nav">
      <div class="dl-nav-left">
        <NuxtLink to="/" class="dl-brand">
          <NcLogo :size="14" :container-size="24" :radius="6" />
          <span class="dl-brand-name">NeuroCanvas</span>
        </NuxtLink>
        <div class="dl-nav-links">
          <NuxtLink to="/#how-it-works">Product</NuxtLink>
          <NuxtLink to="/templates">Templates</NuxtLink>
          <NuxtLink to="/docs">Docs</NuxtLink>
          <span class="dl-nav-active">Download</span>
        </div>
      </div>
      <div class="dl-nav-right">
        <NuxtLink v-if="!isAuthenticated" to="/auth/signin" class="dl-nav-signin">Sign in</NuxtLink>
        <NuxtLink :to="isAuthenticated ? '/dashboard' : '/auth/signin'" class="dl-nav-dash">Open dashboard</NuxtLink>
      </div>
    </nav>

    <!-- ══════ HERO ══════ -->
    <section class="dl-hero">
      <h1 class="dl-headline">
        <span class="dl-h-sans">Download NeuroCanvas.</span>
        <span class="dl-h-serif">On every device.</span>
      </h1>
      <p class="dl-sub">
        Free, forever. Direct from our CDN — no app stores, no waiting. Your maps work offline and sync on every device you sign in to.
      </p>
      <div class="dl-cta-row">
        <a v-if="recommended" :href="recommended.url" class="dl-btn-primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v9m0 0l-3.5-3.5M8 11l3.5-3.5M3 13.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>Download for {{ platformLabels[recommended.platform] }}</span>
        </a>
        <span v-else class="dl-btn-primary dl-btn-disabled">
          <span>Pick a platform below</span>
        </span>
        <a href="#platforms" class="dl-btn-outline">All platforms</a>
      </div>
      <p class="dl-receipt">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M13.333 4.667L6 12l-3.333-3.333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span v-if="recommended">
          No invitation. No card. {{ chipLabel(recommended) }} · {{ fmtSize(recommended.size) }} · Signed &amp; notarized.
        </span>
        <span v-else>No invitation. No card. Direct from our CDN.</span>
      </p>
    </section>

    <!-- ══════ PLATFORMS ══════ -->
    <section id="platforms" class="dl-section">
      <p class="dl-section-eyebrow">01 — pick your platform</p>
      <div v-if="pending" class="dl-state">Loading the latest release…</div>
      <div v-else-if="error || !release" class="dl-state">
        No release available yet. Browse releases on
        <a :href="`https://github.com/${$config.public.releasesRepo || ''}/releases`" target="_blank" rel="noopener noreferrer">GitHub</a>.
      </div>
      <div v-else class="dl-grid">
        <article
          v-for="p in orderedPlatforms"
          v-show="buckets[p].length"
          :key="p"
          class="dl-card"
        >
          <header class="dl-card-head">
            <span class="dl-card-icon">
              <PlatformIcon :platform="p" />
            </span>
            <h2 class="dl-card-title">{{ platformLabels[p] }}</h2>
          </header>
          <p class="dl-card-sub">{{ platformSubtitles[p] }}</p>
          <div class="dl-card-chips">
            <a
              v-for="a in buckets[p]"
              :key="a.name"
              :href="a.url"
              :download="a.name"
              class="dl-chip"
              :title="`${fmtSize(a.size)}`"
            >{{ chipLabel(a) }}</a>
            <NuxtLink v-if="p === 'ios'" to="/docs/install/ios" class="dl-chip dl-chip-ghost">Install guide</NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <!-- ══════ RELEASE NOTES ══════ -->
    <section v-if="release" class="dl-section dl-section-notes">
      <header class="dl-notes-head">
        <p class="dl-section-eyebrow">02 — what's new in {{ versionLabel }}</p>
        <a :href="release.htmlUrl" target="_blank" rel="noopener noreferrer" class="dl-notes-gh">View on GitHub →</a>
      </header>
      <div class="dl-notes-card">
        <div v-for="(row, i) in noteRows" :key="i" class="dl-notes-row">
          <span class="dl-tag" :class="`dl-tag-${row.kind.toLowerCase()}`">{{ row.kind }}</span>
          <span class="dl-notes-text">{{ row.text }}</span>
        </div>
        <p v-if="!noteRows.length" class="dl-notes-text dl-notes-empty">
          {{ release.name || versionLabel }} — see GitHub for the full changelog.
        </p>
      </div>
    </section>

    <!-- ══════ FOOTER ══════ -->
    <footer class="dl-footer">
      <div class="dl-foot-brand">
        <div class="dl-foot-brand-row">
          <NcLogo :size="11" :container-size="18" :radius="5" />
          <span class="dl-foot-brand-name">NeuroCanvas</span>
        </div>
        <span class="dl-foot-meta">{{ versionLabel }} · pgvector RAG · MIT licensed</span>
        <span class="dl-foot-meta">Made by Vanja Modrinjak</span>
      </div>
      <div class="dl-foot-cols">
        <div class="dl-foot-col">
          <span class="dl-foot-col-head">Product</span>
          <NuxtLink to="/templates">Templates</NuxtLink>
          <NuxtLink to="/download">Download</NuxtLink>
          <NuxtLink to="/#how-it-works">How it works</NuxtLink>
        </div>
        <div class="dl-foot-col">
          <span class="dl-foot-col-head">Resources</span>
          <NuxtLink to="/docs">Docs</NuxtLink>
          <a :href="release?.htmlUrl ?? 'https://github.com'" target="_blank" rel="noopener">GitHub</a>
        </div>
        <div class="dl-foot-col">
          <span class="dl-foot-col-head">Company</span>
          <NuxtLink to="/privacy">Privacy</NuxtLink>
          <NuxtLink to="/terms">Terms</NuxtLink>
          <a href="mailto:hello@neuro-canvas.com">Contact</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════
   /download — Paper-exact (H42-0 / H76-0 / HAA-0 + light variants)
   ═══════════════════════════════════════════════════════ */
.dl {
  --bg: #09090B;
  --surface: #111114;
  --surface-3: #1A1A1E;
  --border: #1E1E22;
  --border-active: #2A2A30;
  --text: #FAFAFA;
  --text-2: #A1A1AA;
  --text-3: #777777;
  --text-faint: #52525B;
  --accent: #00D2BE;
  --on-accent: #0A0A0C;
  --sans: 'Inter', system-ui, -apple-system, sans-serif;
  --serif: 'Instrument Serif', Georgia, serif;

  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}

:root.light .dl {
  --bg: #FAFAF9;
  --surface: #F5F5F3;
  --surface-3: #E8E8E6;
  --border: #E8E8E6;
  --border-active: #D4D4D8;
  --text: #111111;
  --text-2: #555555;
  --text-3: #777777;
  --text-faint: #A1A1AA;
}

/* ═══════════════════════ NAV ═══════════════════════ */
.dl-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 64px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  z-index: 100;
}
.dl-nav-left { display: flex; align-items: center; gap: 42px; }
.dl-brand {
  display: flex; align-items: center; gap: 8px;
  text-decoration: none; color: var(--text);
}
.dl-brand-name { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.dl-nav-links { display: flex; align-items: center; gap: 28px; }
.dl-nav-links a {
  font-size: 14px; color: var(--text-3); text-decoration: none;
  transition: color 120ms ease;
}
.dl-nav-links a:hover { color: var(--text); }
.dl-nav-active {
  font-size: 14px; color: var(--text); font-weight: 500;
}
.dl-nav-right { display: flex; align-items: center; gap: 14px; }
.dl-nav-signin {
  font-size: 14px; color: var(--text-3); text-decoration: none;
  transition: color 120ms ease;
}
.dl-nav-signin:hover { color: var(--text); }
.dl-nav-dash {
  display: inline-flex; align-items: center;
  padding: 9px 18px;
  border: 1px solid var(--border-active);
  border-radius: 8px;
  font-size: 14px; font-weight: 500; color: var(--text);
  text-decoration: none;
  transition: background 120ms ease, border-color 120ms ease;
}
.dl-nav-dash:hover { background: var(--surface); border-color: var(--text-2); }

/* ═══════════════════════ HERO ═══════════════════════ */
.dl-hero {
  display: flex; flex-direction: column; align-items: flex-start;
  gap: 20px;
  padding: 120px 64px 64px;
}
.dl-headline {
  display: flex; flex-direction: column;
  gap: 8px;
  margin: 0;
  font-weight: normal;
}
.dl-h-sans {
  font-family: 'Cabinet Grotesk', var(--sans);
  font-size: clamp(48px, 7vw, 88px);
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.03em;
  line-height: 1.0;
}
.dl-h-serif {
  font-family: var(--serif);
  font-size: clamp(48px, 7vw, 88px);
  font-style: italic;
  font-weight: 400;
  color: var(--accent);
  letter-spacing: -0.01em;
  line-height: 1.0;
}
.dl-sub {
  font-size: 18px;
  color: var(--text-3);
  line-height: 1.55;
  max-width: 560px;
  margin: 0;
}
.dl-cta-row {
  display: flex; align-items: center; gap: 12px;
  padding-top: 8px;
  flex-wrap: wrap;
}
.dl-btn-primary {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 22px;
  background: var(--accent);
  border: none;
  border-radius: 999px;
  font-family: var(--sans);
  font-size: 15px; font-weight: 600;
  color: var(--on-accent);
  text-decoration: none;
  cursor: pointer;
  transition: filter 120ms ease, transform 120ms ease;
}
.dl-btn-primary:hover { filter: brightness(1.05); transform: translateY(-1px); }
.dl-btn-disabled { background: var(--surface-3); color: var(--text-3); cursor: not-allowed; }
.dl-btn-disabled:hover { filter: none; transform: none; }
.dl-btn-outline {
  display: inline-flex; align-items: center;
  padding: 14px 22px;
  border: 1px solid var(--border-active);
  border-radius: 999px;
  font-size: 15px; font-weight: 500;
  color: var(--text);
  text-decoration: none;
  transition: background 120ms ease, border-color 120ms ease;
}
.dl-btn-outline:hover { background: var(--surface); border-color: var(--text-2); }
.dl-receipt {
  display: flex; align-items: center; gap: 8px;
  margin: 0; padding-top: 4px;
  font-size: 13px; color: var(--text-3);
}
.dl-receipt svg { color: var(--text-3); flex-shrink: 0; }

/* ═══════════════════════ SECTIONS ═══════════════════════ */
.dl-section {
  padding: 24px 64px 32px;
  display: flex; flex-direction: column;
  gap: 20px;
}
.dl-section-eyebrow {
  margin: 0;
  font-size: 13px; color: var(--text-faint);
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}
.dl-state {
  font-size: 14px; color: var(--text-3);
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.dl-state a { color: var(--accent); text-decoration: none; }

/* ═══════════════════════ PLATFORM CARDS ═══════════════════════ */
.dl-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.dl-card {
  display: flex; flex-direction: column;
  gap: 14px;
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  transition: border-color 120ms ease;
}
.dl-card:hover { border-color: var(--border-active); }
.dl-card-head { display: flex; align-items: center; gap: 12px; }
.dl-card-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px;
  border-radius: 10px;
  background: var(--surface-3);
  color: var(--text);
  flex-shrink: 0;
}
.dl-card-title {
  margin: 0;
  font-family: 'Cabinet Grotesk', var(--sans);
  font-size: 18px; font-weight: 600;
  color: var(--text);
}
.dl-card-sub {
  margin: 0;
  font-size: 13px; color: var(--text-3);
}
.dl-card-chips {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: auto;
}
.dl-chip {
  display: inline-flex; align-items: center;
  padding: 6px 12px;
  background: var(--surface-3);
  border-radius: 6px;
  font-size: 12px; font-weight: 500;
  color: var(--text);
  text-decoration: none;
  transition: background 120ms ease;
}
.dl-chip:hover { background: var(--border-active); }
.dl-chip-ghost {
  background: transparent;
  border: 1px solid var(--border-active);
}
.dl-chip-ghost:hover { background: var(--surface-3); }

/* ═══════════════════════ RELEASE NOTES ═══════════════════════ */
.dl-section-notes { padding-bottom: 64px; }
.dl-notes-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
}
.dl-notes-gh {
  font-size: 14px; color: var(--accent);
  text-decoration: none;
}
.dl-notes-gh:hover { text-decoration: underline; }
.dl-notes-card {
  display: flex; flex-direction: column;
  gap: 16px;
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  max-width: 1100px;
}
.dl-notes-row {
  display: flex; align-items: flex-start; gap: 14px;
}
.dl-notes-text {
  font-size: 14px; color: var(--text);
  line-height: 1.55;
  flex: 1;
}
.dl-notes-empty { color: var(--text-3); }
.dl-tag {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}
.dl-tag-feat { background: var(--accent); color: var(--on-accent); }
.dl-tag-fix, .dl-tag-perf {
  background: var(--surface-3);
  border: 1px solid var(--border-active);
  color: var(--text-3);
}

/* ═══════════════════════ FOOTER ═══════════════════════ */
.dl-footer {
  display: flex;
  justify-content: space-between;
  gap: 64px;
  padding: 64px 64px 64px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
.dl-foot-brand {
  display: flex; flex-direction: column;
  gap: 8px;
}
.dl-foot-brand-row {
  display: flex; align-items: center; gap: 8px;
}
.dl-foot-brand-name {
  font-size: 14px; font-weight: 600; color: var(--text);
  letter-spacing: -0.01em;
}
.dl-foot-meta {
  font-size: 12px; color: var(--text-faint);
}
.dl-foot-cols {
  display: flex; gap: 64px;
  flex-wrap: wrap;
}
.dl-foot-col {
  display: flex; flex-direction: column;
  gap: 8px;
  min-width: 100px;
}
.dl-foot-col-head {
  font-size: 12px; font-weight: 600;
  color: var(--text-faint);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.dl-foot-col a {
  font-size: 13px; color: var(--text-3);
  text-decoration: none;
  transition: color 120ms ease;
}
.dl-foot-col a:hover { color: var(--text); }

/* ═══════════════════════ LAPTOP (≤ 1280) ═══════════════════════ */
@media (max-width: 1440px) {
  .dl-h-sans, .dl-h-serif { font-size: clamp(48px, 6vw, 76px); }
  .dl-hero { padding: 96px 64px 48px; }
}

/* ═══════════════════════ TABLET ═══════════════════════ */
@media (max-width: 1080px) {
  .dl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* ═══════════════════════ MOBILE (≤ 640) ═══════════════════════ */
@media (max-width: 640px) {
  .dl-nav { padding: 14px 20px; }
  .dl-nav-left { gap: 20px; }
  .dl-nav-links { display: none; }
  .dl-nav-signin { display: none; }
  .dl-nav-dash { padding: 7px 14px; font-size: 13px; }

  .dl-hero { padding: 32px 20px 28px; gap: 14px; }
  .dl-h-sans, .dl-h-serif { font-size: 42px; letter-spacing: -0.02em; }
  .dl-sub { font-size: 15px; max-width: 100%; }
  .dl-cta-row { flex-direction: column; align-self: stretch; gap: 10px; }
  .dl-btn-primary, .dl-btn-outline {
    align-self: stretch;
    justify-content: center;
    padding: 12px;
    font-size: 14px;
  }
  .dl-receipt { font-size: 12px; align-items: flex-start; }
  .dl-receipt svg { margin-top: 2px; }

  .dl-section { padding: 32px 20px 24px; gap: 14px; }
  .dl-section-eyebrow { font-size: 12px; }

  /* Mobile platform list — single column rows with extension chip pulled right */
  .dl-grid { grid-template-columns: 1fr; gap: 10px; }
  .dl-card { flex-direction: row; align-items: center; gap: 14px; padding: 14px; border-radius: 14px; }
  .dl-card-head { flex: 1; gap: 14px; }
  .dl-card-icon { width: 36px; height: 36px; }
  .dl-card-title { font-size: 14px; font-weight: 600; }
  .dl-card-sub {
    font-size: 12px;
    grid-column: span 1;
    flex: 1;
    margin-top: -2px;
  }
  .dl-card-chips { margin-top: 0; flex-shrink: 0; }
  .dl-card-chips .dl-chip {
    background: transparent;
    color: var(--accent);
    padding: 0;
    font-size: 12px;
  }
  .dl-card-chips .dl-chip:hover { background: transparent; opacity: 0.8; }
  .dl-chip-ghost { display: none; }
  /* On mobile, restructure card so head + sub stack on left, chip on right */
  .dl-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
  }
  .dl-card-head { display: contents; }
  .dl-card-icon { grid-column: 1; grid-row: 1 / span 2; }
  .dl-card-title { grid-column: 2; grid-row: 1; align-self: end; }
  .dl-card-sub { grid-column: 2; grid-row: 2; align-self: start; }
  .dl-card-chips { grid-column: 3; grid-row: 1 / span 2; }

  .dl-section-notes { padding-bottom: 24px; }
  .dl-notes-card { padding: 16px; gap: 14px; }
  .dl-notes-text { font-size: 13px; }
  .dl-tag { padding: 2px 8px; font-size: 10px; border-radius: 4px; }

  .dl-footer { flex-direction: column; gap: 16px; padding: 24px 20px 32px; }
  .dl-foot-cols { gap: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .dl-btn-primary, .dl-btn-outline, .dl-nav-dash, .dl-card { transition: none; }
  .dl-btn-primary:hover { transform: none; }
}
</style>
