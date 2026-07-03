<script setup lang="ts">
/**
 * /download — landing-styled downloads page. Pulls /api/releases/latest and
 * builds the platform cards from the assets that actually exist in the
 * release (real format, arch and size, direct download links), with a
 * GitHub-releases fallback when the API is unavailable. Per-platform
 * install notes cover the first-launch security prompts.
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

/** preferred install format per platform — first published match wins */
const PREFERRED: Record<Platform, string[]> = {
  macos: ['dmg', 'app.tar.gz'],
  windows: ['exe', 'msi', 'nsis.zip'],
  linux: ['AppImage', 'deb'],
  android: ['apk', 'aab'],
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

function fileLine(a: Asset): string {
  const bits = [`.${a.format}`]
  const arch = archLabel(a)
  if (arch) bits.push(arch)
  bits.push(`${Math.round(a.size / 1048576)} MB`)
  return bits.join(' · ')
}

/** one card per platform that actually has a build in the latest release;
 * static GitHub-releases cards only when the API gave us nothing */
const cards = computed(() => {
  const order: Platform[] = ['macos', 'windows', 'linux', 'android', 'ios']
  const out: { key: Platform, name: string, file: string, url: string, num: string }[] = []
  for (const key of order) {
    const assets = (release.value?.assets ?? []).filter((a) => a.platform === key)
    if (!assets.length) continue
    const best
      = PREFERRED[key].map((f) => assets.find((a) => a.format === f)).find(Boolean) ?? assets[0]!
    out.push({
      key,
      name: NAMES[key],
      file: fileLine(best),
      url: best.url,
      num: String(out.length + 1).padStart(2, '0'),
    })
  }
  if (out.length) return out
  return (['macos', 'windows', 'android'] as Platform[]).map((key, i) => ({
    key,
    name: NAMES[key],
    file: t('topo.download.viaReleases'),
    url: release.value?.htmlUrl ?? RELEASES,
    num: String(i + 1).padStart(2, '0'),
  }))
})

const versionTag = computed(() => (release.value?.tag ?? 'beta').toUpperCase())

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

    <div class="card-grid card-grid--three">
      <a
        v-for="p in cards"
        :key="p.key"
        class="card survey-frame"
        :class="{ 'is-detected': detected === p.key }"
        :href="p.url"
        target="_blank"
        rel="noopener"
        data-cursor="link"
      >
        <p class="card__num">{{ p.num }}</p>
        <h2 class="card__title">{{ p.name }}</h2>
        <p class="card__desc">{{ p.file }}</p>
        <p v-if="detected === p.key" class="card__badge">{{ t('topo.download.detected') }}</p>
        <span class="card__go" aria-hidden="true">↓</span>
        <span class="sr-only">{{ t('topo.a11y.newTab') }}</span>
      </a>
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
