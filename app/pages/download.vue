<script setup lang="ts">
/**
 * /download — landing-styled downloads page. Pulls /api/releases/latest,
 * detects the visitor platform and links each card to the best asset,
 * falling back to GitHub releases when a build isn't published yet.
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

type Platform = 'macos' | 'windows' | 'linux'

const detected = ref<'' | Platform>('')
onMounted(() => {
  const p = (navigator.platform || '').toLowerCase()
  const ua = navigator.userAgent.toLowerCase()
  if (p.includes('mac') || /macintosh/.test(ua)) detected.value = 'macos'
  else if (p.includes('win') || /windows/.test(ua)) detected.value = 'windows'
  else if (p.includes('linux') || /linux/.test(ua)) detected.value = 'linux'
})

/** preferred install format per platform — first published match wins */
const PREFERRED: Record<Platform, string[]> = {
  macos: ['dmg', 'app.tar.gz'],
  windows: ['msi', 'exe', 'nsis.zip'],
  linux: ['AppImage', 'deb'],
}

function assetFor(key: Platform): string {
  const assets = (release.value?.assets ?? []).filter((a) => a.platform === key)
  for (const fmt of PREFERRED[key]) {
    const hit = assets.find((a) => a.format === fmt)
    if (hit) return hit.url
  }
  return assets[0]?.url ?? release.value?.htmlUrl ?? RELEASES
}

const platforms = computed(() => [
  { key: 'macos' as Platform, name: 'macOS', file: '.dmg · Apple Silicon + Intel', num: '01' },
  { key: 'windows' as Platform, name: 'Windows', file: '.exe · x64', num: '02' },
  { key: 'linux' as Platform, name: 'Linux', file: '.AppImage / .deb', num: '03' },
])
</script>

<template>
  <LandingShell>
    <main id="content" class="subpage">
    <p class="subpage__eyebrow">
      <span class="num">FIELD KIT</span> · {{ t('topo.download.eyebrow') }}
      <span class="subpage__meta" aria-hidden="true">BETA</span>
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
        v-for="p in platforms"
        :key="p.key"
        class="card survey-frame"
        :class="{ 'is-detected': detected === p.key }"
        :href="assetFor(p.key)"
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

    <p class="subpage__note">
      {{ t('topo.download.note') }}
      <a :href="RELEASES" target="_blank" rel="noopener" data-cursor="link"
        >GitHub Releases<span class="sr-only">{{ t('topo.a11y.newTab') }}</span></a
      >
    </p>
  </main>
  </LandingShell>
</template>
