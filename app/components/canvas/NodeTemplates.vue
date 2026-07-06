<script setup lang="ts">
import type { NodeStyle } from '~/types'

export interface NodeTemplate {
  id: string
  name: string
  icon: string
  category: 'basic' | 'status' | 'priority' | 'content'
  shape: 'rounded' | 'circle' | 'diamond'
  fillColor: string
  borderColor: string
  textColor: string
}

const props = defineProps<{
  visible: boolean
  position?: { x: number; y: number }
}>()

const emit = defineEmits<{
  close: []
  select: [template: NodeTemplate]
}>()

// Node style data (applied to created nodes by the canvas renderer — kept as
// concrete values; the legacy teal accent is aligned to the canonical accent).
const templates: NodeTemplate[] = [
  // Basic
  { id: 'text', name: 'Text', icon: 'i-lucide-type', category: 'basic', shape: 'rounded', fillColor: '#1A1A1E', borderColor: '#2A2A30', textColor: '#E8E8EC' },
  { id: 'idea', name: 'Idea', icon: 'i-lucide-lightbulb', category: 'basic', shape: 'circle', fillColor: '#1A1A1E', borderColor: '#5EF2E8', textColor: '#E8E8EC' },
  { id: 'keypoint', name: 'Key Point', icon: 'i-lucide-star', category: 'basic', shape: 'diamond', fillColor: '#1A1A1E', borderColor: '#EAB308', textColor: '#E8E8EC' },
  { id: 'note', name: 'Note', icon: 'i-lucide-sticky-note', category: 'basic', shape: 'rounded', fillColor: '#2A2A30', borderColor: '#3A3A42', textColor: '#C8C8D0' },

  // Status
  { id: 'done', name: 'Done', icon: 'i-lucide-check-circle', category: 'status', shape: 'rounded', fillColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22C55E', textColor: '#22C55E' },
  { id: 'progress', name: 'In Progress', icon: 'i-lucide-clock', category: 'status', shape: 'rounded', fillColor: 'rgba(234, 179, 8, 0.15)', borderColor: '#EAB308', textColor: '#EAB308' },
  { id: 'question', name: 'Question', icon: 'i-lucide-help-circle', category: 'status', shape: 'rounded', fillColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3B82F6', textColor: '#3B82F6' },
  { id: 'issue', name: 'Issue', icon: 'i-lucide-alert-circle', category: 'status', shape: 'rounded', fillColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444', textColor: '#EF4444' },

  // Priority
  { id: 'high', name: 'High', icon: 'i-lucide-arrow-up-circle', category: 'priority', shape: 'rounded', fillColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444', textColor: '#EF4444' },
  { id: 'medium', name: 'Medium', icon: 'i-lucide-minus-circle', category: 'priority', shape: 'rounded', fillColor: 'rgba(234, 179, 8, 0.15)', borderColor: '#EAB308', textColor: '#EAB308' },
  { id: 'low', name: 'Low', icon: 'i-lucide-arrow-down-circle', category: 'priority', shape: 'rounded', fillColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22C55E', textColor: '#22C55E' },

  // Content
  { id: 'link', name: 'Link', icon: 'i-lucide-link', category: 'content', shape: 'rounded', fillColor: '#1A1A1E', borderColor: '#3B82F6', textColor: '#E8E8EC' },
  { id: 'image', name: 'Image', icon: 'i-lucide-image', category: 'content', shape: 'rounded', fillColor: '#1A1A1E', borderColor: '#A855F7', textColor: '#E8E8EC' },
  { id: 'file', name: 'File', icon: 'i-lucide-file', category: 'content', shape: 'rounded', fillColor: '#1A1A1E', borderColor: '#6B6B75', textColor: '#E8E8EC' },
  { id: 'code', name: 'Code', icon: 'i-lucide-code', category: 'content', shape: 'rounded', fillColor: '#1A1A1E', borderColor: '#5EF2E8', textColor: '#5EF2E8' }
]

const categories = [
  { id: 'basic', label: 'Basic' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'content', label: 'Content' }
] as const

const templatesByCategory = computed(() => {
  return categories.map(cat => ({
    ...cat,
    templates: templates.filter(t => t.category === cat.id)
  }))
})

function handleSelect(template: NodeTemplate) {
  emit('select', template)
  emit('close')
}

function handleClose() {
  emit('close')
}

// Close on escape
onKeyStroke('Escape', () => {
  if (props.visible) {
    handleClose()
  }
})

// Panel placement — single dynamic values via CSS v-bind (REDESIGN.md §9:
// no inline :style for positioning).
const panelLeft = computed(() => (props.position ? `${props.position.x}px` : '50%'))
const panelTop = computed(() => (props.position ? `${props.position.y}px` : '50%'))
</script>

<template>
  <Teleport to="body">
    <!-- Toggled via the 'T' keyboard shortcut — opacity-only, <=100ms
         (REDESIGN.md §6: keyboard-initiated UI must not animate). -->
    <Transition
      enter-active-class="tpl-fade-active"
      leave-active-class="tpl-fade-active"
      enter-from-class="tpl-fade-hidden"
      leave-to-class="tpl-fade-hidden"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-modal"
        @click="handleClose"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40" />

        <!-- Panel — flat surface-2 + hairline; position via CSS v-bind -->
        <div
          class="tpl-panel absolute w-[320px]"
          @click.stop
        >
          <!-- Header -->
          <div class="nc-between mb-4">
            <h3 class="tpl-title">{{ $t('canvas.node_templates.title') }}</h3>
            <button
              class="tpl-close"
              @click="handleClose"
            >
              <span class="i-lucide-x text-lg" />
            </button>
          </div>

          <!-- Categories -->
          <div class="space-y-4 max-h-[400px] overflow-y-auto">
            <div v-for="category in templatesByCategory" :key="category.id">
              <h4 class="tpl-cat-label mb-2">
                {{ category.label }}
              </h4>
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="template in category.templates"
                  :key="template.id"
                  class="tpl-item"
                  :title="template.name"
                  @click="handleSelect(template)"
                >
                  <div
                    class="tpl-swatch"
                    :class="[
                      `tpl-swatch--${template.id}`,
                      {
                        'tpl-swatch--circle': template.shape === 'circle',
                        'tpl-swatch--diamond': template.shape === 'diamond'
                      }
                    ]"
                  >
                    <span
                      :class="[template.icon, 'tpl-swatch-icon', template.shape === 'diamond' && 'tpl-swatch-icon--diamond']"
                    />
                  </div>
                  <span class="tpl-name truncate w-full text-center">
                    {{ template.name }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Footer hint -->
          <div class="tpl-footer mt-4 pt-3">
            <p class="tpl-footer-hint text-center">
              Press <kbd class="tpl-kbd">T</kbd> to toggle
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tpl-fade-active {
  transition: opacity 100ms var(--nc-ease);
}

.tpl-fade-hidden {
  opacity: 0;
}

/* Panel — flat surface-2 + hairline, capped radius (REDESIGN.md §5) */
.tpl-panel {
  left: v-bind(panelLeft);
  top: v-bind(panelTop);
  transform: translate(-50%, -50%);
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  box-shadow: var(--nc-shadow-md);
  padding: 16px;
}

/* Panel title — display face (REDESIGN.md §4) */
.tpl-title {
  font-family: var(--nc-font-display);
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 0;
}

.tpl-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--nc-text-muted);
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .tpl-close:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

.tpl-close:active {
  transform: scale(0.97);
}

/* Category header — mono uppercase micro-label (REDESIGN.md §4) */
.tpl-cat-label {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
  margin: 0 0 8px;
}

.tpl-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition:
    background 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .tpl-item:hover {
    background: var(--nc-surface-3);
  }

  .tpl-item:hover .tpl-name {
    color: var(--nc-text);
  }

  .tpl-item:hover .tpl-swatch {
    transform: scale(1.05);
  }

  .tpl-item:hover .tpl-swatch--diamond {
    transform: rotate(45deg) scale(1.05);
  }
}

.tpl-item:active {
  transform: scale(0.97);
}

/* Swatch preview — per-template chrome colors from tokens (fixed id set);
   the actual node style data stays in the script palette. 1px hairline. */
.tpl-swatch {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: var(--tpl-fill);
  border: 1px solid var(--tpl-border);
  transition: transform 150ms var(--nc-ease);
}

.tpl-swatch--circle {
  border-radius: 50%;
}

.tpl-swatch--diamond {
  transform: rotate(45deg);
}

.tpl-swatch-icon {
  color: var(--tpl-text);
}

.tpl-swatch-icon--diamond {
  transform: rotate(-45deg);
}

/* Basic */
.tpl-swatch--text { --tpl-fill: var(--nc-surface-3); --tpl-border: var(--nc-border-active); --tpl-text: var(--nc-text); }
.tpl-swatch--idea { --tpl-fill: var(--nc-surface-3); --tpl-border: var(--nc-accent); --tpl-text: var(--nc-text); }
.tpl-swatch--keypoint { --tpl-fill: var(--nc-surface-3); --tpl-border: var(--nc-warning); --tpl-text: var(--nc-text); }
.tpl-swatch--note { --tpl-fill: var(--nc-surface-4); --tpl-border: var(--nc-border-active); --tpl-text: var(--nc-text-secondary); }

/* Status */
.tpl-swatch--done { --tpl-fill: rgba(var(--nc-success-rgb), 0.15); --tpl-border: var(--nc-success); --tpl-text: var(--nc-success); }
.tpl-swatch--progress { --tpl-fill: rgba(var(--nc-warning-rgb), 0.15); --tpl-border: var(--nc-warning); --tpl-text: var(--nc-warning); }
.tpl-swatch--question { --tpl-fill: rgba(var(--nc-info-rgb), 0.15); --tpl-border: var(--nc-info); --tpl-text: var(--nc-info); }
.tpl-swatch--issue { --tpl-fill: rgba(var(--nc-error-rgb), 0.15); --tpl-border: var(--nc-error); --tpl-text: var(--nc-error); }

/* Priority */
.tpl-swatch--high { --tpl-fill: rgba(var(--nc-error-rgb), 0.15); --tpl-border: var(--nc-error); --tpl-text: var(--nc-error); }
.tpl-swatch--medium { --tpl-fill: rgba(var(--nc-warning-rgb), 0.15); --tpl-border: var(--nc-warning); --tpl-text: var(--nc-warning); }
.tpl-swatch--low { --tpl-fill: rgba(var(--nc-success-rgb), 0.15); --tpl-border: var(--nc-success); --tpl-text: var(--nc-success); }

/* Content */
.tpl-swatch--link { --tpl-fill: var(--nc-surface-3); --tpl-border: var(--nc-info); --tpl-text: var(--nc-text); }
.tpl-swatch--image { --tpl-fill: var(--nc-surface-3); --tpl-border: var(--nc-node-purple); --tpl-text: var(--nc-text); }
.tpl-swatch--file { --tpl-fill: var(--nc-surface-3); --tpl-border: var(--nc-border-active); --tpl-text: var(--nc-text); }
.tpl-swatch--code { --tpl-fill: var(--nc-surface-3); --tpl-border: var(--nc-accent); --tpl-text: var(--nc-accent-text); }

.tpl-name {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  transition: color 150ms var(--nc-ease);
}

.tpl-footer {
  border-top: 1px solid var(--nc-border-subtle);
}

.tpl-footer-hint {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  margin: 0;
}

/* kbd — mono chip on hairline (REDESIGN.md §5) */
.tpl-kbd {
  font-family: var(--nc-font-mono);
  font-size: 0.7rem;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 0.35rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  color: var(--nc-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .tpl-fade-active,
  .tpl-item,
  .tpl-swatch,
  .tpl-close,
  .tpl-name {
    transition: none;
  }
}
</style>
