<script setup lang="ts">
/**
 * Mobile Templates (Dark) — implementation of Paper artboards
 * G7R-0 (iOS) and GPV-0 (Android).
 */
import type { Template, TemplateCategory } from '~/types'

interface UserLike {
  name?: string | null
  email?: string | null
  image?: string | null
}

type Filter = 'all' | TemplateCategory

const props = defineProps<{
  user: UserLike | null | undefined
  userInitials: string
  templates: Template[]
  totalCount: number
  searchQuery: string
  sortLabel?: string
  activeCategory?: Filter
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'open-template': [slug: string]
  'use-template': [tmpl: Template]
  'change-sort': []
  'change-category': [c: Filter]
}>()

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'education', label: 'Education' },
  { id: 'business', label: 'Business' },
  { id: 'creative', label: 'Creative' },
  { id: 'planning', label: 'Planning' },
  { id: 'research', label: 'Research' },
]

const active = computed<Filter>(() => props.activeCategory ?? 'all')

function setFilter(c: Filter) { emit('change-category', c) }

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function categoryLabel(c: TemplateCategory): string {
  switch (c) {
    case 'education': return 'EDUCATION'
    case 'business': return 'BUSINESS'
    case 'creative': return 'CREATIVE'
    case 'planning': return 'PLANNING'
    case 'research': return 'RESEARCH'
    default: return ''
  }
}
</script>

<template>
  <section class="mtpl" aria-label="Templates">
    <!-- Top bar -->
    <header class="mtpl-top">
      <div class="mtpl-mark">
        <div class="mtpl-mark-dot" />
      </div>
      <div class="mtpl-top-right">
        <div class="mtpl-live">
          <span class="mtpl-live-dot" />
          <span class="mtpl-live-label">SYNCED</span>
        </div>
        <NuxtLink to="/settings" class="mtpl-avatar" aria-label="Settings">
          <img v-if="user?.image" :src="user.image" :alt="user.name || ''" class="mtpl-avatar-img">
          <span v-else>{{ userInitials }}</span>
        </NuxtLink>
      </div>
    </header>

    <!-- Editorial hero -->
    <div class="mtpl-hero">
      <span class="mtpl-eyebrow">03 — TEMPLATES</span>
      <h1 class="mtpl-hero-line">
        <span class="mtpl-hero-sans">Start with a</span>
        <span class="mtpl-hero-serif">shape.</span>
      </h1>
      <span class="mtpl-hero-meta">
        {{ totalCount }} templates · curated by the team · all editable.
      </span>
    </div>

    <!-- Search row -->
    <div class="mtpl-search-row">
      <label class="mtpl-search-input">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="#52525B" stroke-width="1.4" />
          <path d="M14 14L11 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <input
          :value="searchQuery"
          type="text"
          placeholder="Search templates · ⌘ K"
          class="mtpl-search-field"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <button type="button" class="mtpl-sort-btn" :aria-label="'Sort: ' + (sortLabel || 'popular')" @click="emit('change-sort')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 4H13M5 8H11M7 12H9" stroke="#A1A1AA" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- Filter pills -->
    <div class="mtpl-pills">
      <button
        v-for="f in FILTERS"
        :key="f.id"
        type="button"
        class="mtpl-pill"
        :class="{ 'mtpl-pill--active': active === f.id }"
        @click="setFilter(f.id)"
      >
        <span>{{ f.label }}</span>
        <span v-if="f.id === 'all'" class="mtpl-pill-count">{{ totalCount }}</span>
      </button>
    </div>

    <!-- Section header -->
    <div class="mtpl-section">
      <div class="mtpl-section-left">
        <span class="mtpl-section-eyebrow">SORTED BY</span>
        <span class="mtpl-section-value">{{ sortLabel || 'popular' }}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 4L5 6.5L7.5 4" stroke="#A1A1AA" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <span class="mtpl-section-count">{{ templates.length }} OF {{ totalCount }}</span>
    </div>

    <!-- Template list -->
    <div class="mtpl-list">
      <article
        v-for="tmpl in templates"
        :key="tmpl.id"
        class="mtpl-card"
        @click="emit('open-template', tmpl.slug)"
      >
        <div class="mtpl-card-thumb">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <line x1="16" y1="6" x2="16" y2="26" stroke="#00D2BE" stroke-width="1.4" />
            <line x1="6" y1="16" x2="26" y2="16" stroke="#00D2BE" stroke-width="1.4" />
            <rect x="9" y="9" width="5" height="5" rx="1" fill="#00D2BE" />
            <rect x="18" y="9" width="5" height="5" rx="1" fill="#A1A1AA" />
            <rect x="9" y="18" width="5" height="5" rx="1" fill="#A1A1AA" />
            <rect x="18" y="18" width="5" height="5" rx="1" fill="#A1A1AA" />
          </svg>
        </div>
        <div class="mtpl-card-body">
          <div class="mtpl-card-titlebar">
            <span class="mtpl-card-title">{{ tmpl.title }}</span>
            <span v-if="tmpl.aiEnhanced" class="mtpl-ai-badge">AI</span>
          </div>
          <p v-if="tmpl.description" class="mtpl-card-desc">{{ tmpl.description }}</p>
          <div class="mtpl-card-meta">
            <span class="mtpl-card-cat">{{ categoryLabel(tmpl.category) }}</span>
            <span class="mtpl-card-meta-dot" />
            <span class="mtpl-card-uses">{{ formatCount(tmpl.usageCount) }} USES</span>
          </div>
        </div>
        <button type="button" class="mtpl-use-btn" @click.stop="emit('use-template', tmpl)">
          <span>Use</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3.5 2L7 5L3.5 8" stroke="#09090B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </article>
      <div v-if="templates.length === 0" class="mtpl-empty">
        <span>No templates match your filter.</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mtpl {
  --mtpl-bg: #09090B;
  --mtpl-ink: #FAFAFA;
  --mtpl-body: #A1A1AA;
  --mtpl-mute: #52525B;
  --mtpl-mint: #00D2BE;
  --mtpl-surface: rgba(250, 250, 250, 0.04);
  --mtpl-stroke: rgba(250, 250, 250, 0.10);
  --mtpl-stroke-soft: rgba(250, 250, 250, 0.06);

  /* Pin: only the list scrolls, dock fixed */
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mtpl-bg);
  color: var(--mtpl-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  z-index: 10;
}

