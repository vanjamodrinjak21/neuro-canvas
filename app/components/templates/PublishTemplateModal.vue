<script setup lang="ts">
import type { TemplateCategory } from '~/types'
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { useTemplates } from '~/composables/useTemplates'

const props = defineProps<{
  open: boolean
  sourceMapId?: string
  sourceMapTitle?: string
}>()

const emit = defineEmits<{
  (e: 'close' | 'published'): void
}>()

const { t } = useI18n()
const db = useDatabase()
const { publishTemplate } = useTemplates()

const title = ref('')
const description = ref('')
const category = ref<TemplateCategory>('education')
const aiEnhanced = ref(true)
const tags = ref<string[]>([])
const tagInput = ref('')

const userMaps = ref<DBMapDocument[]>([])
const selectedMapId = ref<string>('')
const mapPickerOpen = ref(false)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

const selectedMap = computed(() => userMaps.value.find(m => m.id === selectedMapId.value) || null)

const categories = computed<{ value: TemplateCategory; label: string }[]>(() => [
  { value: 'education', label: t('templates.filter.education') },
  { value: 'business', label: t('templates.filter.business') },
  { value: 'creative', label: t('templates.filter.creative') },
  { value: 'planning', label: t('templates.filter.planning') },
  { value: 'research', label: t('templates.filter.research') },
])

const canPublish = computed(() =>
  title.value.trim().length > 0 && !!selectedMapId.value && !submitting.value
)

function addTag() {
  const tag = tagInput.value.trim().toLowerCase()
  if (tag && !tags.value.includes(tag)) tags.value.push(tag)
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

function pickMap(mapId: string) {
  selectedMapId.value = mapId
  mapPickerOpen.value = false
  if (!title.value.trim()) {
    const m = userMaps.value.find(x => x.id === mapId)
    if (m) title.value = m.title
  }
}

function toArrayRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {}
  for (const item of items) out[item.id] = item
  return out
}

async function handlePublish() {
  if (!canPublish.value || !selectedMap.value) return
  submitting.value = true
  errorMessage.value = null
  try {
    const map = selectedMap.value
    await publishTemplate({
      sourceMapId: map.id,
      title: title.value.trim(),
      description: description.value.trim(),
      category: category.value,
      tags: [...tags.value],
      aiEnhanced: aiEnhanced.value,
      nodes: toArrayRecord(map.nodes as any),
      edges: toArrayRecord(map.edges as any),
      settings: map.settings,
    })
    emit('published')
    emit('close')
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || e?.message || t('common.errors.generic')
  } finally {
    submitting.value = false
  }
}

watch(() => props.open, async (val) => {
  if (!val) return
  title.value = props.sourceMapTitle || ''
  description.value = ''
  category.value = 'education'
  aiEnhanced.value = true
  tags.value = []
  tagInput.value = ''
  errorMessage.value = null
  selectedMapId.value = props.sourceMapId || ''
  mapPickerOpen.value = false
  try {
    userMaps.value = await db.getAllMaps()
    if (!selectedMapId.value && userMaps.value.length === 1) {
      selectedMapId.value = userMaps.value[0]!.id
      if (!title.value.trim()) title.value = userMaps.value[0]!.title
    }
  } catch {
    userMaps.value = []
  }
})

