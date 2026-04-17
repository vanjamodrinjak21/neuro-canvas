<script setup lang="ts">
import type { Node, AISuggestion, RichNodeSuggestion  } from '~/types'
import { SIDEBAR_DISPATCH_KEY } from '~/types/sidebar'

/**
 * AISuggestionsPanel — AI-powered suggestion cards with header,
 * loading states, and footer actions
 */
const props = defineProps<{
  selectedNode: Node | null
  isAILoading?: boolean
  aiSuggestions?: AISuggestion[]
  richSuggestions?: RichNodeSuggestion[]
}>()

const dispatch = inject(SIDEBAR_DISPATCH_KEY)!
</script>

<template>
  <div class="ai-panel">
    <!-- Header -->
    <div class="ai-panel__header">
      <div class="ai-panel__header-info">
        <span class="ai-panel__header-title">AI Suggestions</span>
        <span class="ai-panel__header-context">
          {{ selectedNode ? `Based on "${selectedNode.content}" node` : 'Select a node first' }}
        </span>
      </div>
      <button
        v-if="selectedNode"
        class="ai-panel__refresh-btn"
        @click="dispatch({ type: 'ai:smart-expand' })"
      >
        <span class="i-lucide-refresh-cw ai-panel__refresh-icon" />
        <span>Refresh</span>
      </button>
    </div>

    <!-- Body -->
    <div class="ai-panel__body">
      <!-- Loading state -->
      <template v-if="isAILoading">
        <div class="ai-panel__loading">
          <NcSkeleton class="h-24 rounded-lg" />
          <NcSkeleton class="h-20 rounded-lg" />
          <NcSkeleton class="h-24 rounded-lg" />
        </div>
      </template>

      <!-- Rich suggestions -->
      <template v-else-if="richSuggestions && richSuggestions.length > 0">
        <div class="ai-panel__cards">
          <CanvasSidebarRichSuggestionCard
            v-for="(suggestion, index) in richSuggestions"
            :key="`rich-${index}`"
            :suggestion="suggestion"
            :index="index"
            @add="dispatch({ type: 'ai:add-rich-suggestion', suggestion: $event })"
          />
        </div>
      </template>

      <!-- Legacy suggestions fallback -->
      <template v-else-if="aiSuggestions && aiSuggestions.length > 0">
        <div class="ai-panel__legacy">
          <button
            v-for="suggestion in aiSuggestions"
            :key="suggestion.id"
            class="ai-panel__legacy-item"
            @click="dispatch({ type: 'ai:add-suggestion', suggestion })"
          >
            <span class="flex-1 text-left text-sm truncate">{{ suggestion.content }}</span>
            <span class="i-lucide-plus text-sm" style="color: var(--nc-accent)" />
          </button>
        </div>
      </template>

      <!-- Empty state -->
      <template v-else>
        <div class="ai-panel__empty">
          <span class="i-lucide-sparkles ai-panel__empty-icon" />
          <p class="ai-panel__empty-text">
            {{ selectedNode ? 'No suggestions yet' : 'Select a node first' }}
          </p>
          <button
            v-if="selectedNode"
            class="ai-panel__generate-btn"
            @click="dispatch({ type: 'ai:smart-expand' })"
          >
            <span class="i-lucide-sparkles" />
            Generate ideas
          </button>
          <button
            v-if="!selectedNode"
            class="ai-panel__generate-btn"
            @click="dispatch({ type: 'ai:generate-map' })"
          >
            <span class="i-lucide-map" />
            Generate map from topic
          </button>
        </div>
      </template>

      <!-- Node description sub-section -->
      <div v-if="selectedNode" class="ai-panel__description">
        <div class="ai-panel__description-divider" />
        <div class="ai-panel__description-label">AI Description</div>
        <template v-if="selectedNode.metadata?.description">
          <p class="ai-panel__description-text">
            {{ (selectedNode.metadata.description as { summary: string }).summary }}
          </p>
          <div
            v-if="(selectedNode.metadata.description as { keywords?: string[] }).keywords?.length"
            class="ai-panel__keywords"
          >
            <span
              v-for="keyword in (selectedNode.metadata.description as { keywords?: string[] }).keywords?.slice(0, 5)"
              :key="keyword"
              class="ai-panel__keyword"
            >
              {{ keyword }}
            </span>
          </div>
        </template>
        <template v-else>
          <p class="ai-panel__empty-text text-xs mb-2">No description generated</p>
          <button
            class="ai-panel__generate-btn ai-panel__generate-btn--small"
            @click="dispatch({ type: 'ai:generate-description' })"
          >
            <span class="i-lucide-wand-2" />
            Generate description
          </button>
        </template>
      </div>
    </div>

    <!-- Footer actions -->
    <div v-if="selectedNode && (richSuggestions?.length || aiSuggestions?.length)" class="ai-panel__footer">
      <button
        class="ai-panel__footer-btn ai-panel__footer-btn--teal"
        @click="dispatch({ type: 'ai:smart-expand' })"
      >
        <span class="i-lucide-refresh-cw" />
        More
      </button>
      <button
        class="ai-panel__footer-btn ai-panel__footer-btn--purple"
        @click="dispatch({ type: 'ai:deep-expand' })"
      >
        <span class="i-lucide-git-branch" />
        Deep expand
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  content-visibility: auto;
  contain-intrinsic-size: auto 400px;
}