/* Top bar */
.mtpl-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  height: 44px;
  padding: 4px 20px 0 20px;
  box-sizing: border-box;
}
.mtpl-mark {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: var(--mtpl-mint);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mtpl-mark-dot { width: 9px; height: 9px; border-radius: 2px; background: var(--mtpl-bg); }
.mtpl-top-right { display: flex; align-items: center; gap: 10px; }
.mtpl-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.mtpl-live-dot {
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--mtpl-mint);
  animation: mtpl-pulse 2.4s ease-in-out infinite;
}
@keyframes mtpl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.mtpl-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--mtpl-mint);
}
.mtpl-avatar {
  width: 32px; height: 32px;
  border-radius: 999px;
  background: rgba(250, 250, 250, 0.06);
  border: 1px solid var(--mtpl-stroke);
  display: flex; align-items: center; justify-content: center;
  color: var(--mtpl-ink);
  font-weight: 500; font-size: 13px; line-height: 16px;
  text-decoration: none;
  overflow: hidden;
  flex-shrink: 0;
}
.mtpl-avatar-img { width: 100%; height: 100%; object-fit: cover; }

/* Hero */
.mtpl-hero { display: flex; flex-direction: column; padding: 18px 20px 0 20px; box-sizing: border-box; }
.mtpl-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.12em; color: var(--mtpl-mute);
}
.mtpl-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0; font-weight: 500;
}
.mtpl-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 36px; line-height: 38px;
  letter-spacing: -0.025em; color: var(--mtpl-ink);
}
.mtpl-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: 46px; line-height: 38px;
  letter-spacing: -0.02em; color: var(--mtpl-mint);
}
.mtpl-hero-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 400; font-size: 13px; line-height: 20px;
  color: var(--mtpl-body);
  margin-top: 10px;
}

