<script setup lang="ts">
import type { Node } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'

const props = defineProps<{
  visible: boolean
  node: Node | null
}>()

const emit = defineEmits<{
  close: []
  navigate: [nodeId: string]
}>()

const mapStore = useMapStore()

// Get backlinks (nodes that link TO this node)
const backlinks = computed(() => {
  if (!props.node) return []
  return mapStore.getBackLinks(props.node.id)
})

// Get outgoing links (nodes this node links TO)
const outlinks = computed(() => {
  if (!props.node) return []
  return mapStore.getOutLinks(props.node.id)
})

// Navigate to a node
function navigateTo(node: Node) {
  emit('navigate', node.id)
}

// Get node preview text (truncated)
function getPreviewText(content: string, maxLength: number = 50): string {
  if (!content) return 'Untitled'
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength - 3) + '...'
}

// Get node accent color (from border or default)
function getNodeColor(node: Node): string {
  return node.style.borderColor || 'var(--nc-accent)'
}
</script>

<template>
  <Transition name="backlinks-slide">
    <aside
      v-if="visible && node"
      class="fixed right-0 top-0 bottom-0 w-80 z-dropdown nc-glass-elevated flex flex-col"
    >
      <!-- Header -->
      <header class="px-4 py-3 border-b border-nc-border nc-between shrink-0">
        <div class="nc-row gap-2 items-center">
          <div class="w-7 h-7 rounded-nc-md bg-nc-accent/10 nc-center">
            <span class="i-lucide-link text-nc-accent" />
          </div>
          <span class="font-display font-semibold text-sm text-nc-ink">{{ $t('canvas.backlinks.links') }}</span>
        </div>
        <button
          class="w-7 h-7 rounded-nc-md nc-center text-nc-ink-muted hover:text-nc-ink hover:bg-nc-surface-3 nc-anim cursor-pointer active:scale-97"
          @click="emit('close')"
        >
          <span class="i-lucide-x text-lg" />
        </button>
      </header>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Current Node Info -->
        <div class="p-4 border-b border-nc-border">
          <div class="font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em] text-nc-text-secondary mb-2">
            Current Node
          </div>
          <div
            class="backlinks-node-card p-3 rounded-nc-md bg-nc-chip"
            :style="{ '--node-color': getNodeColor(node) }"
          >
            <p class="text-sm text-nc-ink font-medium">{{ getPreviewText(node.content, 80) }}</p>
          </div>
        </div>

        <!-- Backlinks Section -->
        <section class="p-4 border-b border-nc-border">
          <div class="nc-between mb-3">
            <div class="nc-row gap-2 items-center">
              <span class="i-lucide-corner-down-left text-nc-accent" />
              <span class="font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em] text-nc-text-secondary">
                Backlinks
              </span>
            </div>
            <span class="font-mono text-[0.7rem] text-nc-text-secondary bg-nc-chip border border-nc-border px-2 py-0.5 rounded-[0.4rem]">
              {{ backlinks.length }}
            </span>
          </div>

          <div v-if="backlinks.length === 0" class="text-sm text-nc-ink-muted italic py-2">
            No nodes link to this one
          </div>

          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="link in backlinks"
              :key="link.id"
              class="group"
            >
              <button
                class="w-full text-left p-3 rounded-nc-md bg-nc-chip hover:bg-nc-surface-3 border border-nc-border hover:border-nc-border-active nc-anim cursor-pointer active:scale-97 flex items-center gap-3"
                @click="navigateTo(link)"
              >
                <div
                  class="backlinks-dot w-3 h-3 rounded-full shrink-0"
                  :style="{ '--node-color': getNodeColor(link) }"
                />
                <span class="text-sm text-nc-ink-soft group-hover:text-nc-ink flex-1 truncate">
                  {{ getPreviewText(link.content) }}
                </span>
                <span class="i-lucide-arrow-right text-nc-ink-muted opacity-0 group-hover:opacity-100 transition-opacity duration-nc-fast ease-nc-ease" />
              </button>
            </li>
          </ul>
        </section>

        <!-- Outgoing Links Section -->
        <section class="p-4">
          <div class="nc-between mb-3">
            <div class="nc-row gap-2 items-center">
              <span class="i-lucide-corner-right-up text-nc-text-secondary" />
              <span class="font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em] text-nc-text-secondary">
                Outgoing Links
              </span>
            </div>
            <span class="font-mono text-[0.7rem] text-nc-text-secondary bg-nc-chip border border-nc-border px-2 py-0.5 rounded-[0.4rem]">
              {{ outlinks.length }}
            </span>
          </div>

          <div v-if="outlinks.length === 0" class="text-sm text-nc-ink-muted italic py-2">
            This node doesn't link to any others
          </div>

          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="link in outlinks"
              :key="link.id"
              class="group"
            >
              <button
                class="w-full text-left p-3 rounded-nc-md bg-nc-chip hover:bg-nc-surface-3 border border-nc-border hover:border-nc-border-active nc-anim cursor-pointer active:scale-97 flex items-center gap-3"
                @click="navigateTo(link)"
              >
                <div
                  class="backlinks-dot w-3 h-3 rounded-full shrink-0"
                  :style="{ '--node-color': getNodeColor(link) }"
                />
                <span class="text-sm text-nc-ink-soft group-hover:text-nc-ink flex-1 truncate">
                  {{ getPreviewText(link.content) }}
                </span>
                <span class="i-lucide-arrow-right text-nc-ink-muted opacity-0 group-hover:opacity-100 transition-opacity duration-nc-fast ease-nc-ease" />
              </button>
            </li>
          </ul>
        </section>
      </div>

      <!-- Footer -->
      <footer class="p-4 border-t border-nc-border shrink-0">
        <button
          class="w-full py-2 px-4 rounded-nc-md bg-nc-chip border border-nc-border hover:bg-nc-surface-3 text-nc-ink-soft hover:text-nc-ink text-sm font-medium nc-anim cursor-pointer active:scale-97 nc-center gap-2"
          @click="mapStore.openLocalGraph(node.id)"
        >
          <span class="i-lucide-git-branch" />
          Open Local Graph
        </button>
      </footer>
    </aside>
  </Transition>
</template>

<style scoped>
/* Drawer motion — transform/opacity only, explicit properties, single ease
   (REDESIGN.md §6). Enter 200ms, exit 150ms. */
.backlinks-slide-enter-active {
  transition: transform 200ms var(--nc-ease), opacity 200ms var(--nc-ease);
}
.backlinks-slide-leave-active {
  transition: transform 150ms var(--nc-ease), opacity 150ms var(--nc-ease);
}
.backlinks-slide-enter-from,
.backlinks-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Node-color data markers — per-item value arrives as a single custom
   property from the template (the one allowed :style form, REDESIGN.md §9). */
.backlinks-node-card {
  border-left: 2px solid var(--node-color, var(--nc-accent));
}
.backlinks-dot {
  background: var(--node-color, var(--nc-accent));
}
</style>
