<script setup lang="ts">
import type { RichNodeSuggestion } from '~/types'
import { getCategoryColor } from '~/composables/useSidebarState'

/**
 * RichSuggestionCard — Individual AI suggestion card
 * Letter avatar, left accent bar, keyword tags, explicit add button
 */
const props = defineProps<{
  suggestion: RichNodeSuggestion
  index?: number
}>()

const emit = defineEmits<{
  add: [suggestion: RichNodeSuggestion]
}>()

const catColor = computed(() => getCategoryColor(props.suggestion.category))
// 10% alpha tint for the letter avatar (8-digit hex on the category data color)
const catColorTint = computed(() => `${catColor.value}1A`)
const firstLetter = computed(() => props.suggestion.title.charAt(0).toUpperCase())

// Stagger animation delay
const animDelay = computed(() => `${(props.index || 0) * 60}ms`)
</script>

<template>
  <div class="suggestion-card">
    <!-- Left accent bar -->
    <span class="suggestion-card__accent" />

    <!-- Content -->
    <div class="suggestion-card__body">
      <!-- Letter avatar -->
      <div class="suggestion-card__avatar">
        <span class="suggestion-card__avatar-letter">{{ firstLetter }}</span>
      </div>

      <!-- Text content -->
      <div class="suggestion-card__text">
        <span class="suggestion-card__title">{{ suggestion.title }}</span>
        <p v-if="suggestion.description?.summary" class="suggestion-card__summary">
          {{ suggestion.description.summary }}
        </p>
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

      <!-- Add button -->
      <button
        class="suggestion-card__add"
        @click.stop="emit('add', suggestion)"
      >
        <span class="i-lucide-plus" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Category color + stagger delay come in via v-bind (no inline :style) */
.suggestion-card {
  display: flex;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  overflow: hidden;
  transition: border-color 200ms var(--nc-ease);
  opacity: 0;
  transform: translateY(6px);
  animation: card-appear 0.3s var(--nc-ease) forwards;
  animation-delay: v-bind(animDelay);
}

@keyframes card-appear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Interactive card hover = border shift only (REDESIGN.md §5) */
.suggestion-card:hover {
  border-color: v-bind(catColor);
}

/* Left accent bar */
.suggestion-card__accent {
  width: 3px;
  flex-shrink: 0;
  background: v-bind(catColor);
  opacity: 0.6;
  transition: opacity 200ms var(--nc-ease);
}

.suggestion-card:hover .suggestion-card__accent {
  opacity: 1;
}

/* Body */
.suggestion-card__body {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 12px;
  min-width: 0;
}

/* Avatar */
.suggestion-card__avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  flex-shrink: 0;
  background: v-bind(catColorTint);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
}

.suggestion-card__avatar-letter {
  color: v-bind(catColor);
}

/* Text */
.suggestion-card__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.suggestion-card__title {
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
  line-height: 1.35;
}

.suggestion-card__summary {
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  line-height: 1.4;
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
  padding-top: 2px;
}

.suggestion-card__keyword {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  padding: 1px 6px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  border-radius: 3px;
  color: var(--nc-text-muted);
  font-weight: 500;
}

/* Add button */
.suggestion-card__add {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--nc-accent-rgb), 0.08);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.15);
  border-radius: 6px;
  color: var(--nc-accent-text);
  font-size: calc(12px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: background 150ms var(--nc-ease),
              border-color 150ms var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
  flex-shrink: 0;
  align-self: flex-start;
}

@media (hover: hover) and (pointer: fine) {
  .suggestion-card__add:hover {
    background: rgba(var(--nc-accent-rgb), 0.15);
    border-color: rgba(var(--nc-accent-rgb), 0.3);
  }
}

.suggestion-card__add:active {
  transform: scale(0.97);
}
</style>
