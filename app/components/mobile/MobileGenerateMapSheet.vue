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
interface Props {
  visible: boolean
  isGenerating: boolean
  streamingText: string
  errorText?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  errorText: null,
})

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
      <section v-if="visible" class="mgs" role="dialog" aria-modal="true" aria-label="Generate map with AI">
        <button class="mgs-handle" type="button" :aria-label="'Close'" @click="onClose">
          <span class="mgs-handle-bar" />
        </button>

        <span class="mgs-eyebrow">AI — GENERATE MAP</span>

        <h1 class="mgs-title">
          <span class="mgs-title-sans">Map</span>
          <span class="mgs-title-serif">anything.</span>
        </h1>
        <span class="mgs-sub">Type a topic; we'll outline branches, sub-branches and connections.</span>

        <!-- INPUT STATE -->
        <template v-if="!isGenerating && progress < 100">
          <label class="mgs-field">
            <span class="mgs-field-label">TOPIC</span>
            <input
              v-model="topic"
              type="text"
              class="mgs-input"
              placeholder="e.g. Renewable energy systems"
              autocomplete="off"
              autocapitalize="sentences"
              :disabled="isGenerating"
              @keydown.enter.prevent="onSubmit"
            >
          </label>

          <div class="mgs-depth">
            <span class="mgs-field-label">DEPTH</span>
            <div class="mgs-pill-row">
              <button
                v-for="d in (['shallow', 'medium', 'deep'] as const)"
                :key="d"
                type="button"
                class="mgs-pill"
                :class="{ 'mgs-pill--active': depth === d }"
                @click="depth = d"
              >{{ d }}</button>
            </div>
          </div>

          <button
            type="button"
            class="mgs-go"
            :disabled="!topic.trim() || isGenerating"
            @click="onSubmit"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#09090B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
            </svg>
            <span>Generate</span>
          </button>
        </template>

        <!-- STREAMING STATE -->
        <template v-else>
          <div class="mgs-progress">
            <div class="mgs-progress-bar" :style="{ width: progress + '%' }" />
          </div>
          <span class="mgs-progress-meta">
            {{ progress < 100 ? `Generating · ${streamingText.length} chars` : 'Building nodes…' }}
          </span>

          <div ref="streamRef" class="mgs-stream" aria-live="polite">
            <pre class="mgs-stream-text">{{ streamingText || 'Connecting to model…' }}</pre>
          </div>

          <button v-if="isGenerating" type="button" class="mgs-cancel" @click="emit('cancel')">
            Cancel
          </button>
        </template>

        <p v-if="errorText" class="mgs-error">{{ errorText }}</p>

        <div class="mgs-bottom-spacer" />
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mgs-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  z-index: 200;
}

.mgs {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 201;
  display: flex; flex-direction: column;
  width: 100%;
  max-height: 90dvh;
  padding: 0 18px;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
  background: #09090B;
  border-top: 1px solid rgba(250, 250, 250, 0.10);
  border-radius: 24px 24px 0 0;
  font-family: 'Inter', system-ui, sans-serif;
  color: #FAFAFA;
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
.mgs-handle-bar {
  width: 44px; height: 5px;
  border-radius: 999px;
  background: rgba(250, 250, 250, 0.18);
}

.mgs-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.14em;
  color: #00D2BE;
  margin: 6px 4px 14px;
}

.mgs-title {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  margin: 0 4px 8px;
  font-weight: 500;
}
.mgs-title-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 30px; line-height: 32px;
  letter-spacing: -0.025em;
  color: #FAFAFA;
}
.mgs-title-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: 38px; line-height: 32px;
  letter-spacing: -0.02em;
  color: #00D2BE;
}
.mgs-sub {
  font-size: 13px; line-height: 18px;
  color: #A1A1AA;
  margin: 0 4px 22px;
}

