<script setup lang="ts">
definePageMeta({ layout: false, pageTransition: false })

const route = useRoute()
const { locale } = useI18n()

// Content path within the locale collection: /docs/getting-started/intro → /docs/en/getting-started/intro
const contentPath = computed(() => {
  const slug = route.path.replace(/^\/docs\/?/, '')
  return `/docs/${locale.value}/${slug}`
})

// Query the locale-specific collection
const collectionKey = computed(() => locale.value === 'hr' ? 'docs_hr' : 'docs_en')

const { data: page } = await useAsyncData(`docs-${locale.value}-${route.path}`, () =>
  queryCollection(collectionKey.value as 'docs_en' | 'docs_hr').path(contentPath.value).first()
)

const { data: rawNavigation } = await useAsyncData(`docs-nav-${locale.value}`, () =>
  queryCollectionNavigation(collectionKey.value as 'docs_en' | 'docs_hr')
)

// Strip locale prefix from paths so nav links match clean URLs
// /docs/en/getting-started → /docs/getting-started
function stripLocale(items: any[] | undefined): any[] {
  if (!items) return []
  const prefix = `/docs/${locale.value}`
  return items.map(item => ({
    ...item,
    path: item.path?.replace(prefix, '/docs'),
    children: item.children ? stripLocale(item.children) : undefined
  }))
}

const navigation = computed(() => {
  if (!rawNavigation.value) return null
  return stripLocale(rawNavigation.value)
})

const { data: rawSurround } = await useAsyncData(`docs-surround-${locale.value}-${route.path}`, () =>
  queryCollectionItemSurroundings(collectionKey.value as 'docs_en' | 'docs_hr', contentPath.value)
)

const surround = computed(() => {
  if (!rawSurround.value) return null
  const prefix = `/docs/${locale.value}`
  return rawSurround.value.map((item: any) =>
    item ? { ...item, path: item.path?.replace(prefix, '/docs') } : item
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
