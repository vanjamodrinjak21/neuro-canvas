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
            <path d="M8 3.5V12.5M3.5 8H12.5" stroke="#09090B" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span>{{ submitting ? t('mobile.capture.saving') : t('mobile.capture.action') }}</span>
        </button>

        <span class="qcs-hint">{{ t('mobile.capture.hint') }}</span>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qcs-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  z-index: 200;
}

.qcs {
  position: fixed;
  left: 0; right: 0; bottom: var(--kbd-h, 0px);
  z-index: 201;
  display: flex; flex-direction: column;
  width: 100%;
  max-height: 90dvh;
  padding: 0 18px;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
  transition: bottom 220ms cubic-bezier(0.16, 1, 0.3, 1);
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
.qcs::-webkit-scrollbar { display: none; }

.qcs-handle {
  display: flex; justify-content: center; align-items: center;
  width: 100%; height: 28px;
  margin-top: 8px;
  background: transparent; border: none; padding: 0;
  cursor: pointer;
}
.qcs-handle-bar {
  width: 44px; height: 5px;
  border-radius: 999px;
  background: rgba(250, 250, 250, 0.18);
}

.qcs-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.14em;
  color: #00D2BE;
  margin: 6px 4px 14px;
}

.qcs-title {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  margin: 0 4px 8px;
  font-weight: 500;
}
.qcs-title-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: calc(30px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.025em;
  color: #FAFAFA;
}
.qcs-title-serif {
  font-family: 'Newsreader', Georgia, serif;
  font-style: italic;
  font-weight: 400; font-size: calc(30px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: #00D2BE;
}

.qcs-sub {
  font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 18px;
  color: #A1A1AA;
  margin: 0 4px 18px;
}

.qcs-field {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 16px;
}
.qcs-field-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.10em;
  color: #71717A;
  padding: 0 4px;
}
.qcs-input {
  width: 100%;
  padding: 14px 16px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.10);
  border-radius: 12px;
  font-family: inherit;
  font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 22px;
  color: #FAFAFA;
  outline: none;
  box-sizing: border-box;
  resize: none;
  transition: border-color 150ms ease, background 150ms ease;
}
.qcs-input:focus {
  border-color: rgba(0, 210, 190, 0.45);
  background: rgba(0, 210, 190, 0.05);
}
.qcs-input::placeholder { color: #52525B; }

.qcs-go {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%;
  padding: 14px 16px;
  background: #00D2BE;
  border: none;
  border-radius: 12px;
  font-family: inherit; font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1));
  color: #09090B;
  cursor: pointer;
  transition: background 150ms ease, transform 120ms ease;
}
.qcs-go:active { transform: scale(0.98); background: #00b8a6; }
.qcs-go:disabled { opacity: 0.5; cursor: not-allowed; }

.qcs-hint {
  font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 16px;
  color: #52525B;
  margin: 12px 4px 0;
  text-align: center;
}

/* Transitions */
.qcs-fade-enter-active, .qcs-fade-leave-active { transition: opacity 220ms ease; }
.qcs-fade-enter-from, .qcs-fade-leave-to { opacity: 0; }

.qcs-slide-enter-active { transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1); }
.qcs-slide-leave-active { transition: transform 200ms cubic-bezier(0.4, 0, 1, 1); }
.qcs-slide-enter-from, .qcs-slide-leave-to { transform: translateY(100%); }
</style>
