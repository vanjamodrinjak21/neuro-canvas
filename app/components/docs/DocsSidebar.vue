<script setup lang="ts">
interface NavItem {
  title: string
  path: string
  children?: NavItem[]
}

interface Props {
  navigation: NavItem[] | null
  currentPath: string
}

const props = defineProps<Props>()

/**
 * Nuxt Content v3 queryCollectionNavigation returns:
 * [{ title: "Docs", path: "/docs", children: [{ title: "Getting Started", ... }, ...] }]
 *
 * The docs page pre-filters by locale and wraps in a root "Docs" node,
 * so we just unwrap the first item's children as section groups.
 */
const sections = computed<NavItem[]>(() => {
  if (!props.navigation || !props.navigation.length) return []
  // If the first item has children, it's the root "docs" node — unwrap it
  const root = props.navigation[0]
  if (root?.children?.length) {
    return root.children
  }
  // Fallback: treat top-level items as sections
  return props.navigation
})

const iconMap: Record<string, string> = {
  'getting started': 'rocket',
  'početak': 'rocket',
  'guides': 'book-open',
  'vodiči': 'book-open',
  'platforms': 'monitor',
  'platforme': 'monitor',
  'self-hosting': 'server',
  'self hosting': 'server',
  'samostalno postavljanje': 'server',
  'api reference': 'code',
  'api': 'code',
  'changelog': 'clock',
  'povijest promjena': 'clock',
}

function iconFor(title: string): string {
  return iconMap[title.toLowerCase()] ?? 'document'
}

function isActive(path: string): boolean {
  return props.currentPath === path
}
</script>

<template>
  <aside class="docs-sidebar">
    <nav class="docs-sidebar__nav">
      <template v-if="sections.length">
        <div
          v-for="section in sections"
          :key="section.path"
          class="docs-sidebar__section"
        >
          <!-- Section label with icon -->
          <div class="docs-sidebar__section-label">
            <!-- Rocket -->
            <svg v-if="iconFor(section.title) === 'rocket'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
            <!-- Book open -->
            <svg v-else-if="iconFor(section.title) === 'book-open'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <!-- Monitor -->
            <svg v-else-if="iconFor(section.title) === 'monitor'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <!-- Server -->
            <svg v-else-if="iconFor(section.title) === 'server'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            <!-- Code brackets -->
            <svg v-else-if="iconFor(section.title) === 'code'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <!-- Clock -->
            <svg v-else-if="iconFor(section.title) === 'clock'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <!-- Fallback: document -->
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>

            <span>{{ section.title }}</span>
          </div>

          <!-- Child nav items -->
          <ul v-if="section.children?.length" class="docs-sidebar__list">
            <li
              v-for="child in section.children"
              :key="child.path"
              class="docs-sidebar__item"
            >
              <NuxtLink
                :to="child.path"
                class="docs-sidebar__link"
                :class="{ 'docs-sidebar__link--active': isActive(child.path) }"
              >
                {{ child.title }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </template>

      <!-- Empty state -->
      <div v-else class="docs-sidebar__empty">
        <span>No navigation</span>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.docs-sidebar {
  position: sticky;
  top: 56px;
  width: 260px;
  height: calc(100vh - 56px);
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--nc-surface);
  border-right: 1px solid var(--nc-border);
  flex-shrink: 0;
  transition: background var(--nc-duration-slow) ease, border-color var(--nc-duration-slow) ease;
}

:root.light .docs-sidebar {
  background: #FFFFFF;
}

.docs-sidebar::-webkit-scrollbar { width: 4px; }
.docs-sidebar::-webkit-scrollbar-track { background: transparent; }
.docs-sidebar::-webkit-scrollbar-thumb { background: var(--nc-border-active); border-radius: 2px; }
.docs-sidebar::-webkit-scrollbar-thumb:hover { background: var(--nc-text-muted); }

.docs-sidebar__nav {
  padding: 16px 0;
}

.docs-sidebar__section {
  margin-bottom: 8px;
}

.docs-sidebar__section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  font-family: 'Inter', var(--nc-font-body);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--nc-text-dim);
  user-select: none;
}

.docs-sidebar__section-label svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.docs-sidebar__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.docs-sidebar__item {
  margin: 0;
  padding: 0;
}

.docs-sidebar__link {
  display: block;
  padding: 7px 20px;
  font-family: 'Inter', var(--nc-font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--nc-text-muted);
  text-decoration: none;
  border-left: 2px solid transparent;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.docs-sidebar__link:hover {
  color: var(--nc-text-secondary);
  background: rgba(255, 255, 255, 0.03);
}

:root.light .docs-sidebar__link:hover {
  background: rgba(0, 0, 0, 0.03);
}

.docs-sidebar__link--active {
  color: #00D2BE;
  border-left-color: #00D2BE;
  background: rgba(0, 210, 190, 0.06);
}

.docs-sidebar__link--active:hover {
  color: #00D2BE;
  background: rgba(0, 210, 190, 0.08);
}

.docs-sidebar__empty {
  padding: 24px 20px;
  font-family: 'Inter', var(--nc-font-body);
  font-size: 13px;
  color: var(--nc-text-muted);
}

@media (max-width: 768px) {
  .docs-sidebar {
    position: fixed;
    top: 56px;
    left: 0;
    z-index: 99;
    width: 280px;
    box-shadow: var(--nc-shadow-lg);
    transform: translateX(-100%);
    transition: transform var(--nc-duration-normal) var(--nc-ease),
                background var(--nc-duration-slow) ease, border-color var(--nc-duration-slow) ease;
  }
  .docs-sidebar.is-open {
    transform: translateX(0);
  }
}
</style>
