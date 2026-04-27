<script setup lang="ts">
const emit = defineEmits<{
  select: [template: string | null]
  generate: [prompt: string]
}>()

const aiPrompt = ref('')

const suggestions = [
  'Plan a 3-day onboarding for new hires',
  'Map arguments for and against remote work',
  'Outline a research review on diffusion models',
]

const templates = [
  {
    id: 'decision-tree',
    title: 'Decision tree',
    description: 'Compare options. Trace consequences. End with a call.',
    receipt: '7 nodes · 12s',
    rootLabel: 'Decision',
    midLabels: ['Option A', 'Risks', 'Option B'],
    leafLabels: ['Pro', 'Mixed', 'Con'],
  },
  {
    id: 'project-plan',
    title: 'Project plan',
    description: 'Goals → milestones → checkpoints. Time-bound thinking.',
    receipt: '9 nodes · 18s',
    rootLabel: 'Goal',
    midLabels: ['Spec', 'Build', 'Ship'],
    leafLabels: ['Today', 'Wk 2', 'Wk 4'],
  },
  {
    id: 'research-synthesis',
    title: 'Research synthesis',
    description: 'Sources cluster. AI summarizes the cluster for you.',
    receipt: '5 nodes · 10s',
    rootLabel: 'Question',
    midLabels: ['Source 1', 'Source 2', 'Source 3'],
    leafLabels: ['Theme', 'AI synth', 'Gap'],
  },
  {
    id: 'brainstorm',
    title: 'Brainstorm',
    description: 'Spray ideas first. Cluster them later.',
    receipt: '12 nodes · 8s',
    rootLabel: 'Topic',
    midLabels: ['Idea 1', 'Idea 2', 'Idea 3'],
    leafLabels: ['Sub a', 'Sub b', 'Sub c'],
  },
  {
    id: 'pros-cons',
    title: 'Pros & cons',
    description: 'Two columns. Forces honesty about both sides.',
    receipt: '8 nodes · 14s',
    rootLabel: 'Question',
    midLabels: ['Pro 1', 'Mixed', 'Con 1'],
    leafLabels: ['Pro 2', 'Tradeoff', 'Con 2'],
  },
  {
    id: 'mind-map',
    title: 'Mind map',
    description: "Free-form web. When you don't know the structure yet.",
    receipt: '11 nodes · 16s',
    rootLabel: 'Center',
    midLabels: ['Branch', 'Branch', 'Branch'],
    leafLabels: ['Sub', 'Sub', 'Sub'],
  },
]

function pickSuggestion(s: string) {
  aiPrompt.value = s
}

function handleGenerate() {
  if (aiPrompt.value.trim()) {
    emit('generate', aiPrompt.value.trim())
  }
}

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
        <div class="head-brand">
          <div class="head-logo">
            <div class="head-logo-dot" />
          </div>
          <div class="head-id">guest_session.live</div>
        </div>
        <div class="head-step">step 02 — pick your shape</div>
      </header>

      <div class="picker-body">
        <div class="title-block">
          <h1 class="title">A blank canvas <span class="title-italic">is sometimes the wrong start.</span></h1>
          <p class="subtitle">Describe what you're thinking, and the AI will lay it out. Or pick a shape that fits.</p>
        </div>

        <div class="ai-card">
          <div class="ai-eyebrow-row">
            <div class="ai-eyebrow">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 1 L7.5 4.5 L11 6 L7.5 7.5 L6 11 L4.5 7.5 L1 6 L4.5 4.5 Z" /></svg>
              <span>AI · GENERATE</span>
            </div>
            <span class="ai-hint">type a sentence — the canvas builds itself</span>
          </div>

          <div class="ai-prompt">
            <input
              v-model="aiPrompt"
              type="text"
              class="ai-input"
              placeholder="Plan a launch for our pgvector RAG search — engineering, content, rollout."
              @keydown.enter="handleGenerate"
            >
            <button class="ai-generate" :disabled="!aiPrompt.trim()" @click="handleGenerate">
              <span>Generate</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7 H11 M7.5 3 L11 7 L7.5 11" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </div>

          <div class="ai-suggestions">
            <span class="ai-sug-label">SUGGESTIONS</span>
            <div class="ai-sug-list">
              <button
                v-for="s in suggestions"
                :key="s"
                class="ai-sug"
                @click="pickSuggestion(s)"
              >
                {{ s }}
              </button>
            </div>
          </div>
        </div>

        <div class="templates">
          <div class="templates-head">
            <div class="templates-head-left">
              <span class="templates-eyebrow">OR — PICK A SHAPE</span>
              <span class="templates-sub">6 starts that fit most thinking</span>
            </div>
            <button class="templates-browse">browse all 24 →</button>
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
                <div class="tpl-label tpl-root">{{ tmpl.rootLabel }}</div>
                <div class="tpl-label tpl-mid" style="left: 22px; top: 64px;">{{ tmpl.midLabels[0] }}</div>
                <div class="tpl-label tpl-mid" style="left: 120px; top: 64px;">{{ tmpl.midLabels[1] }}</div>
                <div class="tpl-label tpl-mid" style="left: 218px; top: 64px;">{{ tmpl.midLabels[2] }}</div>
                <div class="tpl-label tpl-leaf" style="left: 28px; top: 132px;">{{ tmpl.leafLabels[0] }}</div>
                <div class="tpl-label tpl-leaf" style="left: 122px; top: 132px;">{{ tmpl.leafLabels[1] }}</div>
                <div class="tpl-label tpl-leaf" style="left: 220px; top: 132px;">{{ tmpl.leafLabels[2] }}</div>
              </div>
              <div class="tpl-meta">
                <div class="tpl-meta-row">
                  <span class="tpl-title">{{ tmpl.title }}</span>
                  <span class="tpl-receipt">{{ tmpl.receipt }}</span>
                </div>
                <div class="tpl-desc">{{ tmpl.description }}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <footer class="picker-foot">
        <button class="foot-blank" @click="handleBlank">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3 H11 V11 H3 Z M3 7 H11 M7 3 V11" stroke-linecap="round" /></svg>
          <span>Start with a blank canvas instead</span>
        </button>
        <div class="foot-tip">
          <span class="foot-tip-label">tip:</span>
          <span>you can change template later — nothing is locked.</span>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 80px 0;
  flex-shrink: 0;
}

