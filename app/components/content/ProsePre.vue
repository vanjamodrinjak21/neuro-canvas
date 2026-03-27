<script setup lang="ts">
import { ref, useSlots } from 'vue'

defineProps<{
  code?: string
  language?: string
  filename?: string
  highlights?: number[]
}>()

const copied = ref(false)
const slots = useSlots()

function extractText(vnodes: unknown): string {
  if (!vnodes) return ''
  if (typeof vnodes === 'string') return vnodes
  if (Array.isArray(vnodes)) return vnodes.map(extractText).join('')
  if (typeof vnodes === 'object' && vnodes !== null) {
    const node = vnodes as { children?: unknown; text?: string }
    if (node.children) return extractText(node.children)
    if (node.text) return node.text
  }
  return ''
}

async function copyCode() {
  const slotContent = slots.default?.()
  const text = slotContent ? extractText(slotContent) : ''

  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Clipboard API unavailable
  }
}
</script>

<template>
  <div class="code-block">
    <div v-if="filename" class="code-header">
      <span class="code-filename">{{ filename }}</span>
      <button class="code-copy" :title="copied ? 'Copied!' : 'Copy code'" @click="copyCode">
        <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
    <div v-else class="code-header code-header-minimal">
      <span />
      <button class="code-copy" :title="copied ? 'Copied!' : 'Copy code'" @click="copyCode">
        <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
    <pre class="code-body"><slot /></pre>
  </div>
</template>

<style scoped>
.code-block {
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  overflow: hidden;
  margin: 16px 0 24px;
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--nc-surface);
  border-bottom: 1px solid var(--nc-border);
}

.code-header-minimal {
  border-bottom: 1px solid var(--nc-border);
}

.code-filename {
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: 12px;
  color: var(--nc-text-muted);
  font-weight: 500;
  user-select: none;
}

.code-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--nc-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.code-copy:hover {
  background: var(--nc-surface-3);
  color: var(--nc-text-secondary);
}

.code-body {
  padding: 16px 20px;
  background: var(--nc-surface-elevated);
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
  margin: 0;
  color: var(--nc-text);
}

.code-body::-webkit-scrollbar {
  height: 6px;
}

.code-body::-webkit-scrollbar-track {
  background: transparent;
}

.code-body::-webkit-scrollbar-thumb {
  background: var(--nc-border-active);
  border-radius: 3px;
}

.code-body::-webkit-scrollbar-thumb:hover {
  background: var(--nc-text-muted);
}

:root.light .code-body::-webkit-scrollbar-thumb {
  background: var(--nc-border-active);
}

:root.light .code-body::-webkit-scrollbar-thumb:hover {
  background: var(--nc-text-muted);
}
</style>
