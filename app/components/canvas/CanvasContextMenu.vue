<script setup lang="ts">
import type { ContextMenuItem } from '~/components/ui/NcContextMenu.vue'

defineProps<{
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  close: []
  select: [item: ContextMenuItem]
}>()

// Node color swatches are category DATA — mapped to --nc-node-* tokens and
// delivered via the single-custom-property pattern (REDESIGN.md §9).
const SWATCH_COLORS: Record<string, string> = {
  Teal: 'var(--nc-accent)',
  Purple: 'var(--nc-node-purple)',
  Pink: 'var(--nc-node-pink)',
  Blue: 'var(--nc-node-blue)',
  Green: 'var(--nc-node-green)'
}

function swatchColor(label?: string): string | undefined {
  return label ? SWATCH_COLORS[label] : undefined
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ccm-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-dropdown"
        @click="emit('close')"
        @contextmenu.prevent="emit('close')"
      >
        <div
          class="ccm-menu"
          :style="{ '--menu-x': `${position.x}px`, '--menu-y': `${position.y}px` }"
          @click.stop
        >
          <template v-for="(item, index) in items" :key="index">
            <div v-if="item.type === 'separator'" class="ccm-divider" />
            <div v-else-if="item.children" class="relative group">
              <button class="ccm-item">
                <span v-if="item.icon" :class="[item.icon, 'text-base']" />
                <span class="flex-1 text-left">{{ item.label }}</span>
                <span class="i-lucide-chevron-right text-base opacity-50" />
              </button>
              <div class="ccm-submenu">
                <button
                  v-for="(child, childIndex) in item.children"
                  :key="childIndex"
                  class="ccm-item"
                  @click="child.action?.(); emit('close')"
                >
                  <span
                    v-if="child.icon"
                    :class="[child.icon, 'text-base', 'ccm-swatch']"
                    :style="{ '--swatch-color': swatchColor(child.label) }"
                  />
                  <span>{{ child.label }}</span>
                </button>
              </div>
            </div>
            <button
              v-else
              :disabled="item.disabled"
              :class="[
                'ccm-item',
                item.disabled && 'ccm-item--disabled',
                item.danger && 'ccm-item--danger'
              ]"
              @click="item.action?.(); emit('close')"
            >
              <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
              <span class="flex-1 text-left">{{ item.label }}</span>
              <span v-if="item.shortcut" class="ccm-shortcut">{{ item.shortcut }}</span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Context menu — flat surface-2 + hairline, radius ≤ 0.5rem (REDESIGN.md §5) */
.ccm-menu {
  position: absolute;
  left: var(--menu-x);
  top: var(--menu-y);
  transform-origin: top left;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  padding: 6px;
  min-width: 200px;
  box-shadow: var(--nc-shadow-md);
}

.ccm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 0.4rem;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
  text-align: left;
}

/* Hover: surface-3 fill + text brighten (REDESIGN.md §5) */
@media (hover: hover) and (pointer: fine) {
  .ccm-item:hover {
    background: var(--nc-surface-3);
    color: var(--nc-text);
  }
}

.ccm-item:active {
  background: var(--nc-surface-3);
  transform: scale(0.97);
}

.ccm-item--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (hover: hover) and (pointer: fine) {
  .ccm-item--disabled:hover {
    background: transparent;
    color: var(--nc-text-secondary);
  }
}

/* Destructive item — coral only (REDESIGN.md §1 accent discipline) */
.ccm-item--danger {
  color: var(--nc-coral);
}

@media (hover: hover) and (pointer: fine) {
  .ccm-item--danger:hover {
    color: var(--nc-coral);
    background: rgba(var(--nc-coral-rgb), 0.1);
  }
}

/* Node color swatch — data color via custom property */
.ccm-swatch {
  color: var(--swatch-color, inherit);
}

/* Shortcut hint — mono micro-label (REDESIGN.md §4) */
.ccm-shortcut {
  font-family: var(--nc-font-mono);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--nc-text-muted);
}

.ccm-divider {
  height: 1px;
  background: var(--nc-border);
  margin: 4px 6px;
}

.ccm-submenu {
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 4px;
  transform-origin: top left;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  padding: 6px;
  min-width: 140px;
  box-shadow: var(--nc-shadow-md);
  opacity: 0;
  visibility: hidden;
  transform: scale(0.97);
  transition:
    opacity 150ms var(--nc-ease),
    transform 150ms var(--nc-ease),
    visibility 150ms var(--nc-ease);
}

.group:hover > .ccm-submenu {
  opacity: 1;
  visibility: visible;
  transform: scale(1);
}

/* Enter: scale(0.97)+opacity, origin at trigger, 150ms; exit faster (§5/§6) */
.ccm-fade-enter-active {
  transition: opacity 150ms var(--nc-ease);
}

.ccm-fade-leave-active {
  transition: opacity 100ms var(--nc-ease);
}

.ccm-fade-enter-from,
.ccm-fade-leave-to {
  opacity: 0;
}

.ccm-fade-enter-active .ccm-menu {
  transition: transform 150ms var(--nc-ease);
}

.ccm-fade-enter-from .ccm-menu {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .ccm-fade-enter-from .ccm-menu {
    transform: none;
  }

  .ccm-item,
  .ccm-submenu {
    transition: opacity 150ms var(--nc-ease);
  }
}
</style>
