<script setup lang="ts">
/**
 * Mobile Generate Map sheet — topic input + streaming progress view.
 * Editorial nocturnal aesthetic, matching MobileMoreSheet.
 *
 * Two states:
 *   "input"     — user types a topic, picks depth, taps Generate
 *   "streaming" — live AI output scrolls in a soft surface block,
 *                 with shimmer progress bar based on tokens received.
 */
import NcAiMark from '~/components/ui/NcAiMark.vue'

interface Props {
  visible: boolean
  isGenerating: boolean
  streamingText: string
  errorText?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  errorText: null,
})

const { t } = useI18n()

const emit = defineEmits<{
  close: []
  generate: [topic: string, depth: 'shallow' | 'medium' | 'deep']
  cancel: []
}>()

const topic = ref('')
const depth = ref<'shallow' | 'medium' | 'deep'>('medium')

// Pseudo-progress: each chunk lands → count grows. Ratio is capped at 95%
// until isGenerating flips to false.
const progress = computed(() => {
  if (!props.isGenerating) return props.streamingText.length > 0 ? 100 : 0
  const len = props.streamingText.length
  // 4000 maxTokens × ~4 chars per token ≈ 16k chars worst case;
  // the bar reaches 95% at ~4500 chars which is the sweet spot.
  const pct = Math.min(95, Math.round((len / 4500) * 95))
  return pct
})

function onSubmit() {
  const t = topic.value.trim()
  if (!t || props.isGenerating) return
  emit('generate', t, depth.value)
}

function onClose() {
  if (props.isGenerating) {
    emit('cancel')
    return
  }
  emit('close')
}

watch(() => props.visible, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
  if (v) {
    topic.value = ''
    depth.value = 'medium'
  }
})

