<script setup lang="ts">
import type { GenerationDepth, GenerationStyle } from '~/types'

const props = withDefaults(defineProps<{
  open: boolean
  templateTitle: string
  loading?: boolean
  progress?: { done: number; total: number } | null
  errorMessage?: string | null
}>(), {
  loading: false,
  progress: null,
  errorMessage: null,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'generate', payload: { topic: string; depth: GenerationDepth; style: GenerationStyle; domain?: string }): void
}>()

const topic = ref('')
const depth = ref<GenerationDepth>('medium')
const style = ref<GenerationStyle>('concise')
const domain = ref('')

const canGenerate = computed(() => topic.value.trim().length > 0 && !props.loading)

function handleGenerate() {
  if (!canGenerate.value) return
  emit('generate', {
    topic: topic.value.trim(),
    depth: depth.value,
    style: style.value,
    domain: domain.value.trim() || undefined,
  })
}

// Allow Escape to cancel even while loading — closing the modal does not
// abort the in-flight generation (the parent owns that lifecycle), but the
// user can dismiss the UI and let it finish in the background / navigate away.
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.open, (val) => {
  if (val && !props.loading) {
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
              <h2 class="header-title">{{ $t('templates.ai_adapt_modal.title') }}</h2>
              <p class="header-subtitle">{{ $t('templates.ai_adapt_modal.description', { title: templateTitle }) }}</p>
            </div>
            <button class="close-btn" @click="emit('close')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body: form OR loading state -->
          <div v-if="!loading" class="modal-body">
            <!-- Topic -->
            <div class="field">
              <label class="field-label">{{ $t('templates.ai_adapt_modal.topic_label') }}</label>
              <input
                v-model="topic"
                type="text"
                class="field-input"
                :placeholder="$t('templates.ai_adapt_modal.topic_placeholder')"
                autofocus
              >
            </div>

            <!-- Depth + Style -->
            <div class="field-row">
              <div class="field">
                <label class="field-label">{{ $t('templates.ai_adapt_modal.depth') }}</label>
                <div class="toggle-group">
                  <button
                    v-for="d in (['shallow', 'medium', 'deep'] as GenerationDepth[])"
                    :key="d"
                    :class="['toggle-btn', { active: depth === d }]"
                    @click="depth = d"
                  >
                    {{ $t('templates.ai_adapt_modal.' + d) }}
                  </button>
                </div>
              </div>
              <div class="field">
                <label class="field-label">{{ $t('templates.ai_adapt_modal.style') }}</label>
                <div class="toggle-group">
                  <button
                    v-for="s in (['concise', 'detailed', 'academic'] as GenerationStyle[])"
                    :key="s"
                    :class="['toggle-btn', { active: style === s }]"
                    @click="style = s"
                  >
                    {{ $t('templates.ai_adapt_modal.' + s) }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Domain -->
            <div class="field">
              <div class="field-label-row">
                <label class="field-label">{{ $t('templates.ai_adapt_modal.domain') }}</label>
                <span class="field-optional">{{ $t('templates.ai_adapt_modal.optional') }}</span>
              </div>
              <input
                v-model="domain"
                type="text"
                class="field-input"
                :placeholder="$t('templates.ai_adapt_modal.domain_placeholder')"
              >
            </div>

            <!-- Error (non-blocking, inline) -->
            <p v-if="errorMessage" class="modal-error" role="alert">{{ errorMessage }}</p>
          </div>

          <div v-else class="modal-loading">
            <div class="loading-spinner" />
            <p class="loading-text">
              <template v-if="progress && progress.total > 0">
                {{ $t('templates.ai_adapt_modal.generating_progress', { n: progress.done, total: progress.total }) }}
              </template>
              <template v-else>
                {{ $t('templates.ai_adapt_modal.generating') }}
              </template>
            </p>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-ghost" :disabled="loading" @click="emit('close')">{{ $t('templates.ai_adapt_modal.cancel') }}</button>
            <button v-if="!loading" class="btn-primary" :disabled="!canGenerate" @click="handleGenerate">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
              </svg>
              {{ $t('templates.ai_adapt_modal.generate') }}
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
  border-radius: var(--nc-radius-md);
  background: rgba(var(--nc-accent-rgb), 0.1);
  color: var(--nc-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-text {
  flex: 1;
  min-width: 0;
}

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
  font-weight: 400;
  color: var(--nc-text-secondary);
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
  color: var(--nc-text-muted);
  border-radius: var(--nc-radius-sm);
  cursor: pointer;
  flex-shrink: 0;
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

/* Input labels = mono uppercase micro-labels (REDESIGN.md §4/§5) */
.field-label {
  font-family: var(--nc-font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--nc-text-secondary);
}

.field-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-optional {
  font-family: var(--nc-font-mono);
  font-size: 0.66rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-muted);
}

/* Input grammar: chip fill, 1px hairline, focus = accent border ONLY */
.field-input {
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

.field-input::placeholder {
  color: var(--nc-text-dim);
}

.field-input:focus {
  border-color: var(--nc-accent);
}

.field-row {
  display: flex;
  gap: 16px;
}

/* Toggle buttons — small controls, radius 6px */
.toggle-group {
  display: flex;
  gap: 4px;
}

.toggle-btn {
  flex: 1;
  padding: 10px 8px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  cursor: pointer;
  text-align: center;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.toggle-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .toggle-btn:hover {
    color: var(--nc-text);
    border-color: var(--nc-border-active);
  }
}

/* Active = accent text + accent edge + fill — never color alone */
.toggle-btn.active {
  background: rgba(var(--nc-accent-rgb), 0.08);
  border-color: var(--nc-accent);
  color: var(--nc-accent);
}

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
  .btn-ghost:hover {
    color: var(--nc-accent);
  }

  .btn-ghost:hover::after {
    transform: scaleX(1);
  }
}

/* AI-flavored CTA — accent pill (NcButton "ai" variant) */
.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--nc-accent);
  border: none;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
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

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.close-btn:focus-visible,
.toggle-btn:focus-visible,
.btn-ghost:focus-visible,
.btn-primary:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Loading state */
.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--nc-border);
  border-top-color: var(--nc-accent);
  border-radius: 50%;
  animation: ai-adapt-spin 0.7s linear infinite;
}

@keyframes ai-adapt-spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  margin: 0;
  text-align: center;
}

/* Inline error — validation errors are coral (REDESIGN.md §1) */
.modal-error {
  margin: 0;
  padding: 10px 12px;
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.25);
  border-radius: var(--nc-radius-md);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 18px;
  color: var(--nc-coral);
}

/* Transitions — enter scale(0.97)+opacity 200ms, exit faster (REDESIGN.md §5/§6) */
.modal-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease);
}
.modal-enter-active .modal-panel {
  transition: transform var(--nc-duration-normal) var(--nc-ease),
              opacity var(--nc-duration-normal) var(--nc-ease);
}
.modal-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease);
}
.modal-leave-active .modal-panel {
  transition: transform var(--nc-duration-fast) var(--nc-ease),
              opacity var(--nc-duration-fast) var(--nc-ease);
}
.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal-panel {
  transform: scale(0.97);
  opacity: 0;
}
.modal-leave-to {
  opacity: 0;
}
.modal-leave-to .modal-panel {
  transform: scale(0.97);
  opacity: 0;
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */

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
