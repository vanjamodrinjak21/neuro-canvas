<script setup lang="ts">
const emit = defineEmits<{
  select: [template: string | null]
}>()

// Each template maps to an i18n key group under common.guest.picker.tpl.*
const templates = [
  { id: 'decision-tree', key: 'decision_tree' },
  { id: 'project-plan', key: 'project_plan' },
  { id: 'research-synthesis', key: 'research_synthesis' },
  { id: 'brainstorm', key: 'brainstorm' },
  { id: 'pros-cons', key: 'pros_cons' },
  { id: 'mind-map', key: 'mind_map' },
]

function handlePick(id: string) {
  emit('select', id)
}

function handleBlank() {
  emit('select', null)
}
</script>

<template>
  <Teleport to="body">
    <div class="picker">
      <header class="picker-head">
        <div class="head-inner">
          <div class="head-brand">
            <NcLogo :size="14" :container-size="26" :radius="6" />
            <div class="head-id">{{ $t('common.guest.session_chip') }}</div>
          </div>
          <div class="head-step">{{ $t('common.guest.picker.step') }}</div>
        </div>
      </header>

      <div class="picker-body">
        <div class="body-inner">
          <div class="title-block">
            <h1 class="title">
              {{ $t('common.guest.picker.title_lead') }}
              <span class="title-italic">{{ $t('common.guest.picker.title_em') }}</span>
            </h1>
            <p class="subtitle">{{ $t('common.guest.picker.subtitle') }}</p>
          </div>

          <div class="templates">
            <div class="templates-head">
              <div class="templates-head-left">
                <span class="templates-eyebrow">{{ $t('common.guest.picker.pick_eyebrow') }}</span>
                <span class="templates-sub">{{ $t('common.guest.picker.pick_sub') }}</span>
              </div>
              <button class="templates-browse">{{ $t('common.guest.picker.browse') }}</button>
            </div>

            <div class="templates-grid">
              <button
                v-for="tmpl in templates"
                :key="tmpl.id"
                class="tpl"
                @click="handlePick(tmpl.id)"
              >
                <div class="tpl-preview">
                  <svg class="tpl-edges" viewBox="0 0 280 184" preserveAspectRatio="none">
                    <path d="M140 32 L48 70" stroke="currentColor" stroke-width="1.4" fill="none" />
                    <path d="M140 32 L140 70" stroke="currentColor" stroke-width="1.4" fill="none" />
                    <path d="M140 32 L232 70" stroke="currentColor" stroke-width="1.4" fill="none" />
                    <path d="M48 96 L48 138" stroke="currentColor" stroke-width="1.4" fill="none" />
                    <path d="M140 96 L140 138" stroke="currentColor" stroke-width="1.4" fill="none" />
                    <path d="M232 96 L232 138" stroke="currentColor" stroke-width="1.4" fill="none" />
                  </svg>
                  <div class="tpl-label tpl-root tpl-c2">{{ $t(`common.guest.picker.tpl.${tmpl.key}.root`) }}</div>
                  <div class="tpl-label tpl-mid tpl-c1">{{ $t(`common.guest.picker.tpl.${tmpl.key}.m1`) }}</div>
                  <div class="tpl-label tpl-mid tpl-c2">{{ $t(`common.guest.picker.tpl.${tmpl.key}.m2`) }}</div>
                  <div class="tpl-label tpl-mid tpl-c3">{{ $t(`common.guest.picker.tpl.${tmpl.key}.m3`) }}</div>
                  <div class="tpl-label tpl-leaf tpl-c1">{{ $t(`common.guest.picker.tpl.${tmpl.key}.l1`) }}</div>
                  <div class="tpl-label tpl-leaf tpl-c2">{{ $t(`common.guest.picker.tpl.${tmpl.key}.l2`) }}</div>
                  <div class="tpl-label tpl-leaf tpl-c3">{{ $t(`common.guest.picker.tpl.${tmpl.key}.l3`) }}</div>
                </div>
                <div class="tpl-meta">
                  <div class="tpl-meta-row">
                    <span class="tpl-title">{{ $t(`common.guest.picker.tpl.${tmpl.key}.title`) }}</span>
                    <span class="tpl-receipt">{{ $t(`common.guest.picker.tpl.${tmpl.key}.receipt`) }}</span>
                  </div>
                  <div class="tpl-desc">{{ $t(`common.guest.picker.tpl.${tmpl.key}.desc`) }}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer class="picker-foot">
        <div class="foot-inner">
          <button class="foot-blank" @click="handleBlank">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3 H11 V11 H3 Z M3 7 H11 M7 3 V11" stroke-linecap="round" /></svg>
            <span>{{ $t('common.guest.picker.blank') }}</span>
          </button>
          <div class="foot-tip">
            <span class="foot-tip-label">{{ $t('common.guest.picker.tip_label') }}</span>
            <span>{{ $t('common.guest.picker.tip') }}</span>
          </div>
        </div>
      </footer>
    </div>
  </Teleport>
</template>

<style scoped>
.picker {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--nc-bg, #09090B);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  font-family: 'Inter', system-ui, sans-serif;
}

:root.light .picker {
  background: #FAF8F4;
}

/* Header */
.picker-head {
  padding: 24px 80px 0;
  flex-shrink: 0;
}

