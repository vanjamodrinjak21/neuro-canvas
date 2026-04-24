<script setup lang="ts">
definePageMeta({ layout: false, pageTransition: false })

const route = useRoute()
const { locale } = useI18n()

// Map URL path to locale-specific content path
// /docs/getting-started/introduction → /docs/en/getting-started/introduction
const contentPath = computed(() => {
  const slug = route.path.replace(/^\/docs\/?/, '')
  return `/docs/${locale.value}/${slug}`
})

const { data: page } = await useAsyncData(`docs-${route.path}`, () =>
  queryCollection('docs').path(contentPath.value).first(),
  { watch: [locale] }
)

// Get full navigation tree, then filter to current locale
const { data: fullNavigation } = await useAsyncData('docs-navigation', () =>
  queryCollectionNavigation('docs')
)

// Extract current locale's section from the full tree and strip locale prefix
// Full tree: [{ title: "En", path: "/docs/en", children: [...] }, { title: "Hr", path: "/docs/hr", children: [...] }]
// We want just the children of the matching locale node, with paths cleaned up
const navigation = computed(() => {
  if (!fullNavigation.value) return null

  // The full nav has top-level nodes for en/ and hr/ directories
  // Find the one matching current locale
  const loc = locale.value
  const localeRoot = fullNavigation.value.find(n =>
    n.path === `/docs/${loc}` || (n.path || '').endsWith(`/${loc}`)
  )

  if (!localeRoot?.children) return null

  // Strip locale from all paths: /docs/en/guides → /docs/guides
  function clean(items: any[]): any[] {
    return items.map(item => ({
      ...item,
      path: item.path?.replace(`/docs/${loc}`, '/docs'),
      children: item.children ? clean(item.children) : undefined
    }))
  }

  // Wrap in root "Docs" node so DocsSidebar unwrap logic works unchanged
  return [{ title: 'Docs', path: '/docs', children: clean(localeRoot.children) }]
})

const { data: rawSurround } = await useAsyncData(`docs-surround-${route.path}`, () =>
  queryCollectionItemSurroundings('docs', contentPath.value),
  { watch: [locale] }
)

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