/* Header */
.ai-panel__header {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  gap: 10px;
  border-bottom: 1px solid #1A1A1E;
  flex-shrink: 0;
}

.ai-panel__header-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
}

.ai-panel__header-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #FAFAFA;
}

.ai-panel__header-context {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  color: #52525B;
}

.ai-panel__refresh-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #00D2BE;
}

.ai-panel__refresh-btn:hover {
  background: rgba(0, 210, 190, 0.15);
  border-color: rgba(0, 210, 190, 0.3);
}

.ai-panel__refresh-icon {
  font-size: 12px;
}

/* Body */
.ai-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
}

/* Loading */
.ai-panel__loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Cards */
.ai-panel__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Legacy items */
.ai-panel__legacy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-panel__legacy-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  min-height: 40px;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 8px;
  color: var(--nc-ink);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-panel__legacy-item:hover {
  background: var(--nc-accent-glow);
  border-color: var(--nc-accent);
}

/* Empty state */
.ai-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
  gap: 8px;
}

.ai-panel__empty-icon {
  font-size: 24px;
  color: #27272A;
}

.ai-panel__empty-text {
  color: #52525B;
  font-size: 12px;
  margin-bottom: 4px;
}

.ai-panel__generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.15);
  border-radius: 8px;
  color: #00D2BE;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-panel__generate-btn:hover {
  background: rgba(0, 210, 190, 0.12);
  border-color: rgba(0, 210, 190, 0.25);
}

.ai-panel__generate-btn--small {
  padding: 6px 12px;
  font-size: 11px;
}

.ai-panel__generate-btn--small span {
  font-size: 11px;
}

/* Description sub-section */
.ai-panel__description {
  margin-top: 12px;
}

.ai-panel__description-divider {
  height: 1px;
  background: #1A1A1E;
  margin-bottom: 12px;
}

.ai-panel__description-label {
  font-size: 10px;
  font-weight: 600;
  color: #27272A;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.ai-panel__description-text {
  font-size: 11px;
  color: #71717A;
  line-height: 1.5;
  margin: 4px 0 0;
}

/* Keywords */
.ai-panel__keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.ai-panel__keyword {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  padding: 1px 6px;
  background: #18181B;
  border-radius: 3px;
  color: #3F3F46;
  font-weight: 500;
}

/* Footer */
.ai-panel__footer {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid #1A1A1E;
  flex-shrink: 0;
}

.ai-panel__footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-panel__footer-btn span:first-child {
  font-size: 12px;
}

.ai-panel__footer-btn--teal {
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.15);
  color: #00D2BE;
}

.ai-panel__footer-btn--teal:hover {
  background: rgba(0, 210, 190, 0.12);
  border-color: rgba(0, 210, 190, 0.25);
}

.ai-panel__footer-btn--purple {
  background: rgba(167, 139, 250, 0.06);
  border: 1px solid rgba(167, 139, 250, 0.15);
  color: #A78BFA;
}

.ai-panel__footer-btn--purple:hover {
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.25);
}

/* Light theme */
:root.light .ai-panel__header {
  border-bottom-color: #E4E4E7;
}

:root.light .ai-panel__header-title {
  color: #18181B;
}

:root.light .ai-panel__footer {
  border-top-color: #E4E4E7;
}
</style>
