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

const templates: NodeTemplate[] = [
  // Basic
  { id: 'text', name: 'Text', icon: 'i-lucide-type', category: 'basic', shape: 'rounded', fillColor: '#1A1A1E', borderColor: '#2A2A30', textColor: '#E8E8EC' },
  { id: 'idea', name: 'Idea', icon: 'i-lucide-lightbulb', category: 'basic', shape: 'circle', fillColor: '#1A1A1E', borderColor: '#00D2BE', textColor: '#E8E8EC' },
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
  { id: 'code', name: 'Code', icon: 'i-lucide-code', category: 'content', shape: 'rounded', fillColor: '#1A1A1E', borderColor: '#00D2BE', textColor: '#00D2BE' }
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
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-modal"
        @click="handleClose"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40" />

        <!-- Panel -->
        <div
          class="absolute nc-glass-elevated rounded-nc-xl p-4 shadow-nc-xl w-[320px]"
          :style="{
            left: position ? `${position.x}px` : '50%',
            top: position ? `${position.y}px` : '50%',
            transform: position ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)'
          }"
          @click.stop
        >
          <!-- Header -->
          <div class="nc-between mb-4">
            <h3 class="text-lg font-semibold text-nc-ink font-sans">Node Templates</h3>
            <button
              class="p-1.5 rounded-nc-md text-nc-ink-muted hover:text-nc-ink hover:bg-nc-pencil transition-colors"
              @click="handleClose"
            >
              <span class="i-lucide-x text-lg" />
            </button>
          </div>

          <!-- Categories -->
          <div class="space-y-4 max-h-[400px] overflow-y-auto">
            <div v-for="category in templatesByCategory" :key="category.id">
              <h4 class="text-xs font-medium text-nc-ink-muted uppercase tracking-wide mb-2">
                {{ category.label }}
              </h4>
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="template in category.templates"
                  :key="template.id"
                  class="flex flex-col items-center gap-1.5 p-2 rounded-nc-md
                         hover:bg-nc-pencil transition-colors group"
                  :title="template.name"
                  @click="handleSelect(template)"
                >
                  <div
                    class="w-10 h-10 nc-center rounded-nc-md border-2 transition-all
                           group-hover:shadow-nc-glow group-hover:scale-105"
                    :class="{
                      'rounded-full': template.shape === 'circle',
                      'rotate-45': template.shape === 'diamond'
                    }"
                    :style="{
                      backgroundColor: template.fillColor,
                      borderColor: template.borderColor
                    }"
                  >
                    <span
                      :class="[template.icon, template.shape === 'diamond' && '-rotate-45']"
                      :style="{ color: template.textColor }"
                    />
                  </div>
                  <span class="text-xs text-nc-ink-muted group-hover:text-nc-ink truncate w-full text-center">
                    {{ template.name }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Footer hint -->
          <div class="mt-4 pt-3 border-t border-nc-pencil">
            <p class="text-xs text-nc-ink-faint text-center">
              Press <kbd class="px-1.5 py-0.5 rounded bg-nc-pencil text-nc-ink-muted">T</kbd> to toggle
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