/* INPUT */
.mgs-field {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 18px;
}
.mgs-field-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 12px;
  letter-spacing: 0.14em;
  color: #52525B;
}
.mgs-input {
  width: 100%;
  padding: 14px 16px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.10);
  border-radius: 12px;
  font-family: inherit;
  font-size: 16px; line-height: 20px;
  color: #FAFAFA;
  outline: none;
  box-sizing: border-box;
  transition: border-color 150ms ease, background 150ms ease;
}
.mgs-input:focus {
  border-color: rgba(0, 210, 190, 0.45);
  background: rgba(0, 210, 190, 0.05);
}
.mgs-input::placeholder { color: #52525B; }

.mgs-depth {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 22px;
}
.mgs-pill-row {
  display: flex; gap: 8px;
}
.mgs-pill {
  flex: 1 1 0;
  padding: 10px 12px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.10);
  border-radius: 10px;
  color: #A1A1AA;
  font-family: inherit; font-weight: 500; font-size: 13px;
  text-transform: capitalize;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.mgs-pill--active {
  background: rgba(0, 210, 190, 0.12);
  border-color: rgba(0, 210, 190, 0.45);
  color: #00D2BE;
}

.mgs-go {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%;
  padding: 14px 16px;
  background: #00D2BE;
  border: none;
  border-radius: 12px;
  font-family: inherit; font-weight: 600; font-size: 14px;
  color: #09090B;
  cursor: pointer;
  transition: background 150ms ease, transform 120ms ease;
}
.mgs-go:active { transform: scale(0.98); background: #00b8a6; }
.mgs-go:disabled { opacity: 0.5; cursor: not-allowed; }

/* STREAMING */
.mgs-progress {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: rgba(250, 250, 250, 0.06);
  overflow: hidden;
  margin: 4px 0 8px;
}
.mgs-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #00D2BE, #6FE1D4);
  transition: width 280ms ease;
}
.mgs-progress-meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 14px;
  letter-spacing: 0.10em;
  color: #71717A;
  margin: 0 4px 14px;
}
.mgs-stream {
  width: 100%;
  max-height: 38dvh;
  padding: 14px 16px;
  background: rgba(250, 250, 250, 0.03);
  border: 1px solid rgba(250, 250, 250, 0.08);
  border-radius: 12px;
  overflow-y: auto;
  box-sizing: border-box;
  scrollbar-width: none;
}
.mgs-stream::-webkit-scrollbar { display: none; }
.mgs-stream-text {
  margin: 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; line-height: 16px;
  color: #A1A1AA;
  white-space: pre-wrap;
  word-break: break-word;
}

.mgs-cancel {
  align-self: flex-end;
  margin-top: 14px;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid rgba(250, 250, 250, 0.12);
  border-radius: 10px;
  color: #A1A1AA;
  font-family: inherit; font-weight: 500; font-size: 13px;
  cursor: pointer;
}

.mgs-error {
  margin: 14px 4px 0;
  font-size: 12px; color: #FCA5A5;
}

.mgs-bottom-spacer { height: 8px; }

/* Light */
:root.light .mgs {
  background: #FAFAF9;
  color: #18181B;
  border-top-color: rgba(0, 0, 0, 0.08);
}
:root.light .mgs-handle-bar { background: rgba(0, 0, 0, 0.18); }
:root.light .mgs-input,
:root.light .mgs-pill,
:root.light .mgs-stream {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.10);
  color: #18181B;
}
:root.light .mgs-stream-text { color: #52525B; }
:root.light .mgs-progress { background: rgba(0, 0, 0, 0.06); }

/* Transitions */
.mgs-fade-enter-active, .mgs-fade-leave-active { transition: opacity 220ms ease; }
.mgs-fade-enter-from, .mgs-fade-leave-to { opacity: 0; }
.mgs-slide-enter-active { transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1); }
.mgs-slide-leave-active { transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1); }
.mgs-slide-enter-from, .mgs-slide-leave-to { transform: translateY(100%); }

:root.platform-android .mgs { border-radius: 20px 20px 0 0; }
</style>
