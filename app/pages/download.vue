<script setup lang="ts">
/**
 * /download — landing-styled downloads page. Pulls /api/releases/latest,
 * puts a "Download for <detected platform>" button up top, then one card
 * per platform listing the installer files that actually exist in the
 * release (real format, arch, size, direct links). Falls back to
 * GitHub-releases links when the API is unavailable.
 */
definePageMeta({ layout: false })

const { t } = useI18n()

useHead(() => ({ title: `${t('topo.download.title').replace(/\*/g, '')} — NeuroCanvas` }))

const RELEASES = 'https://github.com/vanjamodrinjak21/neuro-canvas/releases'

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

const { data: release } = await useFetch<Release | null>('/api/releases/latest', {
  key: 'releases:latest',
  default: () => null,
})

type Platform = Exclude<Asset['platform'], 'unknown'>

const detected = ref<'' | Platform>('')
onMounted(() => {
  const p = (navigator.platform || '').toLowerCase()
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) detected.value = 'ios'
  else if (/android/.test(ua)) detected.value = 'android'
  else if (p.includes('mac') || /macintosh/.test(ua)) detected.value = 'macos'
  else if (p.includes('win') || /windows/.test(ua)) detected.value = 'windows'
  else if (p.includes('linux') || /linux/.test(ua)) detected.value = 'linux'
})

/** installer formats users actually download, in display order — updater
 * artifacts (app.tar.gz, aab) stay out of the list */
const USER_FACING: Record<Platform, string[]> = {
  macos: ['dmg'],
  windows: ['exe', 'msi'],
  linux: ['AppImage', 'deb'],
  android: ['apk'],
  ios: ['ipa'],
}

const NAMES: Record<Platform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS',
}

function archLabel(a: Asset): string | null {
  if (a.arch === 'aarch64') return a.platform === 'macos' ? 'Apple Silicon' : 'ARM64'
  if (a.arch === 'x86_64') return 'x64'
  if (a.arch === 'universal') return 'Universal'
  if (a.arch === 'i686') return 'x86'
  return null
}

interface FileRow { label: string, size: string, url: string, name: string }

function rowsFor(key: Platform): FileRow[] {
  const assets = (release.value?.assets ?? []).filter((a) => a.platform === key)
  const rows: FileRow[] = []
  for (const fmt of USER_FACING[key]) {
    const a = assets.find((x) => x.format === fmt)
    if (!a) continue
    const arch = archLabel(a)
    rows.push({
      label: `.${a.format}${arch ? ` · ${arch}` : ''}`,
      size: `${Math.round(a.size / 1048576)} MB`,
      url: a.url,
      name: a.name,
    })
  }
  return rows
}

/** one card per platform that actually ships a build in the latest
 * release; static GitHub-releases cards only when the API gave nothing */
const cards = computed(() => {
  const order: Platform[] = ['macos', 'windows', 'linux', 'android', 'ios']
  const out: { key: Platform, name: string, num: string, files: FileRow[] }[] = []
  for (const key of order) {
    const files = rowsFor(key)
    if (!files.length) continue
    out.push({ key, name: NAMES[key], num: String(out.length + 1).padStart(2, '0'), files })
  }
  if (out.length) return out
  const url = release.value?.htmlUrl ?? RELEASES
  return (['macos', 'windows', 'android'] as Platform[]).map((key, i) => ({
    key,
    name: NAMES[key],
    num: String(i + 1).padStart(2, '0'),
    files: [{ label: t('topo.download.viaReleases'), size: '', url, name: '' }],
  }))
})

/** the big button: best installer for the visitor's platform */
const recommended = computed(() => {
  if (!detected.value) return null
  const card = cards.value.find((c) => c.key === detected.value)
  const file = card?.files[0]
  if (!card || !file) return null
  return { platform: card.name, ...file }
})

const versionTag = computed(() => (release.value?.tag ?? 'beta').toUpperCase())

/** app version as published — read from the asset filenames */
const version = computed(() => {
  for (const a of release.value?.assets ?? []) {
    const m = a.name.match(/\d+\.\d+\.\d+/)
    if (m) return m[0]
  }
  return null
})

/** hover tip: exact version + exact file behind the link */
function tip(f: FileRow): string | undefined {
  if (!f.name) return undefined
  return `NeuroCanvas ${version.value ?? versionTag.value} · ${f.name}`
}

const instKey: Record<Platform, string> = {
  macos: 'instMacos',
  windows: 'instWindows',
  linux: 'instLinux',
  android: 'instAndroid',
  ios: 'instMacos', // no sideload story on iOS; never rendered while no ipa ships
}
</script>

<template>
  <LandingShell>
    <main id="content" class="subpage">
    <p class="subpage__eyebrow">
      <span class="num">FIELD KIT</span> · {{ t('topo.download.eyebrow') }}
      <span class="subpage__meta" aria-hidden="true">{{ versionTag }}</span>
    </p>
    <LandingRevealText
      :text="t('topo.download.title')"
      as="h1"
      class="subpage__title"
      immediate
      :delay="0.15"
    />
    <p class="subpage__sub">{{ t('topo.download.sub') }}</p>

    <div v-if="recommended" class="download-cta">
      <a
        class="btn-primary tip"
        :href="recommended.url"
        :data-tip="tip(recommended)"
        target="_blank"
        rel="noopener"
        data-cursor="link"
      >
        {{ t('topo.download.downloadFor', { platform: recommended.platform }) }}
        <span aria-hidden="true">↓</span>
        <span class="sr-only">{{ t('topo.a11y.newTab') }}</span>
      </a>
      <p class="download-cta__meta" aria-hidden="true">
        {{ recommended.label }}{{ recommended.size ? ` · ${recommended.size}` : '' }}
      </p>
    </div>

    <div class="card-grid card-grid--three">
      <div
        v-for="p in cards"
        :key="p.key"
        class="card survey-frame"
        :class="{ 'is-detected': detected === p.key }"
      >
        <p class="card__num">{{ p.num }}</p>
        <h2 class="card__title">{{ p.name }}</h2>
        <div class="card__files">
          <a
            v-for="f in p.files"
            :key="f.label"
            class="card__file tip"
            :href="f.url"
            :data-tip="tip(f)"
            target="_blank"
            rel="noopener"
            data-cursor="link"
          >
            <span>{{ f.label }}</span>
            <span class="card__file-size"
              >{{ f.size }} <span aria-hidden="true">↓</span></span
            >
            <span class="sr-only">{{ t('topo.a11y.newTab') }}</span>
          </a>
        </div>
        <p v-if="detected === p.key" class="card__badge">{{ t('topo.download.detected') }}</p>
      </div>
    </div>

    <section class="install" aria-labelledby="install-title">
      <p id="install-title" class="subpage__eyebrow install__eyebrow">
        <span class="num">HOW TO</span> · {{ t('topo.download.notesTitle') }}
      </p>
      <p class="install__intro">{{ t('topo.download.notesIntro') }}</p>
      <div class="install__grid">
        <div v-for="p in cards" :key="p.key" class="install__item">
          <h3 class="install__name">{{ p.num }} — {{ p.name }}</h3>
          <p class="install__text">{{ t(`topo.download.${instKey[p.key]}`) }}</p>
        </div>
      </div>
    </section>

    <p class="subpage__note">
      {{ t('topo.download.note') }}
      <a :href="release?.htmlUrl ?? RELEASES" target="_blank" rel="noopener" data-cursor="link"
        >GitHub Releases<span class="sr-only">{{ t('topo.a11y.newTab') }}</span></a
      >
    </p>
  </main>
  </LandingShell>
</template>
