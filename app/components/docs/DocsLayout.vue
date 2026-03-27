<script setup lang="ts">
interface Props {
  navigation: any[] | null
  toc: any
}

defineProps<Props>()

const isMobileDrawerOpen = ref(false)
const route = useRoute()

function toggleMobileDrawer() {
  isMobileDrawerOpen.value = !isMobileDrawerOpen.value
}

// Close drawer on navigation
watch(
  () => route.fullPath,
  () => {
    isMobileDrawerOpen.value = false
  },
)
</script>

<template>
  <div class="docs-root">
    <DocsHeader @toggle-sidebar="toggleMobileDrawer" />

    <div class="docs-wrapper">
      <!-- Left: Sidebar -->
      <aside class="docs-sidebar-col">
        <DocsSidebar
          :navigation="navigation"
          :current-path="route.path"
        />
      </aside>

      <!-- Center: Content -->
      <div class="docs-content-col">
        <main class="docs-content">
          <slot name="breadcrumb" />
          <slot />
          <slot name="bottom" />
        </main>
      </div>

      <!-- Right: Table of Contents -->
      <aside class="docs-toc-col">
        <DocsToc :toc="toc" />
      </aside>
    </div>

    <!-- Mobile drawer -->
    <DocsMobileDrawer
      :open="isMobileDrawerOpen"
      :navigation="navigation"
      :current-path="route.path"
      @close="isMobileDrawerOpen = false"
    />
  </div>
</template>

<style scoped>
.docs-root {
  min-height: 100vh;
  background: var(--nc-bg);
  transition: background 0.3s ease;
}

.docs-wrapper {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 200px;
  margin-top: 56px;
  min-height: calc(100vh - 56px);
}

.docs-sidebar-col {
  position: sticky;
  top: 56px;
  height: calc(100vh - 56px);
  overflow-y: auto;
  border-right: 1px solid var(--nc-border);
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
}

.docs-sidebar-col::-webkit-scrollbar {
  width: 3px;
}

.docs-sidebar-col::-webkit-scrollbar-track {
  background: transparent;
}

.docs-sidebar-col::-webkit-scrollbar-thumb {
  background: var(--nc-surface-3);
  border-radius: 3px;
}

.docs-content-col {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.docs-content {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 40px 80px;
}

.docs-toc-col {
  border-left: 1px solid var(--nc-border);
}

/* Responsive: hide TOC at <=1280px */
@media (max-width: 1280px) {
  .docs-wrapper {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .docs-toc-col {
    display: none;
  }
}

/* Responsive: hide sidebar at <=768px */
@media (max-width: 768px) {
  .docs-wrapper {
    grid-template-columns: minmax(0, 1fr);
  }

  .docs-sidebar-col {
    display: none;
  }

  .docs-content {
    padding: 24px 16px 60px;
  }
}

/* Light theme */
:root.light .docs-root {
  background: var(--nc-bg);
}

:root.light .docs-sidebar-col {
  border-right-color: var(--nc-border);
}

:root.light .docs-toc-col {
  border-left-color: var(--nc-border);
}
</style>
