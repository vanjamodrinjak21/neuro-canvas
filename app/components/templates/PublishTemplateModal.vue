<script setup lang="ts">
import type { TemplateCategory } from '~/types'

const props = defineProps<{
  open: boolean
  sourceMapId?: string
  sourceMapTitle?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'publish', payload: {
    sourceMapId: string
    title: string
    description: string
    category: TemplateCategory
    tags: string[]
    aiEnhanced: boolean
  }): void
}>()

const title = ref('')
const description = ref('')
const category = ref<TemplateCategory>('education')
const aiEnhanced = ref(true)
const tags = ref<string[]>([])
const tagInput = ref('')

const categories: { value: TemplateCategory; label: string }[] = [
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'creative', label: 'Creative' },
  { value: 'planning', label: 'Planning' },
  { value: 'research', label: 'Research' },
]

const canPublish = computed(() => title.value.trim().length > 0 && props.sourceMapId)

function addTag() {
  const tag = tagInput.value.trim().toLowerCase()
  if (tag && !tags.value.includes(tag)) {
    tags.value.push(tag)
  }
  tagInput.value = ''
}

function removeTag(index: number) {
  tags.value.splice(index, 1)
}

function handleTagKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addTag()
  }
}

function handlePublish() {
  if (!canPublish.value || !props.sourceMapId) return
  emit('publish', {
    sourceMapId: props.sourceMapId,
    title: title.value.trim(),
    description: description.value.trim(),
    category: category.value,
    tags: tags.value,
    aiEnhanced: aiEnhanced.value,
  })
}

