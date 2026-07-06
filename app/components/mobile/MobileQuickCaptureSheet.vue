<script setup lang="ts">
/**
 * Mobile Quick-Capture sheet (AER-70).
 *
 * A friction-free bottom sheet to drop a thought or link into the auto-provisioned
 * "Inbox" map. Bound to the module-scoped `useQuickCapture` state so it can be
 * driven from anywhere — the header button on the mobile dashboard, or the
 * `neurocanvas://capture` deep link / Android share intent (both routed through
 * `plugins/quick-capture-deeplink.client.ts`).
 *
 * Mounted once at the app root. It renders NOTHING until opened, and only on
 * native/mobile shells, so it is inert on desktop web. Persistence goes through
 * the normal sync path (see `useQuickCapture`) so capture works offline.
 *
 * Editorial nocturnal aesthetic, matching MobileGenerateMapSheet.
 */
import { useQuickCapture, looksLikeUrl } from '~/composables/useQuickCapture'
import { useToast } from '~/composables/useToast'

const { t } = useI18n()
const { isMobile, isNative, haptics } = usePlatform()
const capture = useQuickCapture()
const toast = useToast()

// Only ever active on mobile/native shells.
const enabled = computed(() => isMobile.value || isNative.value)

const draft = ref('')
const submitting = ref(false)

// True when the current draft is an http(s) URL (drives the URL/text affordance).
const draftIsUrl = computed(() => looksLikeUrl(draft.value))
const canSubmit = computed(() => draft.value.trim().length > 0 && !submitting.value)

// Seed the input from any prefill (deep link / share) each time the sheet opens.
watch(
  () => capture.isOpen.value,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
    if (open) {
      const p = capture.prefill.value
      // A shared URL takes the input verbatim; otherwise the shared text does.
      draft.value = (p.url ?? p.text ?? '').trim()
      submitting.value = false
    } else {
      draft.value = ''
    }
  },
)

function onClose() {
  if (submitting.value) return
  capture.close()
}

async function onSubmit() {
  const value = draft.value.trim()
  if (!value || submitting.value) return

  submitting.value = true
  try {
    // Classify the single input: an http(s) link becomes a URL capture,
    // anything else is captured as text. A deep link that supplied BOTH a
    // label and a URL keeps them paired.
    const prefill = capture.prefill.value
    const payload = draftIsUrl.value
      ? { url: value, text: prefill.url === value ? prefill.text : undefined }
      : { text: value }

    await capture.captureToInbox(payload)

    if (isMobile.value || isNative.value) void haptics.notification('success')
    toast.success(t('mobile.capture.saved'))
    capture.close()
  } catch {
    toast.error(t('mobile.capture.error'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport v-if="enabled" to="body">
    <Transition name="qcs-fade">
      <div v-if="capture.isOpen.value" class="qcs-backdrop" @click="onClose" />
    </Transition>
    <Transition name="qcs-slide">
      <section
        v-if="capture.isOpen.value"
        class="qcs"
        role="dialog"
        aria-modal="true"
        :aria-label="t('mobile.capture.dialogLabel')"
      >
        <button class="qcs-handle" type="button" :aria-label="t('mobile.capture.close')" @click="onClose">
          <span class="qcs-handle-bar" />
        </button>

        <span class="qcs-eyebrow">{{ t('mobile.capture.eyebrow') }}</span>

        <h1 class="qcs-title">
          <span class="qcs-title-sans">{{ t('mobile.capture.titleSans') }}</span>
          <span class="qcs-title-serif">{{ t('mobile.capture.titleSerif') }}</span>
        </h1>
        <span class="qcs-sub">{{ t('mobile.capture.subtitle') }}</span>

        <label class="qcs-field">
          <span class="qcs-field-label">
            {{ draftIsUrl ? t('mobile.capture.linkLabel') : t('mobile.capture.textLabel') }}
          </span>
          <textarea
            v-model="draft"
            class="qcs-input"
            rows="3"
            :placeholder="t('mobile.capture.placeholder')"
            autocomplete="off"
            autocapitalize="sentences"
            :disabled="submitting"
            @keydown.meta.enter.prevent="onSubmit"
            @keydown.ctrl.enter.prevent="onSubmit"
          />
        </label>

        <button
          type="button"
          class="qcs-go"
          :disabled="!canSubmit"
          @click="onSubmit"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span>{{ submitting ? t('mobile.capture.saving') : t('mobile.capture.action') }}</span>
        </button>

        <span class="qcs-hint">{{ t('mobile.capture.hint') }}</span>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Flat scrim — no blur in chrome (REDESIGN.md §5) */
.qcs-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
}

/* Sheet grammar: flat surface-2 + hairline top (REDESIGN.md §5) */
.qcs {
  position: fixed;
  left: 0; right: 0; bottom: var(--kbd-h, 0px);
  z-index: 201;
  display: flex; flex-direction: column;
  width: 100%;
  max-height: 90dvh;
  padding: 0 18px;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
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
.qcs::-webkit-scrollbar { display: none; }

.qcs-handle {
  display: flex; justify-content: center; align-items: center;
  width: 100%; height: 28px;
  margin-top: 8px;
  background: transparent; border: none; padding: 0;
  cursor: pointer;
}
/* Drag handle in --nc-border color (REDESIGN.md sheet grammar) */
.qcs-handle-bar {
  width: 44px; height: 5px;
  border-radius: 999px;
  background: var(--nc-border);
}

.qcs-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
  margin: 6px 4px 14px;
}

.qcs-title {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  margin: 0 4px 8px;
  font-weight: 700;
}
.qcs-title-sans {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(30px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--nc-text);
}
.qcs-title-serif {
  font-family: var(--nc-font-serif);
  font-style: italic;
  font-weight: 400; font-size: calc(30px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--nc-accent-text);
}

.qcs-sub {
  font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 18px;
  color: var(--nc-text-secondary);
  margin: 0 4px 18px;
}

.qcs-field {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 16px;
}
/* Input label grammar: mono uppercase micro-label (REDESIGN.md §5) */
.qcs-field-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
  padding: 0 4px;
}
.qcs-input {
  width: 100%;
  padding: 14px 16px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  font-family: inherit;
  font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 22px;
  color: var(--nc-text);
  outline: none;
  box-sizing: border-box;
  resize: none;
  transition: border-color 150ms var(--nc-ease);
}
/* Focus = border-color only, no ring/glow (REDESIGN.md §5) */
.qcs-input:focus {
  border-color: var(--nc-accent);
}
.qcs-input::placeholder { color: var(--nc-text-dim); }

.qcs-go {
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
.qcs-go:active { transform: scale(0.97); background: var(--nc-accent-dark); }
.qcs-go:disabled { opacity: 0.45; cursor: not-allowed; }

.qcs-hint {
  font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 16px;
  color: var(--nc-text-muted);
  margin: 12px 4px 0;
  text-align: center;
}

/* Transitions — single ease, percent-based translateY (§6) */
.qcs-fade-enter-active, .qcs-fade-leave-active { transition: opacity 220ms var(--nc-ease); }
.qcs-fade-enter-from, .qcs-fade-leave-to { opacity: 0; }

.qcs-slide-enter-active { transition: transform 260ms var(--nc-ease); }
.qcs-slide-leave-active { transition: transform 200ms var(--nc-ease); }
.qcs-slide-enter-from, .qcs-slide-leave-to { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) {
  .qcs-slide-enter-active, .qcs-slide-leave-active { transition: none; }
}
</style>
