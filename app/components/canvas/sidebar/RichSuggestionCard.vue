<script setup lang="ts">
import type { RichNodeSuggestion } from '~/types'
import { getCategoryColor, getRelationshipBgColor } from '~/composables/useSidebarState'
import { getRelationshipLabel, getCategoryIcon } from '~/utils/ai-prompts'

/**
 * RichSuggestionCard — Individual AI suggestion card
 * Replaces dashed-border cards with polished solid cards + accent bar
 */
const props = defineProps<{
  suggestion: RichNodeSuggestion
  index?: number
}>()

const emit = defineEmits<{
  add: [suggestion: RichNodeSuggestion]
}>()

const catColor = computed(() => getCategoryColor(props.suggestion.category))
const relBgColor = computed(() =>
  props.suggestion.relationshipToParent
    ? getRelationshipBgColor(props.suggestion.relationshipToParent)
    : null
)

// Stagger animation delay
const animDelay = computed(() => `${(props.index || 0) * 60}ms`)
</script>

<template>
  <button
    class="suggestion-card"
    :style="{
      '--accent': catColor,
      '--anim-delay': animDelay,
    }"
    @click="emit('add', suggestion)"
  >
    <!-- Left accent bar -->
    <span class="suggestion-card__accent" />

    <!-- Content -->
    <div class="suggestion-card__body">
      <!-- Header: icon, title, relationship badge -->
      <div class="suggestion-card__header">
        <span
          :class="[getCategoryIcon(suggestion.category), 'suggestion-card__cat-icon']"
        />
        <span class="suggestion-card__title">{{ suggestion.title }}</span>
        <span
          v-if="suggestion.relationshipToParent"
          class="suggestion-card__badge"
          :style="{ backgroundColor: relBgColor }"
        >
          {{ getRelationshipLabel(suggestion.relationshipToParent) }}
        </span>
      </div>

      <!-- Summary -->
      <p v-if="suggestion.description?.summary" class="suggestion-card__summary">
        {{ suggestion.description.summary }}
      </p>

      <!-- Keywords -->
      <div v-if="suggestion.description?.keywords?.length" class="suggestion-card__keywords">
        <span
          v-for="keyword in suggestion.description.keywords.slice(0, 4)"
          :key="keyword"
          class="suggestion-card__keyword"
        >
          {{ keyword }}
        </span>
      </div>
    </div>

    <!-- Add icon -->
    <span class="suggestion-card__add">
      <span class="i-lucide-plus" />
    </span>
  </button>
</template>

<style scoped>
.suggestion-card {
  width: 100%;
  display: flex;
  gap: 0;
  padding: 0;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: 10px;
  color: var(--nc-ink);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  text-align: left;
  overflow: hidden;
  opacity: 0;
  transform: translateY(6px);
  animation: card-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--anim-delay);
}

@keyframes card-appear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.suggestion-card:hover {
  border-color: var(--accent);
  background: var(--nc-surface-3);
  transform: translateY(-1px);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(0, 210, 190, 0.08);
}

/* Left accent bar */
.suggestion-card__accent {
  width: 3px;
  flex-shrink: 0;
  background: var(--accent);
  border-radius: 3px 0 0 3px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.suggestion-card:hover .suggestion-card__accent {
  opacity: 1;
}

/* Body */
.suggestion-card__body {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Header */
.suggestion-card__header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.suggestion-card__cat-icon {
  font-size: 13px;
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 1px;
}

.suggestion-card__title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 550;
  color: var(--nc-ink);
  line-height: 1.35;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.suggestion-card__badge {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--nc-ink-soft);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Summary */
.suggestion-card__summary {
  font-size: 11px;
  color: var(--nc-ink-soft);
  line-height: 1.45;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Keywords */
.suggestion-card__keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.suggestion-card__keyword {
  font-size: 9px;
  padding: 2px 7px;
  background: var(--nc-surface-3);
  border-radius: 4px;
  color: var(--nc-ink-muted);
  font-weight: 500;
}

/* Add button */
.suggestion-card__add {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--nc-accent);
  color: var(--nc-bg);
  font-size: 12px;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.suggestion-card:hover .suggestion-card__add {
  opacity: 1;
  transform: scale(1);
}
</style>
