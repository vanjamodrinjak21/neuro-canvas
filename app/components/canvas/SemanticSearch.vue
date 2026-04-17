<script setup lang="ts">
import type { SemanticSearchResult } from '~/types/semantic'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  'navigate-to-node': [nodeId: string]
  search: [query: string]
}>()

const query = ref('')
const results = ref<SemanticSearchResult[]>([])
const isSearching = ref(false)
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

// Debounced search
let searchTimer: ReturnType<typeof setTimeout> | null = null
const SEARCH_DEBOUNCE = 300

watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      inputRef.value?.focus()
    })
    query.value = ''
    results.value = []
    selectedIndex.value = 0
  }
})

watch(query, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!val.trim()) {
    results.value = []
    return
  }
  searchTimer = setTimeout(() => {
    emit('search', val)
  }, SEARCH_DEBOUNCE)
})

function setResults(newResults: SemanticSearchResult[]) {
  results.value = newResults
  selectedIndex.value = 0
  isSearching.value = false
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter' && results.value.length > 0) {
    e.preventDefault()
    const selected = results.value[selectedIndex.value]
    if (selected) {
      emit('navigate-to-node', selected.nodeId)
      emit('close')
    }
  }
}

function selectResult(result: SemanticSearchResult) {
  emit('navigate-to-node', result.nodeId)
  emit('close')
}

function matchTypeBadge(type: SemanticSearchResult['matchType']) {
  switch (type) {
    case 'exact': return { label: 'Text', class: 'nc-badge-exact' }
    case 'semantic': return { label: 'Semantic', class: 'nc-badge-semantic' }
    case 'hybrid': return { label: 'Both', class: 'nc-badge-hybrid' }
  }
}

// Expose setResults so parent can call it
defineExpose({ setResults, setSearching: (v: boolean) => { isSearching.value = v } })
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="nc-search-enter"
      leave-active-class="nc-search-leave"
      enter-from-class="opacity-0 scale-97"
      leave-to-class="opacity-0 scale-97"
    >
      <div
        v-if="visible"
        class="nc-search-overlay"
        @click.self="emit('close')"
        @keydown="handleKeyDown"
      >
        <div class="nc-search-palette">
          <!-- Search input -->
          <div class="nc-search-input-wrapper">
            <span class="i-lucide-search nc-search-icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="nc-search-input"
              placeholder="Search nodes..."
              autocomplete="off"
              spellcheck="false"
            >
            <kbd class="nc-search-kbd">Esc</kbd>
          </div>

          <!-- Results -->
          <div v-if="results.length > 0" class="nc-search-results">
            <button
              v-for="(result, index) in results"
              :key="result.nodeId"
              :class="['nc-search-result', index === selectedIndex && 'selected']"
              @click="selectResult(result)"
              @mouseenter="selectedIndex = index"
            >
              <div class="nc-result-content">
                <span class="nc-result-text">{{ result.content }}</span>
                <span class="nc-result-similarity">{{ Math.round(result.similarity * 100) }}%</span>
              </div>
              <span :class="['nc-result-badge', matchTypeBadge(result.matchType).class]">
                {{ matchTypeBadge(result.matchType).label }}
              </span>
            </button>
          </div>

          <!-- Empty state -->
          <div v-else-if="query.trim() && !isSearching" class="nc-search-empty">
            No matching nodes found
          </div>

          <!-- Loading -->
          <div v-else-if="isSearching" class="nc-search-empty">
            <span class="nc-search-spinner" />
            Searching...
          </div>

          <!-- Hint -->
          <div v-else class="nc-search-hint">
            Type to search by text or meaning
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nc-search-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.nc-search-palette {
  width: 100%;
  max-width: 520px;
  background: var(--nc-glass-bg-elevated, rgba(28, 28, 32, 0.95));
  backdrop-filter: blur(20px);
  border: 1px solid var(--nc-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05);
}

.nc-search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--nc-border, rgba(255, 255, 255, 0.06));
  gap: 10px;
}

.nc-search-icon {
  color: var(--nc-ink-soft, rgba(255, 255, 255, 0.4));
  font-size: 16px;
  flex-shrink: 0;
}

.nc-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 15px;
  color: var(--nc-ink, rgba(255, 255, 255, 0.95));
  font-family: inherit;
}

.nc-search-input:focus-visible {
  outline: none;
}

.nc-search-input-wrapper:focus-within {
  border-bottom-color: var(--nc-accent, #00D2BE);
  box-shadow: 0 1px 0 0 var(--nc-accent, #00D2BE);
}

.nc-search-input::placeholder {
  color: var(--nc-ink-soft, rgba(255, 255, 255, 0.35));
}

.nc-search-kbd {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--nc-ink-soft, rgba(255, 255, 255, 0.35));
  font-family: inherit;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.nc-search-results {
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
}

.nc-search-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
  background: transparent;
  border: none;
  text-align: left;
  color: var(--nc-ink, rgba(255, 255, 255, 0.9));
  font-family: inherit;
  font-size: 13px;
}

.nc-search-result:hover,
.nc-search-result.selected {
  background: rgba(255, 255, 255, 0.08);
}

.nc-result-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.nc-result-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.nc-result-similarity {
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-accent, #00D2BE);
  flex-shrink: 0;
}

.nc-result-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
  margin-left: 8px;
}

.nc-badge-exact {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}

.nc-badge-semantic {
  background: rgba(0, 210, 190, 0.15);
  color: var(--nc-accent, #00D2BE);
}

.nc-badge-hybrid {
  background: rgba(0, 210, 190, 0.2);
  color: var(--nc-accent, #00D2BE);
}

.nc-search-empty,
.nc-search-hint {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--nc-ink-soft, rgba(255, 255, 255, 0.35));
}

.nc-search-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1.5px solid transparent;
  border-top-color: var(--nc-accent, #00D2BE);
  border-radius: 50%;
  animation: nc-search-spin 0.6s linear infinite;
  margin-right: 6px;
  vertical-align: middle;
}

@keyframes nc-search-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .nc-search-spinner {
    animation: none;
    border-color: var(--nc-accent, #00D2BE);
  }
}

/* Search panel: 150ms ease-out enter, 80ms exit */
.nc-search-enter {
  transition: opacity 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              transform 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}

.nc-search-leave {
  transition: opacity 80ms cubic-bezier(0.4, 0, 1, 1),
              transform 80ms cubic-bezier(0.4, 0, 1, 1);
}

.scale-97 {
  transform: scale(0.97);
}
</style>
