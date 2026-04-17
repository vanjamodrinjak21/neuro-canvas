<script setup lang="ts">
interface TocLink {
  id: string
  text: string
  depth: number
}

interface Props {
  toc: { links: TocLink[] } | null | undefined
}

const props = defineProps<Props>()

const activeId = ref<string>('')

const links = computed(() => props.toc?.links ?? [])

function scrollToHeading(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Scroll spy via IntersectionObserver
let observer: IntersectionObserver | null = null

function setupScrollSpy() {
  if (typeof window === 'undefined') return

  observer?.disconnect()

  const headingIds = links.value.map((l) => l.id)
  if (!headingIds.length) return

  const visibleHeadings = new Map<string, IntersectionObserverEntry>()

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visibleHeadings.set(entry.target.id, entry)
        } else {
          visibleHeadings.delete(entry.target.id)
        }
      }

      // Pick the topmost visible heading
      if (visibleHeadings.size > 0) {
        let topEntry: IntersectionObserverEntry | null = null
        for (const entry of visibleHeadings.values()) {
          if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
            topEntry = entry
          }
        }
        if (topEntry) {
          activeId.value = topEntry.target.id
        }
      }
    },
    {
      rootMargin: '-56px 0px -60% 0px',
      threshold: 0,
    },
  )

  for (const id of headingIds) {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  }
}

watch(links, () => {
  nextTick(() => setupScrollSpy())
}, { immediate: true })

onMounted(() => {
  nextTick(() => setupScrollSpy())
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <nav
    v-if="links.length"
    class="docs-toc"
    aria-label="Table of contents"
  >
    <p class="docs-toc__label">On this page</p>
    <ul class="docs-toc__list">
      <li
        v-for="link in links"
        :key="link.id"
        class="docs-toc__item"
        :class="{
          'docs-toc__item--active': activeId === link.id,
          'docs-toc__item--depth-3': link.depth === 3,
        }"
      >
        <a
          :href="`#${link.id}`"
          class="docs-toc__link"
          :class="{ 'docs-toc__link--active': activeId === link.id }"
          @click.prevent="scrollToHeading(link.id)"
        >
          {{ link.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.docs-toc {
  position: sticky;
  top: 56px;
  height: calc(100vh - 56px);
  width: 200px;
  padding: 32px 20px 32px 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
  flex-shrink: 0;
}

.docs-toc::-webkit-scrollbar {
  width: 3px;
}

.docs-toc::-webkit-scrollbar-track {
  background: transparent;
}

.docs-toc::-webkit-scrollbar-thumb {
  background: var(--nc-surface-3);
  border-radius: 3px;
}

.docs-toc__label {
  font-family: 'Inter', var(--nc-font-body);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--nc-text-muted);
  margin-bottom: 12px;
  padding-left: 12px;
}

.docs-toc__list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-left: 1px solid var(--nc-border);
}

.docs-toc__item {
  position: relative;
}

.docs-toc__item--active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--nc-accent);
}

.docs-toc__link {
  display: block;
  font-family: 'Inter', var(--nc-font-body);
  font-size: 12px;
  font-weight: 500;
  color: var(--nc-text-muted);
  text-decoration: none;
  padding: 5px 12px;
  transition: color var(--nc-duration-fast) ease;
  line-height: 1.5;
}

.docs-toc__item--depth-3 .docs-toc__link {
  padding-left: 24px;
}

.docs-toc__link:hover {
  color: var(--nc-text-secondary);
}

.docs-toc__link--active {
  color: var(--nc-accent);
}

/* Light theme */
:root.light .docs-toc__label {
  color: #A1A1AA;
}

:root.light .docs-toc__list {
  border-left-color: var(--nc-border);
}

:root.light .docs-toc__link {
  color: #A1A1AA;
}

:root.light .docs-toc__link:hover {
  color: #555555;
}

:root.light .docs-toc__link--active {
  color: var(--nc-accent);
}
</style>
