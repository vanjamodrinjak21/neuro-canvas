<script setup lang="ts">
interface Props {
  open: boolean
  navigation: any[] | null
  currentPath: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

// Close on route change
watch(
  () => props.currentPath,
  () => {
    if (props.open) {
      emit('close')
    }
  },
)

// Lock body scroll when drawer is open
watch(
  () => props.open,
  (isOpen) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = isOpen ? 'hidden' : ''
  },
)

// Handle escape key
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="open"
        class="docs-drawer"
      >
        <!-- Backdrop -->
        <div
          class="docs-drawer__backdrop"
          @click="emit('close')"
        />

        <!-- Panel -->
        <aside class="docs-drawer__panel">
          <!-- Close button -->
          <div class="docs-drawer__header">
            <NuxtLink to="/docs" class="docs-drawer__brand">
              <NcLogo :size="12" :container-size="24" :radius="5" />
              <span class="docs-drawer__brand-text">Docs</span>
            </NuxtLink>
            <button
              class="docs-drawer__close"
              aria-label="Close navigation"
              @click="emit('close')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Sidebar content -->
          <div class="docs-drawer__content">
            <DocsSidebar
              :navigation="navigation"
              :current-path="currentPath"
            />
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.docs-drawer {
  position: fixed;
  inset: 0;
  z-index: 150;
}

.docs-drawer__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.docs-drawer__panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  max-width: calc(100vw - 48px);
  background: var(--nc-bg);
  border-right: 1px solid var(--nc-border);
  z-index: 151;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.docs-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid var(--nc-border);
  flex-shrink: 0;
}

.docs-drawer__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--nc-text);
}

.docs-drawer__brand-text {
  font-family: 'Inter', var(--nc-font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--nc-text);
}

.docs-drawer__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: 6px;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.docs-drawer__close:hover {
  color: var(--nc-text);
  background: rgba(255, 255, 255, 0.06);
}

.docs-drawer__content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
}

.docs-drawer__content::-webkit-scrollbar {
  width: 3px;
}

.docs-drawer__content::-webkit-scrollbar-track {
  background: transparent;
}

.docs-drawer__content::-webkit-scrollbar-thumb {
  background: var(--nc-surface-3);
  border-radius: 3px;
}

/* Slide transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-enter-active .docs-drawer__panel,
.drawer-leave-active .docs-drawer__panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .docs-drawer__panel,
.drawer-leave-to .docs-drawer__panel {
  transform: translateX(-100%);
}

.drawer-enter-to,
.drawer-leave-from {
  opacity: 1;
}

.drawer-enter-to .docs-drawer__panel,
.drawer-leave-from .docs-drawer__panel {
  transform: translateX(0);
}

/* Light theme */
:root.light .docs-drawer__backdrop {
  background: rgba(0, 0, 0, 0.3);
}

:root.light .docs-drawer__panel {
  background: var(--nc-bg);
  border-right-color: var(--nc-border);
}

:root.light .docs-drawer__header {
  border-bottom-color: var(--nc-border);
}

:root.light .docs-drawer__close:hover {
  background: rgba(0, 0, 0, 0.06);
}
</style>
