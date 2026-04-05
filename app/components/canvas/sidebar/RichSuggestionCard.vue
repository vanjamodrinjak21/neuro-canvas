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
const firstLetter = computed(() => props.suggestion.title.charAt(0).toUpperCase())

// Stagger animation delay
const animDelay = computed(() => `${(props.index || 0) * 60}ms`)
</script>

<template>
  <div
    class="suggestion-card"
    :style="{
      '--accent': catColor,
      '--anim-delay': animDelay,
    }"
  >
    <!-- Left accent bar -->
    <span class="suggestion-card__accent" />

    <!-- Content -->
    <div class="suggestion-card__body">
      <!-- Letter avatar -->
      <div class="suggestion-card__avatar" :style="{ background: `${catColor}1A` }">
        <span :style="{ color: catColor }">{{ firstLetter }}</span>
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
.suggestion-card {
  display: flex;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
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
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* Left accent bar */
.suggestion-card__accent {
  width: 3px;
  flex-shrink: 0;
  background: var(--accent);
  opacity: 0.6;
  transition: opacity 0.2s ease;
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #E4E4E7;
  line-height: 1.35;
}

.suggestion-card__summary {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  color: #52525B;
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  padding: 1px 6px;
  background: #18181B;
  border-radius: 3px;
  color: #3F3F46;
  font-weight: 500;
}

/* Add button */
.suggestion-card__add {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.15);
  border-radius: 6px;
  color: #00D2BE;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  align-self: flex-start;
}

.suggestion-card__add:hover {
  background: rgba(0, 210, 190, 0.15);
  border-color: rgba(0, 210, 190, 0.3);
  transform: scale(1.05);
}

/* Light theme */
:root.light .suggestion-card {
  background: #FAFAFA;
  border-color: #E4E4E7;
}

:root.light .suggestion-card:hover {
  border-color: var(--accent);
}

:root.light .suggestion-card__title {
  color: #18181B;
}

:root.light .suggestion-card__summary {
  color: #71717A;
}

:root.light .suggestion-card__keyword {
  background: #F4F4F5;
  color: #71717A;
}
</style>