watch(() => props.open, (val) => {
  if (val) {
    title.value = props.sourceMapTitle || ''
    description.value = ''
    category.value = 'education'
    aiEnhanced.value = true
    tags.value = []
    tagInput.value = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
        <div class="modal-panel" role="dialog" aria-modal="true">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div class="header-text">
              <h2 class="header-title">Publish Template</h2>
              <p class="header-subtitle">Share your map structure with the community</p>
            </div>
            <button class="close-btn" @click="emit('close')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Source Map -->
            <div class="field">
              <label class="field-label">Source Map</label>
              <div class="source-map-display">
                <span class="source-avatar">{{ (sourceMapTitle || 'M')[0].toUpperCase() }}</span>
                <span class="source-title">{{ sourceMapTitle || 'Select a map...' }}</span>
              </div>
            </div>

            <!-- Template Name -->
            <div class="field">
              <label class="field-label">Template Name</label>
              <input v-model="title" type="text" class="field-input" placeholder="Template name" />
            </div>

            <!-- Description -->
            <div class="field">
              <label class="field-label">Description</label>
              <textarea
                v-model="description"
                class="field-textarea"
                placeholder="Describe what this template is for..."
                rows="3"
              />
            </div>

            <!-- Category + AI Enhancement -->
            <div class="field-row">
              <div class="field">
                <label class="field-label">Category</label>
                <select v-model="category" class="field-select">
                  <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">AI Enhancement</label>
                <div class="toggle-switch-row">
                  <span class="toggle-label">{{ aiEnhanced ? 'Enabled' : 'Disabled' }}</span>
                  <button :class="['toggle-switch', { active: aiEnhanced }]" @click="aiEnhanced = !aiEnhanced">
                    <span class="toggle-knob" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Tags -->
            <div class="field">
              <label class="field-label">Tags</label>
              <div class="tags-container">
                <span v-for="(tag, i) in tags" :key="tag" class="tag-chip">
                  {{ tag }}
                  <button class="tag-remove" @click="removeTag(i)">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
                <input
                  v-model="tagInput"
                  type="text"
                  class="tag-input"
                  placeholder="+ Add tag"
                  @keydown="handleTagKeydown"
                  @blur="addTag"
                />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-ghost" @click="emit('close')">Cancel</button>
            <button class="btn-primary" :disabled="!canPublish" @click="handlePublish">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Publish to Community
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal-panel {
  width: 520px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: var(--m-bg, #111113);
  border: 1px solid var(--m-border, #1A1A1E);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 24px 24px 0;
}

.header-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(0, 210, 190, 0.12);
  color: #00D2BE;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-text { flex: 1; min-width: 0; }

.header-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--m-text, #E8E8EC);
  margin: 0;
  line-height: 22px;
}

.header-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--m-muted, #71717A);
  margin: 2px 0 0;
}

.close-btn {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: none;
  color: var(--m-muted, #71717A);
  border-radius: 6px; cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.close-btn:hover {
  color: var(--m-text, #E8E8EC);
  background: var(--m-hover, #1A1A1E);
}

.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field { display: flex; flex-direction: column; gap: 8px; flex: 1; }

.field-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px; font-weight: 500;
  color: var(--m-text, #E8E8EC);
}

.field-row { display: flex; gap: 16px; }

.field-input, .field-textarea, .field-select {
  padding: 10px 14px;
  background: var(--m-input-bg, #0D0D0F);
  border: 1px solid var(--m-border, #1A1A1E);
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  color: var(--m-text, #E8E8EC);
  outline: none;
  transition: border-color 0.15s;
}

.field-input:focus, .field-textarea:focus, .field-select:focus { border-color: #00D2BE; }
.field-input::placeholder, .field-textarea::placeholder { color: var(--m-placeholder, #3F3F46); }

.field-textarea { resize: vertical; min-height: 60px; }

.field-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  cursor: pointer;
}

.field-select option { background: #111113; color: #E8E8EC; }

/* Source Map Display */
.source-map-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--m-input-bg, #0D0D0F);
  border: 1px solid var(--m-border, #1A1A1E);
  border-radius: 8px;
}

.source-avatar {
  width: 24px; height: 24px;
  border-radius: 6px;
  background: #00D2BE;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px; font-weight: 700; color: #09090B;
}

.source-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px; color: var(--m-text, #E8E8EC);
}

/* Toggle Switch */
.toggle-switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--m-input-bg, #0D0D0F);
  border: 1px solid var(--m-border, #1A1A1E);
  border-radius: 8px;
}

.toggle-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px; color: var(--m-text, #E8E8EC);
  flex: 1;
}

.toggle-switch {
  width: 32px; height: 18px;
  border-radius: 9px;
  background: var(--m-border, #2A2A30);
  border: none; cursor: pointer;
  position: relative;
  transition: background 0.2s;
  padding: 0;
}

.toggle-switch.active { background: #00D2BE; }

.toggle-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-knob { transform: translateX(14px); }

/* Tags */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  background: var(--m-input-bg, #0D0D0F);
  border: 1px solid var(--m-border, #1A1A1E);
  border-radius: 8px;
  min-height: 38px;
  align-items: center;
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--m-hover, #1A1A1E);
  border-radius: 4px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: var(--m-text, #E8E8EC);
}

.tag-remove {
  display: flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
  border: none; background: none;
  color: var(--m-muted, #71717A);
  cursor: pointer;
  padding: 0;
  border-radius: 2px;
}

.tag-remove:hover { color: var(--m-text, #E8E8EC); }

.tag-input {
  border: none; background: none; outline: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: var(--m-text, #E8E8EC);
  min-width: 60px;
  flex: 1;
}

.tag-input::placeholder { color: var(--m-muted, #71717A); }

/* Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
}

.btn-ghost {
  padding: 10px 24px;
  background: var(--m-input-bg, #0D0D0F);
  border: 1px solid var(--m-border, #1A1A1E);
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px; font-weight: 500;
  color: var(--m-text, #E8E8EC);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-ghost:hover { background: var(--m-hover, #1A1A1E); }

.btn-primary {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 24px;
  background: #00D2BE;
  border: none; border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px; font-weight: 600;
  color: #09090B;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* Transitions */
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-enter-active .modal-panel { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-leave-active .modal-panel { transition: transform 0.15s ease, opacity 0.15s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-panel { transform: scale(0.95); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-panel { transform: scale(0.95); opacity: 0; }

/* Light theme */
:root.light .modal-panel {
  --m-bg: #FFFFFF;
  --m-border: #E8E8E6;
  --m-text: #111111;
  --m-muted: #71717A;
  --m-placeholder: #A1A1AA;
  --m-input-bg: #F5F5F3;
  --m-hover: #E8E8E6;
}

:root.light .field-select option { background: #FFFFFF; color: #111111; }

/* Mobile */
@media (max-width: 640px) {
  .modal-panel { width: 100%; max-width: 100%; border-radius: 0; border: none; }
  .field-row { flex-direction: column; }
}
</style>