if (typeof document !== 'undefined') {
  onMounted(() => {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null
      if (target && !target.closest('.source-map-wrap')) mapPickerOpen.value = false
    })
  })
}
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
              <h2 class="header-title">{{ $t('templates.publish_modal.title') }}</h2>
              <p class="header-subtitle">{{ $t('templates.publish_modal.description') }}</p>
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
              <label class="field-label">{{ $t('templates.publish_modal.source_map') }}</label>
              <div class="source-map-wrap">
                <button
                  type="button"
                  class="source-map-display"
                  :class="{ active: mapPickerOpen }"
                  @click="mapPickerOpen = !mapPickerOpen"
                >
                  <span class="source-avatar">{{ (selectedMap?.title || 'M').charAt(0).toUpperCase() }}</span>
                  <span class="source-title" :class="{ placeholder: !selectedMap }">
                    {{ selectedMap?.title || $t('templates.publish_modal.select_map') }}
                  </span>
                  <svg class="source-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div v-if="mapPickerOpen" class="source-map-menu">
                  <p v-if="userMaps.length === 0" class="source-map-empty">
                    {{ $t('common.errors.not_found') }}
                  </p>
                  <button
                    v-for="m in userMaps"
                    :key="m.id"
                    type="button"
                    :class="['source-map-item', { active: m.id === selectedMapId }]"
                    @click="pickMap(m.id)"
                  >
                    <span class="source-avatar">{{ (m.title || 'M').charAt(0).toUpperCase() }}</span>
                    <span class="source-map-item-title">{{ m.title || $t('common.errors.not_found') }}</span>
                    <span class="source-map-item-meta">{{ m.nodes.length }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Template Name -->
            <div class="field">
              <label class="field-label">{{ $t('templates.publish_modal.template_name') }}</label>
              <input v-model="title" type="text" class="field-input" :placeholder="$t('templates.publish_modal.template_name')" >
            </div>

            <!-- Description -->
            <div class="field">
              <label class="field-label">{{ $t('templates.publish_modal.template_description') }}</label>
              <textarea
                v-model="description"
                class="field-textarea"
                :placeholder="$t('templates.publish_modal.describe_template')"
                rows="3"
              />
            </div>

            <!-- Category + AI Enhancement -->
            <div class="field-row">
              <div class="field">
                <label class="field-label">{{ $t('templates.publish_modal.category') }}</label>
                <select v-model="category" class="field-select">
                  <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">{{ $t('templates.publish_modal.ai_enhancement') }}</label>
                <div class="toggle-switch-row">
                  <span class="toggle-label">
                    {{ aiEnhanced ? $t('templates.publish_modal.enabled') : $t('templates.publish_modal.disabled') }}
                  </span>
                  <button :class="['toggle-switch', { active: aiEnhanced }]" @click="aiEnhanced = !aiEnhanced">
                    <span class="toggle-knob" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Tags -->
            <div class="field">
              <label class="field-label">{{ $t('templates.publish_modal.tags') }}</label>
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
                  :placeholder="$t('templates.publish_modal.add_tag')"
                  @keydown="handleTagKeydown"
                  @blur="addTag"
                >
              </div>
            </div>

            <p v-if="errorMessage" class="modal-error">{{ errorMessage }}</p>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-ghost" @click="emit('close')">{{ $t('templates.publish_modal.cancel') }}</button>
            <button class="btn-primary" :disabled="!canPublish" @click="handlePublish">
              <svg v-if="!submitting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span v-else class="btn-spinner" />
              {{ $t('templates.publish_modal.publish') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Modal grammar (REDESIGN.md §5): flat surface-2 + hairline, centered;
   scrim = flat bg alpha only — no blur effects anywhere in chrome. */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--nc-bg-rgb), 0.6);
}

.modal-panel {
  width: 520px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  box-shadow: var(--nc-shadow-md);
  display: flex;
  flex-direction: column;
  transform-origin: center;
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
  border-radius: var(--nc-radius-md);
  background: rgba(var(--nc-accent-rgb), 0.1);
  color: var(--nc-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-text { flex: 1; min-width: 0; }

/* Modal header = display 700 (REDESIGN.md §4) */
.header-title {
  font-family: var(--nc-font-display);
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 0;
  line-height: 1.05;
}

.header-subtitle {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  margin: 2px 0 0;
}

.close-btn {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: none;
  color: var(--nc-text-muted);
  border-radius: var(--nc-radius-sm); cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.close-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .close-btn:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field { display: flex; flex-direction: column; gap: 8px; flex: 1; }

/* Input labels = mono uppercase micro-labels (REDESIGN.md §4/§5) */
.field-label {
  font-family: var(--nc-font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--nc-text-secondary);
}

.field-row { display: flex; gap: 16px; }

/* Input grammar: chip fill, 1px hairline, focus = accent border ONLY */
.field-input, .field-textarea, .field-select {
  padding: 10px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: var(--nc-radius-md);
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  outline: none;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.field-input:focus, .field-textarea:focus, .field-select:focus { border-color: var(--nc-accent); }
.field-input::placeholder, .field-textarea::placeholder { color: var(--nc-text-dim); }

.field-textarea { resize: vertical; min-height: 60px; }

/* Native arrow (theme-aware via color-scheme) — a data-URI glyph can't
   consume tokens, so the hardcoded chevron is gone. */
.field-select {
  cursor: pointer;
}

.field-select option { background: var(--nc-surface-2); color: var(--nc-text); }

/* Source Map picker */
.source-map-wrap { position: relative; }

.source-map-display {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .source-map-display:hover { border-color: var(--nc-border-active); }
}

.source-map-display.active { border-color: var(--nc-accent); }

.source-chev {
  margin-left: auto;
  color: var(--nc-text-muted);
  flex-shrink: 0;
}

.source-title.placeholder { color: var(--nc-text-dim); }

/* Popover grammar (REDESIGN.md §5): flat surface-2 + hairline, origin at
   trigger, enter scale(0.97)+opacity 150ms; exit is instant (v-if). */
.source-map-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 5;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  box-shadow: var(--nc-shadow-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
  transform-origin: top;
  animation: source-menu-in var(--nc-duration-fast) var(--nc-ease);
}

@keyframes source-menu-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}

.source-map-empty {
  margin: 0;
  padding: 12px;
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  text-align: center;
}

.source-map-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: var(--nc-radius-sm);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: var(--nc-text);
  transition: background-color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .source-map-item:hover { background: var(--nc-surface-3); }
}

.source-map-item.active { background: rgba(var(--nc-accent-rgb), 0.08); }

.source-map-item-title {
  flex: 1;
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-map-item-meta {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

/* Validation errors are coral (REDESIGN.md §1) */
.modal-error {
  margin: 0;
  padding: 8px 12px;
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.25);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-coral);
  font-size: calc(13px * var(--nc-text-scale, 1));
}

/* Spinner ink = bg color (sits on the accent pill) */
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(var(--nc-bg-rgb), 0.3);
  border-top-color: var(--nc-bg);
  border-radius: 50%;
  animation: pubspin 0.6s linear infinite;
}

@keyframes pubspin { to { transform: rotate(360deg); } }

.source-avatar {
  width: 24px; height: 24px;
  border-radius: var(--nc-radius-sm);
  background: var(--nc-accent);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1)); font-weight: 700; color: var(--nc-bg);
}

