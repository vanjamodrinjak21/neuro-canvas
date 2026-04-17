<script setup lang="ts">
interface Props {
  navigation: any[] | null
  path: string
}

const props = defineProps<Props>()

interface Crumb {
  label: string
  to?: string
}

const crumbs = computed<Crumb[]>(() => {
  const result: Crumb[] = [{ label: 'Docs', to: '/docs' }]

  if (!props.path || props.path === '/docs') {
    return result
  }

  const segments = props.path
    .replace(/^\/docs\/?/, '')
    .split('/')
    .filter(Boolean)

  if (!segments.length) return result

  const nav = props.navigation ?? []

  // Walk through segments and try to find matching titles in navigation
  let currentItems = nav
  let currentPath = '/docs'

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (!segment) continue

    currentPath += `/${segment}`
    const isLast = i === segments.length - 1

    // Try to find matching item in navigation tree
    let found: any = null
    for (const item of currentItems) {
      if (item.path === currentPath) {
        found = item
        break
      }
      // Check children
      if (item.children) {
        const child = item.children.find((c: any) => c.path === currentPath)
        if (child) {
          // If this is a section parent, add the parent first
          if (i === segments.length - 1 && segments.length > 1) {
            // Parent section was already handled
          }
          found = child
          break
        }
      }
    }

    // Also check if this segment matches a navigation group (section)
    if (!found) {
      for (const item of currentItems) {
        if (item.path === currentPath || item.title?.toLowerCase().replace(/\s+/g, '-') === segment) {
          found = item
          break
        }
        if (item.children) {
          for (const child of item.children) {
            if (child.path === currentPath) {
              found = child
              break
            }
          }
          if (found) break
        }
      }
    }

    const label = found?.title ?? formatSegment(segment)

    if (isLast) {
      result.push({ label })
    } else {
      result.push({ label, to: currentPath })
      // Descend into children for next iteration
      if (found?.children) {
        currentItems = found.children
      }
    }
  }

  return result
})

function formatSegment(segment: string): string {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
</script>

<template>
  <nav
    v-if="crumbs.length > 1"
    class="docs-breadcrumb"
    aria-label="Breadcrumb"
  >
    <ol class="docs-breadcrumb__list">
      <li
        v-for="(crumb, i) in crumbs"
        :key="i"
        class="docs-breadcrumb__item"
      >
        <span
          v-if="i > 0"
          class="docs-breadcrumb__separator"
          aria-hidden="true"
        >
          &#x203A;
        </span>
        <NuxtLink
          v-if="crumb.to"
          :to="crumb.to"
          class="docs-breadcrumb__link"
        >
          {{ crumb.label }}
        </NuxtLink>
        <span
          v-else
          class="docs-breadcrumb__current"
          aria-current="page"
        >
          {{ crumb.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.docs-breadcrumb {
  margin-bottom: 24px;
}

.docs-breadcrumb__list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
  list-style: none;
  padding: 0;
  margin: 0;
}

.docs-breadcrumb__item {
  display: flex;
  align-items: center;
}

.docs-breadcrumb__separator {
  font-size: 11px;
  color: var(--nc-text-dim);
  margin: 0 6px;
  user-select: none;
  line-height: 1;
}

.docs-breadcrumb__link {
  font-family: 'Inter', var(--nc-font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--nc-ink-soft, var(--nc-text-secondary));
  text-decoration: none;
  transition: color var(--nc-duration-fast) ease;
  line-height: 1;
}

.docs-breadcrumb__link:hover {
  color: var(--nc-accent);
}

.docs-breadcrumb__current {
  font-family: 'Inter', var(--nc-font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--nc-text-secondary);
  line-height: 1;
}

/* Light theme */
:root.light .docs-breadcrumb__separator {
  color: #D4D4D8;
}

:root.light .docs-breadcrumb__link {
  color: #777777;
}

:root.light .docs-breadcrumb__link:hover {
  color: var(--nc-accent);
}

:root.light .docs-breadcrumb__current {
  color: #555555;
}
</style>
