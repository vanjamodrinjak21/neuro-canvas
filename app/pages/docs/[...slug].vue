<script setup lang="ts">
definePageMeta({ layout: false, pageTransition: false })

const route = useRoute()
const { locale } = useI18n()

// Build locale-aware content path: /docs/getting-started/intro → /docs/en/getting-started/intro
const localePath = computed(() => {
  const slug = route.path.replace(/^\/docs\/?/, '')
  return `/docs/${locale.value}/${slug}`
})

const { data: page } = await useAsyncData(`docs-${locale.value}-${route.path}`, () =>
  queryCollection('docs').path(localePath.value).first()
)

// Navigation scoped to current locale's docs
const { data: rawNavigation } = await useAsyncData(`docs-navigation-${locale.value}`, () =>
  queryCollectionNavigation('docs')
)

// Strip locale prefix from content paths so nav links match URL routes
// e.g. /docs/en/getting-started → /docs/getting-started
function stripLocalePaths(items: any[] | undefined, loc: string): any[] {
  if (!items) return []
  return items.map(item => ({
    ...item,
    path: item.path?.replace(`/docs/${loc}`, '/docs'),
    children: item.children ? stripLocalePaths(item.children, loc) : undefined
  }))
}

// Filter navigation to current locale and strip locale prefix from paths
const navigation = computed(() => {
  if (!rawNavigation.value) return null
  const loc = locale.value
  // Find the locale root in the nav tree — match by path ending or title
  const localeNode = rawNavigation.value.find(n => {
    const p = n.path || ''
    return p === `/docs/${loc}` || p === `/${loc}` || p.endsWith(`/${loc}`)
      || n.title?.toLowerCase() === loc
  })
  if (!localeNode?.children) return rawNavigation.value
  return stripLocalePaths(localeNode.children, loc)
})

const { data: rawSurround } = await useAsyncData(`docs-surround-${locale.value}-${route.path}`, () =>
  queryCollectionItemSurroundings('docs', localePath.value)
)

// Strip locale prefix from prev/next paths
const surround = computed(() => {
  if (!rawSurround.value) return null
  const loc = locale.value
  return rawSurround.value.map((item: any) =>
    item ? { ...item, path: item.path?.replace(`/docs/${loc}`, '/docs') } : item
  )
})

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

useSeoMeta({
  title: () => page.value?.title ? `${page.value.title} — NeuroCanvas Docs` : 'NeuroCanvas Docs',
  description: () => page.value?.description ?? 'NeuroCanvas documentation',
  ogTitle: () => page.value?.title ? `${page.value.title} — NeuroCanvas Docs` : 'NeuroCanvas Docs',
  ogDescription: () => page.value?.description ?? 'NeuroCanvas documentation'
})

useHead({
  htmlAttrs: { lang: locale.value }
})
</script>

<template>
  <DocsLayout :navigation="navigation" :toc="page?.body?.toc">
    <template #breadcrumb>
      <DocsBreadcrumb :navigation="navigation" :path="route.path" />
    </template>

    <ContentRenderer v-if="page" :value="page" />

    <template #bottom>
      <DocsPrevNext
        :prev="surround?.[0]"
        :next="surround?.[1]"
      />
    </template>
  </DocsLayout>
</template>