.source-title {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1)); color: var(--nc-text);
}

/* Toggle Switch */
.toggle-switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
}

.toggle-label {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1)); color: var(--nc-text);
  flex: 1;
}

.toggle-switch {
  width: 32px; height: 18px;
  border-radius: 999px;
  background: var(--nc-border);
  border: none; cursor: pointer;
  position: relative;
  transition: background-color var(--nc-duration-normal) var(--nc-ease);
  padding: 0;
}

.toggle-switch.active { background: var(--nc-accent); }

.toggle-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--nc-text);
  transition: transform var(--nc-duration-normal) var(--nc-ease);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(14px);
  background: var(--nc-bg);
}

/* Tags — chip grammar: mono on chip fill, hairline, radius 0.4rem */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  min-height: 38px;
  align-items: center;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

/* The inner tag input is borderless — the container carries the focus
   grammar (accent border only, REDESIGN.md §5). */
.tags-container:focus-within {
  border-color: var(--nc-accent);
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  border-radius: 0.4rem;
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text);
}

.tag-remove {
  display: flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
  border: none; background: none;
  color: var(--nc-text-muted);
  cursor: pointer;
  padding: 0;
  border-radius: 0.35rem;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .tag-remove:hover { color: var(--nc-text); }
}

.tag-input {
  border: none; background: none; outline: none;
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  min-width: 60px;
  flex: 1;
}

.tag-input::placeholder { color: var(--nc-text-dim); }

/* Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
}

/* Ghost button — mono uppercase text link with underline-grow (NcButton) */
.btn-ghost {
  position: relative;
  padding: 10px 18px;
  background: transparent;
  border: 1px solid transparent;
  font-family: var(--nc-font-mono);
  font-size: 0.78rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-ghost::after {
  content: '';
  position: absolute;
  left: 0.9em;
  right: 0.9em;
  bottom: 0.4em;
  height: 1px;
  background: currentColor;
  transform: scaleX(0.35);
  transform-origin: left;
  transition: transform 0.45s var(--nc-ease);
}

.btn-ghost:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .btn-ghost:hover { color: var(--nc-accent); }
  .btn-ghost:hover::after { transform: scaleX(1); }
}

/* Primary CTA — accent pill (publish feeds the AI template library) */
.btn-primary {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 24px;
  background: var(--nc-accent);
  border: none;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1)); font-weight: 700;
  color: var(--nc-bg);
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-primary:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .btn-primary:hover {
    background: var(--nc-accent-light);
    transform: translateY(-1px);
  }
}

.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

.close-btn:focus-visible,
.source-map-display:focus-visible,
.source-map-item:focus-visible,
.toggle-switch:focus-visible,
.tag-remove:focus-visible,
.btn-ghost:focus-visible,
.btn-primary:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Transitions — enter scale(0.97)+opacity 200ms, exit faster (REDESIGN.md §5/§6) */
.modal-enter-active { transition: opacity var(--nc-duration-normal) var(--nc-ease); }
.modal-enter-active .modal-panel {
  transition: transform var(--nc-duration-normal) var(--nc-ease),
              opacity var(--nc-duration-normal) var(--nc-ease);
}
.modal-leave-active { transition: opacity var(--nc-duration-fast) var(--nc-ease); }
.modal-leave-active .modal-panel {
  transition: transform var(--nc-duration-fast) var(--nc-ease),
              opacity var(--nc-duration-fast) var(--nc-ease);
}
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-panel { transform: scale(0.97); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-panel { transform: scale(0.97); opacity: 0; }

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */

/* Mobile */
@media (max-width: 640px) {
  .modal-panel { width: 100%; max-width: 100%; border-radius: 0; border: none; }
  .field-row { flex-direction: column; }
}
</style>