const streamRef = ref<HTMLDivElement | null>(null)
watch(() => props.streamingText, () => {
  nextTick(() => {
    const el = streamRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="mgs-fade">
      <div v-if="visible" class="mgs-backdrop" @click="onClose" />
    </Transition>
    <Transition name="mgs-slide">
      <section v-if="visible" class="mgs" role="dialog" aria-modal="true" :aria-label="t('mobile.generate.dialogLabel')">
        <button class="mgs-handle" type="button" :aria-label="t('mobile.generate.close')" @click="onClose">
          <span class="mgs-handle-bar" />
        </button>

        <span class="mgs-eyebrow">{{ t('mobile.generate.eyebrow') }}</span>

        <h1 class="mgs-title">
          <span class="mgs-title-sans">{{ t('mobile.generate.titleSans') }}</span>
          <span class="mgs-title-serif">{{ t('mobile.generate.titleSerif') }}</span>
        </h1>
        <span class="mgs-sub">{{ t('mobile.generate.subtitle') }}</span>

        <!-- INPUT STATE -->
        <template v-if="!isGenerating && progress < 100">
          <label class="mgs-field">
            <span class="mgs-field-label">{{ t('mobile.generate.topicLabel') }}</span>
            <input
              v-model="topic"
              type="text"
              class="mgs-input"
              :placeholder="$t('ui.generate_map.topic_placeholder')"
              autocomplete="off"
              autocapitalize="sentences"
              :disabled="isGenerating"
              @keydown.enter.prevent="onSubmit"
            >
          </label>

          <div class="mgs-depth">
            <span class="mgs-field-label">{{ t('mobile.generate.depthLabel') }}</span>
            <div class="mgs-pill-row">
              <button
                v-for="d in (['shallow', 'medium', 'deep'] as const)"
                :key="d"
                type="button"
                class="mgs-pill"
                :class="{ 'mgs-pill--active': depth === d }"
                @click="depth = d"
              >{{ t(`mobile.generate.depth_${d}`) }}</button>
            </div>
          </div>

          <button
            type="button"
            class="mgs-go"
            :disabled="!topic.trim() || isGenerating"
            @click="onSubmit"
          >
            <NcAiMark :size="14" />
            <span>{{ t('mobile.generate.generateButton') }}</span>
          </button>
        </template>

        <!-- STREAMING STATE -->
        <template v-else>
          <div class="mgs-progress">
            <div class="mgs-progress-bar" />
          </div>
          <span class="mgs-progress-meta">
            {{ progress < 100 ? t('mobile.generate.progressGenerating', { n: streamingText.length }) : t('mobile.generate.progressBuilding') }}
          </span>

          <div ref="streamRef" class="mgs-stream" aria-live="polite">
            <pre class="mgs-stream-text">{{ streamingText || t('mobile.generate.connecting') }}</pre>
          </div>

          <button v-if="isGenerating" type="button" class="mgs-cancel" @click="emit('cancel')">
            {{ t('mobile.generate.cancel') }}
          </button>
        </template>

        <p v-if="errorText" class="mgs-error">{{ errorText }}</p>

        <div class="mgs-bottom-spacer" />
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Flat scrim — no blur in chrome (REDESIGN.md §5) */
.mgs-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
}

/* Sheet grammar: flat surface-2 + hairline top (REDESIGN.md §5) */
.mgs {
  position: fixed;
  left: 0; right: 0; bottom: var(--kbd-h, 0px);
  z-index: 201;
  display: flex; flex-direction: column;
  width: 100%;
  max-height: 90dvh;
  padding: 0 18px;
  /* Clear the mobile tab dock (~70px) so the bottom actions sit above it. */
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 86px);
  transition: bottom 220ms var(--nc-ease);
  background: var(--nc-surface-2);
  border-top: 1px solid var(--nc-border);
  border-radius: 0.5rem 0.5rem 0 0;
  font-family: var(--nc-font-body);
  color: var(--nc-text);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
  scrollbar-width: none;
  overflow-y: auto;
}
.mgs::-webkit-scrollbar { display: none; }

.mgs-handle {
  display: flex; justify-content: center; align-items: center;
  width: 100%; height: 28px;
  margin-top: 8px;
  background: transparent; border: none; padding: 0;
  cursor: pointer;
}
/* Drag handle in --nc-border color (REDESIGN.md sheet grammar) */
.mgs-handle-bar {
  width: 44px; height: 5px;
  border-radius: 999px;
  background: var(--nc-border);
}

.mgs-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
  margin: 6px 4px 14px;
}

.mgs-title {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  margin: 0 4px 8px;
  font-weight: 700;
}
.mgs-title-sans {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(30px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--nc-text);
}
/* Accent word — display face; serif never in sheets (REDESIGN.md §4) */
.mgs-title-serif {
  font-family: var(--nc-font-display);
  font-weight: 700;
  font-size: calc(30px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--nc-accent-text);
}
.mgs-sub {
  font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 18px;
  color: var(--nc-text-secondary);
  margin: 0 4px 22px;
}

/* INPUT */
.mgs-field {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 18px;
}
/* Input label grammar: mono uppercase micro-label (REDESIGN.md §5) */
.mgs-field-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.mgs-input {
  width: 100%;
  padding: 14px 16px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: 0.5rem;
  font-family: inherit;
  font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 20px;
  color: var(--nc-text);
  outline: none;
  box-sizing: border-box;
  transition: border-color 150ms var(--nc-ease);
}
/* Focus = border-color only, no ring/glow (REDESIGN.md §5) */
.mgs-input:focus {
  border-color: var(--nc-accent);
}
.mgs-input::placeholder { color: var(--nc-text-dim); }

.mgs-depth {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 22px;
}
.mgs-pill-row {
  display: flex; gap: 8px;
}
.mgs-pill {
  position: relative;
  flex: 1 1 0;
  padding: 10px 12px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  color: var(--nc-text-secondary);
  font-family: inherit; font-weight: 500; font-size: calc(13px * var(--nc-text-scale, 1));
  text-transform: capitalize;
  cursor: pointer;
  transition: background-color 150ms var(--nc-ease), border-color 150ms var(--nc-ease), color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
/* Vertical hit-area extension to reach the 44px minimum */
.mgs-pill::before {
  content: '';
  position: absolute;
  inset: -3px 0;
}
.mgs-pill:active { transform: scale(0.97); }
.mgs-pill--active {
  background: rgba(var(--nc-accent-rgb), 0.12);
  border-color: rgba(var(--nc-accent-rgb), 0.45);
  color: var(--nc-accent-text);
}

.mgs-go {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%;
  padding: 14px 16px;
  background: var(--nc-accent);
  border: none;
  border-radius: 0.5rem;
  font-family: inherit; font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-bg);
  cursor: pointer;
  transition: background-color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.mgs-go:active { transform: scale(0.97); background: var(--nc-accent-dark); }
.mgs-go:disabled { opacity: 0.45; cursor: not-allowed; }

/* STREAMING */
.mgs-progress {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--nc-border-subtle);
  overflow: hidden;
  margin: 4px 0 8px;
}
.mgs-progress-bar {
  height: 100%;
  background: var(--nc-accent);
  width: calc(v-bind(progress) * 1%);
  transition: width 280ms var(--nc-ease);
}
.mgs-progress-meta {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.10em;
  color: var(--nc-text-muted);
  margin: 0 4px 14px;
}
.mgs-stream {
  width: 100%;
  max-height: 38dvh;
  padding: 14px 16px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  border-radius: 0.5rem;
  overflow-y: auto;
  box-sizing: border-box;
  scrollbar-width: none;
}
.mgs-stream::-webkit-scrollbar { display: none; }
.mgs-stream-text {
  margin: 0;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 16px;
  color: var(--nc-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.mgs-cancel {
  position: relative;
  align-self: flex-end;
  margin-top: 14px;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  color: var(--nc-text-secondary);
  font-family: inherit; font-weight: 500; font-size: calc(13px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: background-color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
}
/* Vertical hit-area extension to reach the 44px minimum */
.mgs-cancel::before {
  content: '';
  position: absolute;
  inset: -3px 0;
}
.mgs-cancel:active { transform: scale(0.97); background: var(--nc-surface-3); }

/* Errors are coral (REDESIGN.md §1) */
.mgs-error {
  margin: 14px 4px 0;
  font-size: calc(12px * var(--nc-text-scale, 1)); color: var(--nc-coral);
}

.mgs-bottom-spacer { height: 8px; }

/* Transitions — single ease, percent-based translateY (REDESIGN.md §6) */
.mgs-fade-enter-active, .mgs-fade-leave-active { transition: opacity 220ms var(--nc-ease); }
.mgs-fade-enter-from, .mgs-fade-leave-to { opacity: 0; }
.mgs-slide-enter-active { transition: transform 280ms var(--nc-ease); }
.mgs-slide-leave-active { transition: transform 220ms var(--nc-ease); }
.mgs-slide-enter-from, .mgs-slide-leave-to { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) {
  .mgs-slide-enter-active, .mgs-slide-leave-active { transition: none; }
}
</style>
