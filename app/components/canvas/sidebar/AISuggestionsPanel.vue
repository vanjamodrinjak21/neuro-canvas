<script setup lang="ts">
import type { Node } from '~/types'
import type { AISuggestion, RichNodeSuggestion } from '~/types'
import { SIDEBAR_DISPATCH_KEY } from '~/types/sidebar'

/**
 * AISuggestionsPanel — AI-powered suggestion cards with loading, empty states,
 * and description sub-section. Uses inject(SIDEBAR_DISPATCH_KEY) for all actions.
 */
const props = defineProps<{
  selectedNode: Node | null
  isAILoading?: boolean
  aiSuggestions?: AISuggestion[]
  richSuggestions?: RichNodeSuggestion[]
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const dispatch = inject(SIDEBAR_DISPATCH_KEY)!
</script>

<template>
  <div class="ai-panel">
    <CanvasSidebarSidebarHeader
      icon="i-lucide-sparkles"
      label="AI Suggestions"
      :collapsed="collapsed"
      accent-color="#A78BFA"
      @toggle="emit('toggle')"
    />

    <div :class="['ai-panel__body', collapsed && 'ai-panel__body--collapsed']">
      <!-- Loading state -->
      <template v-if="isAILoading">
        <div class="ai-panel__loading">
          <NcSkeleton class="h-20 rounded-lg" />
          <NcSkeleton class="h-20 rounded-lg" />
          <NcSkeleton class="h-20 rounded-lg" />
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

        <div class="ai-panel__actions">
          <button
            class="ai-panel__action-btn"
            :disabled="!selectedNode"
            @click="dispatch({ type: 'ai:smart-expand' })"
          >
            <span class="i-lucide-refresh-cw text-sm" />
            <span>Generate more</span>
          </button>
          <button
            class="ai-panel__action-btn ai-panel__action-btn--deep"
            :disabled="!selectedNode"
            @click="dispatch({ type: 'ai:deep-expand' })"
            title="Generate multi-level expansion"
          >
            <span class="i-lucide-git-branch text-sm" />
            <span>Deep expand</span>
          </button>
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

        <button
          class="ai-panel__action-btn mt-3"
          :disabled="!selectedNode"
          @click="dispatch({ type: 'ai:smart-expand' })"
        >
          <span class="i-lucide-refresh-cw text-sm" />
          <span>Generate more</span>
        </button>
      </template>

      <!-- Empty state -->
      <template v-else>
        <div class="ai-panel__empty">
          <p class="ai-panel__empty-text">
            {{ selectedNode ? 'No suggestions yet' : 'Select a node first' }}
          </p>
          <div v-if="selectedNode" class="ai-panel__empty-actions">
            <button
              class="ai-panel__action-btn"
              @click="dispatch({ type: 'ai:smart-expand' })"
            >
              <span class="i-lucide-sparkles text-sm" />
              <span>Generate ideas</span>
            </button>
            <button
              class="ai-panel__action-btn ai-panel__action-btn--deep"
              @click="dispatch({ type: 'ai:deep-expand' })"
            >
              <span class="i-lucide-git-branch text-sm" />
              <span>Deep expand</span>
            </button>
          </div>
          <button
            v-if="!selectedNode"
            class="ai-panel__action-btn mt-2"
            @click="dispatch({ type: 'ai:generate-map' })"
          >
            <span class="i-lucide-map text-sm" />
            <span>Generate map from topic</span>
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
            class="ai-panel__action-btn ai-panel__action-btn--small"
            @click="dispatch({ type: 'ai:generate-description' })"
          >
            <span class="i-lucide-wand-2 text-xs" />
            <span>Generate description</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-panel__body {
  padding: 0 14px 14px;
  overflow: hidden;
  max-height: 600px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.ai-panel__body--collapsed {
  max-height: 0;
  padding-bottom: 0;
  opacity: 0;
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
  gap: 10px;
}

/* Actions row */
.ai-panel__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.ai-panel__actions .ai-panel__action-btn {
  flex: 1;
}

/* Action button */
.ai-panel__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid var(--nc-border-active);
  border-radius: 8px;
  color: var(--nc-ink-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ai-panel__action-btn:hover:not(:disabled) {
  border-color: var(--nc-accent);
  color: var(--nc-accent);
}

.ai-panel__action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ai-panel__action-btn--deep {
  border-color: rgba(167, 139, 250, 0.4);
  color: rgba(167, 139, 250, 0.8);
}

.ai-panel__action-btn--deep:hover:not(:disabled) {
  border-color: #A78BFA;
  background: rgba(167, 139, 250, 0.08);
  color: #A78BFA;
}

.ai-panel__action-btn--small {
  padding: 6px 10px;
  font-size: 11px;
}

.ai-panel__action-btn--small span {
  font-size: 11px;
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
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
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
  text-align: center;
  padding: 16px 0;
}

.ai-panel__empty-text {
  color: var(--nc-ink-faint);
  font-size: 12px;
  margin-bottom: 12px;
}

.ai-panel__empty-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Description sub-section */
.ai-panel__description {
  margin-top: 12px;
}

.ai-panel__description-divider {
  height: 1px;
  background: var(--nc-border);
  margin-bottom: 12px;
}

.ai-panel__description-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--nc-ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.ai-panel__description-text {
  font-size: 11px;
  color: var(--nc-ink-soft);
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
  font-size: 9px;
  padding: 2px 7px;
  background: var(--nc-surface-3);
  border-radius: 4px;
  color: var(--nc-ink-muted);
  font-weight: 500;
}
</style>
