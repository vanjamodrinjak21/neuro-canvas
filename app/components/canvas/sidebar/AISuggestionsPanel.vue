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
        <span class="ai-panel__header-title">{{ $t('canvas.ai_suggestions.title') }}</span>
        <span class="ai-panel__header-context">
          {{ selectedNode ? $t('canvas.ai_suggestions.based_on_node', { name: selectedNode.content }) : $t('canvas.ai_suggestions.select_node_first') }}
        </span>
      </div>
      <button
        v-if="selectedNode"
        class="ai-panel__refresh-btn"
        @click="dispatch({ type: 'ai:smart-expand' })"
      >
        <span class="i-lucide-refresh-cw ai-panel__refresh-icon" />
        <span>{{ $t('canvas.ai_suggestions.refresh') }}</span>
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
            <span class="i-lucide-plus text-sm text-nc-accent" />
          </button>
        </div>
      </template>

      <!-- Empty state -->
      <template v-else>
        <div class="ai-panel__empty">
          <span class="i-nc-ai-mark ai-panel__empty-icon" />
          <p class="ai-panel__empty-text">
            {{ selectedNode ? $t('canvas.ai_suggestions.no_suggestions') : $t('canvas.ai_suggestions.select_node_first') }}
          </p>
          <button
            v-if="selectedNode"
            class="ai-panel__generate-btn"
            @click="dispatch({ type: 'ai:smart-expand' })"
          >
            <span class="i-nc-ai-mark" />
            {{ $t('canvas.ai_suggestions.generate_ideas') }}
          </button>
          <button
            v-if="!selectedNode"
            class="ai-panel__generate-btn"
            @click="dispatch({ type: 'ai:generate-map' })"
          >
            <span class="i-nc-ai-mark" />
            {{ $t('canvas.ai_suggestions.generate_map_from_topic') }}
          </button>
        </div>
      </template>

      <!-- Node description sub-section -->
      <div v-if="selectedNode" class="ai-panel__description">
        <div class="ai-panel__description-divider" />
        <div class="ai-panel__description-label">{{ $t('canvas.ai_suggestions.ai_description') }}</div>
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
          <p class="ai-panel__empty-text text-xs mb-2">{{ $t('canvas.ai_suggestions.no_description') }}</p>
          <button
            class="ai-panel__generate-btn ai-panel__generate-btn--small"
            @click="dispatch({ type: 'ai:generate-description' })"
          >
            <span class="i-lucide-pen-line" />
            {{ $t('canvas.ai_suggestions.generate_description') }}
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
        class="ai-panel__footer-btn ai-panel__footer-btn--neutral"
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
  border-bottom: 1px solid var(--nc-border);
  flex-shrink: 0;
}

.ai-panel__header-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
}

.ai-panel__header-title {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
}

.ai-panel__header-context {
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.ai-panel__refresh-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(var(--nc-accent-rgb), 0.1);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: background 150ms var(--nc-ease),
              border-color 150ms var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-accent-text);
}

.ai-panel__refresh-btn:hover {
  background: rgba(var(--nc-accent-rgb), 0.15);
  border-color: rgba(var(--nc-accent-rgb), 0.3);
}

.ai-panel__refresh-btn:active {
  transform: scale(0.97);
}

.ai-panel__refresh-icon {
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  color: var(--nc-ink);
  cursor: pointer;
  transition: background 200ms var(--nc-ease), border-color 200ms var(--nc-ease);
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
  font-size: calc(24px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
}

.ai-panel__empty-text {
  color: var(--nc-text-muted);
  font-size: calc(12px * var(--nc-text-scale, 1));
  margin-bottom: 4px;
}

.ai-panel__generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(var(--nc-accent-rgb), 0.08);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.15);
  border-radius: 0.5rem;
  color: var(--nc-accent-text);
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms var(--nc-ease),
              border-color 150ms var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.ai-panel__generate-btn:hover {
  background: rgba(var(--nc-accent-rgb), 0.12);
  border-color: rgba(var(--nc-accent-rgb), 0.25);
}

.ai-panel__generate-btn:active {
  transform: scale(0.97);
}

.ai-panel__generate-btn--small {
  padding: 6px 12px;
  font-size: calc(11px * var(--nc-text-scale, 1));
}

.ai-panel__generate-btn--small span {
  font-size: calc(11px * var(--nc-text-scale, 1));
}

/* Description sub-section */
.ai-panel__description {
  margin-top: 12px;
}

.ai-panel__description-divider {
  height: 1px;
  background: var(--nc-border-subtle);
  margin-bottom: 12px;
}

/* Sub-section header — mono uppercase micro-label (REDESIGN.md §4) */
.ai-panel__description-label {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  margin-bottom: 6px;
}

.ai-panel__description-text {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
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
  font-size: calc(10px * var(--nc-text-scale, 1));
  padding: 1px 6px;
  /* Tokenised so the chip flips with the theme — was a hardcoded dark fill
     that rendered as dark chips on the light (warm paper) background. */
  background: var(--nc-surface-3);
  border-radius: 3px;
  color: var(--nc-text-secondary);
  font-weight: 500;
}

/* Footer */
.ai-panel__footer {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--nc-border);
  flex-shrink: 0;
}

.ai-panel__footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 0.5rem;
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
  transition: color 150ms var(--nc-ease),
              background 150ms var(--nc-ease),
              border-color 150ms var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.ai-panel__footer-btn:active {
  transform: scale(0.97);
}

.ai-panel__footer-btn span:first-child {
  font-size: calc(12px * var(--nc-text-scale, 1));
}

.ai-panel__footer-btn--teal {
  background: rgba(var(--nc-accent-rgb), 0.08);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.15);
  color: var(--nc-accent-text);
}

.ai-panel__footer-btn--teal:hover {
  background: rgba(var(--nc-accent-rgb), 0.12);
  border-color: rgba(var(--nc-accent-rgb), 0.25);
}

/* Neutral chip — no second interactive hue (REDESIGN.md §1) */
.ai-panel__footer-btn--neutral {
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  color: var(--nc-text-secondary);
}

.ai-panel__footer-btn--neutral:hover {
  background: var(--nc-surface-3);
  color: var(--nc-text);
}
</style>