/* Search */
.mtpl-search-row {
  display: flex; align-items: center; gap: 10px;
  padding: 22px 20px 0 20px;
  width: 100%;
  box-sizing: border-box;
}
.mtpl-search-input {
  display: flex; align-items: center; gap: 10px;
  flex: 1 1 0;
  padding: 12px 14px;
  background: var(--mtpl-surface);
  border: 1px solid rgba(250, 250, 250, 0.08);
  border-radius: 14px;
  min-width: 0;
  cursor: text;
}
.mtpl-search-field {
  flex: 1 1 0;
  background: transparent;
  border: none;
  outline: none;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 12px; line-height: 16px;
  letter-spacing: 0.04em;
  color: var(--mtpl-ink);
  caret-color: var(--mtpl-mint);
}
.mtpl-search-field::placeholder { color: var(--mtpl-mute); }
.mtpl-sort-btn {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px;
  border-radius: 14px;
  background: var(--mtpl-surface);
  border: 1px solid rgba(250, 250, 250, 0.08);
  flex-shrink: 0;
  cursor: pointer;
}

/* Pills */
.mtpl-pills {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 20px 0 20px;
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  box-sizing: border-box;
}
.mtpl-pills::-webkit-scrollbar { display: none; }
.mtpl-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid var(--mtpl-stroke);
  flex-shrink: 0;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 12px; line-height: 14px;
  color: var(--mtpl-body);
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.mtpl-pill--active {
  background: var(--mtpl-mint);
  border-color: var(--mtpl-mint);
  color: #09090B;
  font-weight: 600;
}
.mtpl-pill-count {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 12px;
  color: var(--mtpl-mute);
}
.mtpl-pill--active .mtpl-pill-count { color: rgba(9, 9, 11, 0.55); }

/* Section header */
.mtpl-section {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  padding: 22px 20px 12px 20px;
  box-sizing: border-box;
}
.mtpl-section-left { display: flex; align-items: baseline; gap: 8px; }
.mtpl-section-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.12em; color: var(--mtpl-mute);
}
.mtpl-section-value {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 12px; line-height: 14px;
  color: var(--mtpl-ink);
  text-transform: lowercase;
}
.mtpl-section-count {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  color: var(--mtpl-mute);
}

/* Cards */
.mtpl-list {
  display: flex; flex-direction: column; gap: 10px;
  padding: 0 20px calc(env(safe-area-inset-bottom, 0px) + 96px);
  width: 100%;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  box-sizing: border-box;
}
.mtpl-list::-webkit-scrollbar { width: 0; }

.mtpl-card {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px;
  background: var(--mtpl-surface);
  border: 1px solid var(--mtpl-stroke-soft);
  border-radius: 14px;
  cursor: pointer;
  transition: background 120ms ease, transform 120ms ease;
  -webkit-tap-highlight-color: transparent;
}
.mtpl-card:active { transform: scale(0.99); background: rgba(250, 250, 250, 0.06); }

.mtpl-card-thumb {
  width: 48px; height: 48px;
  border-radius: 10px;
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.24);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.mtpl-card-body {
  display: flex; flex-direction: column; gap: 6px;
  flex: 1 1 0; min-width: 0;
}
.mtpl-card-titlebar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mtpl-card-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 15px; line-height: 20px;
  letter-spacing: -0.01em;
  color: var(--mtpl-ink);
}
.mtpl-ai-badge {
  display: inline-flex; align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 210, 190, 0.14);
  border: 1px solid rgba(0, 210, 190, 0.30);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 600; font-size: 9px; line-height: 14px;
  letter-spacing: 0.08em;
  color: var(--mtpl-mint);
}
.mtpl-card-desc {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 400; font-size: 13px; line-height: 18px;
  color: var(--mtpl-body);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mtpl-card-meta { display: flex; align-items: center; gap: 10px; }
.mtpl-card-cat {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 13px;
  letter-spacing: 0.06em;
  color: var(--mtpl-mute);
}
.mtpl-card-meta-dot { width: 2px; height: 2px; border-radius: 999px; background: var(--mtpl-mute); }
.mtpl-card-uses {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 13px;
  letter-spacing: 0.04em;
  color: var(--mtpl-mute);
}

.mtpl-use-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 7px 12px;
  border-radius: 999px;
  background: var(--mtpl-mint);
  border: none;
  flex-shrink: 0;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 12px; line-height: 14px;
  color: #09090B;
}
.mtpl-use-btn:active { transform: scale(0.96); }

.mtpl-empty {
  padding: 24px 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--mtpl-mute);
  text-align: center;
}
</style>