.head-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-logo {
  width: 24px;
  height: 24px;
  background: var(--nc-accent, #00D2BE);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.head-logo-dot {
  width: 6px;
  height: 6px;
  background: var(--nc-bg, #09090B);
  border-radius: 1px;
}

.head-id,
.head-step {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
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
  display: flex;
  flex-direction: column;
  gap: 48px;
  padding: 56px 80px 40px;
  flex: 1;
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
  font-size: 15px;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.55;
  max-width: 560px;
  margin: 0;
}

:root.light .subtitle {
  color: #5A5A5A;
}

/* AI Card */
.ai-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 14px;
}

:root.light .ai-card {
  background: #FFFFFF;
  border-color: #DDD9CF;
}

.ai-eyebrow-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.22);
  border-radius: 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--nc-accent, #00D2BE);
}

.ai-hint {
  font-size: 13px;
  color: var(--nc-ink-muted, #A1A1AA);
}

:root.light .ai-hint {
  color: #5A5A5A;
}

.ai-prompt {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  background: var(--nc-bg, #09090B);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 10px;
}

:root.light .ai-prompt {
  background: #F4F2EC;
  border-color: #DDD9CF;
}

.ai-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-size: 22px;
  color: var(--nc-ink, #FAFAFA);
  min-width: 0;
}

.ai-input::placeholder {
  color: var(--nc-ink-faint, #52525B);
}

:root.light .ai-input {
  color: #1A1A1A;
}

:root.light .ai-input::placeholder {
  color: #8A8780;
}

.ai-generate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--nc-accent, #00D2BE);
  border: none;
  border-radius: 8px;
  color: #09090B;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, transform 80ms ease;
  flex-shrink: 0;
}

.ai-generate:hover:not(:disabled) {
  background: var(--nc-accent-dark, #00A89A);
}

.ai-generate:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ai-generate:active {
  transform: scale(0.97);
}

:root.light .ai-generate {
  background: #1A1A1A;
  color: #FAF8F4;
}

:root.light .ai-generate:hover:not(:disabled) {
  background: #2A2A2A;
}

.ai-suggestions {
  display: flex;
  align-items: center;
  gap: 24px;
  padding-top: 4px;
}

.ai-sug-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--nc-ink-faint, #52525B);
  flex-shrink: 0;
}

:root.light .ai-sug-label {
  color: #8A8780;
}

.ai-sug-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-sug {
  padding: 5px 10px;
  background: var(--nc-surface-2, #121216);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 6px;
  font-family: inherit;
  font-size: 11px;
  color: var(--nc-ink-muted, #A1A1AA);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.ai-sug:hover {
  border-color: var(--nc-border-hover, #3F3F46);
  color: var(--nc-ink, #FAFAFA);
}

:root.light .ai-sug {
  background: #F4F2EC;
  border-color: #DDD9CF;
  color: #5A5A5A;
}

:root.light .ai-sug:hover {
  border-color: #C8C4B8;
  color: #1A1A1A;
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
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--nc-ink-faint, #52525B);
}

.templates-sub {
  font-size: 13px;
  color: var(--nc-ink-muted, #A1A1AA);
}

.templates-browse {
  background: none;
  border: none;
  font-family: inherit;
  font-size: 12px;
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
  font-size: 9px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 5px;
  white-space: nowrap;
  pointer-events: none;
}

.tpl-root {
  left: 50%;
  top: 14px;
  transform: translateX(-50%);
  font-size: 10px;
  background: var(--nc-surface-3, #1E1E22);
  border: 1px solid var(--nc-border-hover, #3F3F46);
  color: var(--nc-ink, #FAFAFA);
  padding: 5px 12px;
  border-radius: 6px;
}

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
  transform: translateX(-50%);
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
  font-size: 14px;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
}

.tpl-receipt {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--nc-ink-faint, #52525B);
}

.tpl-desc {
  font-size: 12px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 80px 32px;
  border-top: 1px solid var(--nc-border, #1E1E22);
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
  font-size: 13px;
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
  font-size: 12px;
  color: var(--nc-ink-muted, #A1A1AA);
}

.foot-tip-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
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
    gap: 24px;
  }
  .templates-grid {
    grid-template-columns: 1fr;
  }
  .ai-suggestions {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .picker-foot {
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px 20px;
  }
  .foot-tip {
    font-size: 11px;
  }
}
</style>