.head-inner {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-id,
.head-step {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #A1A1AA);
}

.head-step {
  color: var(--nc-ink-faint, #52525B);
}

:root.light .head-id {
  color: #5A5A5A;
}

:root.light .head-step {
  color: #8A8780;
}

/* Body */
.picker-body {
  padding: 56px 80px 40px;
  flex: 1;
}

.body-inner {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.title-block {
  max-width: 780px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.title {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--nc-ink, #FAFAFA);
  margin: 0;
}

:root.light .title {
  color: #1A1A1A;
}

.title-italic {
  font-style: italic;
  color: var(--nc-accent, #00D2BE);
}

:root.light .title-italic {
  color: var(--nc-accent-dark, #00B5A4);
}

.subtitle {
  font-size: calc(15px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.55;
  max-width: 560px;
  margin: 0;
}

:root.light .subtitle {
  color: #5A5A5A;
}

/* Templates */
.templates {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.templates-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.templates-head-left {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.templates-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.06em;
  color: var(--nc-ink-faint, #52525B);
}

.templates-sub {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #A1A1AA);
}

.templates-browse {
  background: none;
  border: none;
  font-family: inherit;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-ink-faint, #52525B);
  cursor: pointer;
}

.templates-browse:hover {
  color: var(--nc-ink, #FAFAFA);
}

:root.light .templates-eyebrow,
:root.light .templates-browse {
  color: #8A8780;
}

:root.light .templates-sub {
  color: #5A5A5A;
}

:root.light .templates-browse:hover {
  color: #1A1A1A;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.tpl {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color 150ms ease, transform 80ms ease;
}

.tpl:hover {
  border-color: rgba(0, 210, 190, 0.4);
}

.tpl:active {
  transform: scale(0.99);
}

:root.light .tpl {
  background: #FFFFFF;
  border-color: #DDD9CF;
}

:root.light .tpl:hover {
  border-color: rgba(0, 181, 164, 0.5);
}

.tpl-preview {
  position: relative;
  width: 100%;
  height: 184px;
  background: var(--nc-bg, #09090B);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
  overflow: hidden;
  color: var(--nc-border-hover, #3F3F46);
}

:root.light .tpl-preview {
  background: #F4F2EC;
  border-color: #DDD9CF;
  color: #C8C4B8;
}

.tpl-edges {
  position: absolute;
  inset: 0;
}

.tpl-label {
  position: absolute;
  font-size: calc(9px * var(--nc-text-scale, 1));
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 5px;
  white-space: nowrap;
  pointer-events: none;
  /* Center the label exactly on its node coordinate so it sits on the edge ends */
  transform: translate(-50%, -50%);
}

/* Columns — percentages of the 280-wide viewBox the edges are drawn in,
   so labels stay anchored to the edge endpoints at any preview width. */
.tpl-c1 { left: 17.143%; }
.tpl-c2 { left: 50%; }
.tpl-c3 { left: 82.857%; }

/* Rows — vertical node centers in the 184px-tall preview. */
.tpl-root {
  top: 32px;
  font-size: calc(10px * var(--nc-text-scale, 1));
  background: var(--nc-surface-3, #1E1E22);
  border: 1px solid var(--nc-border-hover, #3F3F46);
  color: var(--nc-ink, #FAFAFA);
  padding: 5px 12px;
  border-radius: 6px;
}

.tpl-mid { top: 83px; }
.tpl-leaf { top: 138px; }

:root.light .tpl-root {
  background: #EDE9E0;
  border-color: #C8C4B8;
  color: #1A1A1A;
}

.tpl-mid,
.tpl-leaf {
  background: var(--nc-surface-2, #121216);
  border: 1px solid var(--nc-border, #1E1E22);
  color: var(--nc-ink-muted, #A1A1AA);
}

:root.light .tpl-mid,
:root.light .tpl-leaf {
  background: #FFFFFF;
  border-color: #DDD9CF;
  color: #5A5A5A;
}

.tpl-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tpl-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tpl-title {
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
}

.tpl-receipt {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-ink-faint, #52525B);
  flex-shrink: 0;
}

.tpl-desc {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.5;
}

:root.light .tpl-title {
  color: #1A1A1A;
}

:root.light .tpl-receipt {
  color: #8A8780;
}

:root.light .tpl-desc {
  color: #5A5A5A;
}

/* Footer */
.picker-foot {
  padding: 16px 80px 32px;
  border-top: 1px solid var(--nc-border, #1E1E22);
}

.foot-inner {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:root.light .picker-foot {
  border-top-color: #DDD9CF;
}

.foot-blank {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #A1A1AA);
  cursor: pointer;
}

.foot-blank:hover {
  color: var(--nc-ink, #FAFAFA);
}

:root.light .foot-blank {
  color: #5A5A5A;
}

:root.light .foot-blank:hover {
  color: #1A1A1A;
}

.foot-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #A1A1AA);
}

.foot-tip-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-ink-faint, #52525B);
}

:root.light .foot-tip {
  color: #5A5A5A;
}

:root.light .foot-tip-label {
  color: #8A8780;
}

/* Mobile */
@media (max-width: 1024px) {
  .picker-head {
    padding: 20px 32px 0;
  }
  .picker-body {
    padding: 40px 32px 32px;
  }
  .body-inner {
    gap: 32px;
  }
  .templates-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .picker-foot {
    padding: 16px 32px 24px;
  }
}

@media (max-width: 640px) {
  .picker-head {
    padding: 16px 20px 0;
  }
  .picker-body {
    padding: 24px 20px;
  }
  .body-inner {
    gap: 24px;
  }
  .templates-grid {
    grid-template-columns: 1fr;
  }
  .picker-foot {
    padding: 16px 20px 20px;
  }
  .foot-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .foot-tip {
    font-size: calc(11px * var(--nc-text-scale, 1));
  }
}
</style>
