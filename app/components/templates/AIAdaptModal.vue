<script setup lang="ts">
import type { GenerationDepth, GenerationStyle } from '~/types'

const props = defineProps<{
  open: boolean
  templateTitle: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'generate', payload: { topic: string; depth: GenerationDepth; style: GenerationStyle; domain?: string }): void
}>()

const topic = ref('')
const depth = ref<GenerationDepth>('medium')
const style = ref<GenerationStyle>('concise')
const domain = ref('')

const canGenerate = computed(() => topic.value.trim().length > 0)

function handleGenerate() {
  if (!canGenerate.value) return
  emit('generate', {
    topic: topic.value.trim(),
    depth: depth.value,
    style: style.value,
    domain: domain.value.trim() || undefined,
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.open, (val) => {
  if (val) {
    topic.value = ''
    depth.value = 'medium'
    style.value = 'concise'
    domain.value = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')" @keydown="handleKeydown">
        <div class="modal-panel" role="dialog" aria-modal="true">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
              </svg>
            </div>
            <div class="header-text">
              <h2 class="header-title">AI Adapt Template</h2>
              <p class="header-subtitle">{{ templateTitle }} will be customized to your topic</p>
            </div>
            <button class="close-btn" @click="emit('close')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Topic -->
            <div class="field">
              <label class="field-label">Your Topic</label>
              <input
                v-model="topic"
                type="text"
                class="field-input"
                placeholder='e.g. "Launching a mobile fitness app"'
                autofocus
              />
            </div>

            <!-- Depth + Style -->
            <div class="field-row">
              <div class="field">
                <label class="field-label">Depth</label>
                <div class="toggle-group">
                  <button
                    v-for="d in (['shallow', 'medium', 'deep'] as GenerationDepth[])"
                    :key="d"
                    :class="['toggle-btn', { active: depth === d }]"
                    @click="depth = d"
                  >
                    {{ d.charAt(0).toUpperCase() + d.slice(1) }}
                  </button>
                </div>
              </div>
              <div class="field">
                <label class="field-label">Style</label>
                <div class="toggle-group">
                  <button
                    v-for="s in (['concise', 'detailed', 'academic'] as GenerationStyle[])"
                    :key="s"
                    :class="['toggle-btn', { active: style === s }]"
                    @click="style = s"
                  >
                    {{ s.charAt(0).toUpperCase() + s.slice(1) }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Domain -->
            <div class="field">
              <div class="field-label-row">
                <label class="field-label">Domain</label>
                <span class="field-optional">Optional</span>
              </div>
              <input
                v-model="domain"
                type="text"
                class="field-input"
                placeholder='e.g. "Health & Fitness"'
              />
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-ghost" @click="emit('close')">Cancel</button>
            <button class="btn-primary" :disabled="!canGenerate" @click="handleGenerate">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
              </svg>
              Generate & Create Map
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

/* Header */
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

.header-text {
  flex: 1;
  min-width: 0;
}

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
  font-weight: 400;
  color: var(--m-muted, #71717A);
  margin: 2px 0 0;
  line-height: 18px;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--m-muted, #71717A);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.close-btn:hover {
  color: var(--m-text, #E8E8EC);
  background: var(--m-hover, #1A1A1E);
}

/* Body */
.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.field-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--m-text, #E8E8EC);
}

.field-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-optional {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 400;
  color: var(--m-muted, #71717A);
}

.field-input {
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

.field-input::placeholder {
  color: var(--m-placeholder, #3F3F46);
}

.field-input:focus {
  border-color: #00D2BE;
}

.field-row {
  display: flex;
  gap: 16px;
}

/* Toggle buttons */
.toggle-group {
  display: flex;
  gap: 4px;
}

.toggle-btn {
  flex: 1;
  padding: 10px 8px;
  background: var(--m-input-bg, #0D0D0F);
  border: 1px solid var(--m-border, #1A1A1E);
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--m-muted, #71717A);
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
}

.toggle-btn:hover {
  color: var(--m-text, #E8E8EC);
  border-color: var(--m-border-hover, #2A2A30);
}

.toggle-btn.active {
  background: rgba(0, 210, 190, 0.1);
  border-color: #00D2BE;
  color: #00D2BE;
}

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
  font-size: 14px;
  font-weight: 500;
  color: var(--m-text, #E8E8EC);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-ghost:hover {
  background: var(--m-hover, #1A1A1E);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: #00D2BE;
  border: none;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #09090B;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Transitions */
.modal-enter-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .modal-panel {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-leave-active .modal-panel {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal-panel {
  transform: scale(0.95);
  opacity: 0;
}
.modal-leave-to {
  opacity: 0;
}
.modal-leave-to .modal-panel {
  transform: scale(0.95);
  opacity: 0;
}

/* Light theme */
:root.light .modal-panel {
  --m-bg: #FFFFFF;
  --m-border: #E8E8E6;
  --m-border-hover: #D4D4D2;
  --m-text: #111111;
  --m-muted: #71717A;
  --m-placeholder: #A1A1AA;
  --m-input-bg: #F5F5F3;
  --m-hover: #E8E8E6;
}

/* Mobile */
@media (max-width: 640px) {
  .modal-panel {
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    border: none;
    max-height: 100vh;
  }
  .field-row {
    flex-direction: column;
  }
}
</style>
