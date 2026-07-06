<script setup lang="ts">
interface NavLink {
  title: string
  path: string
}

interface Props {
  prev?: NavLink | null
  next?: NavLink | null
}

defineProps<Props>()
</script>

<template>
  <div
    v-if="prev || next"
    class="docs-prev-next"
  >
    <div class="docs-prev-next__grid">
      <!-- Previous -->
      <NuxtLink
        v-if="prev"
        :to="prev.path"
        class="docs-prev-next__card docs-prev-next__card--prev"
      >
        <span class="docs-prev-next__label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Previous
        </span>
        <span class="docs-prev-next__title">{{ prev.title }}</span>
      </NuxtLink>
      <div v-else />

      <!-- Next -->
      <NuxtLink
        v-if="next"
        :to="next.path"
        class="docs-prev-next__card docs-prev-next__card--next"
      >
        <span class="docs-prev-next__label">
          Next
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
        <span class="docs-prev-next__title">{{ next.title }}</span>
      </NuxtLink>
      <div v-else />
    </div>
  </div>
</template>

<style scoped>
.docs-prev-next {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--nc-border);
}

.docs-prev-next__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.docs-prev-next__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border: 1px dashed var(--nc-border-active);
  border-radius: 6px;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.docs-prev-next__card:hover {
  border-color: var(--nc-accent);
  border-style: solid;
  background: var(--nc-accent-glow);
  transform: translateY(-2px);
}

.docs-prev-next__card--prev {
  align-items: flex-start;
  text-align: left;
}

.docs-prev-next__card--next {
  align-items: flex-end;
  text-align: right;
}

.docs-prev-next__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  /* Mono micro-label grammar (§4) + interactive-card icon at the 0.62 tier */
  color: var(--nc-text-secondary);
  line-height: 1;
}

.docs-prev-next__label svg {
  color: var(--nc-text-secondary);
  flex-shrink: 0;
}

.docs-prev-next__title {
  font-family: 'Inter', var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-accent);
  line-height: 1.4;
}

/* Responsive */
@media (max-width: 480px) {
  .docs-prev-next__grid {
    grid-template-columns: 1fr;
  }

  .docs-prev-next__card--next {
    align-items: flex-start;
    text-align: left;
  }

  .docs-prev-next__card--next .docs-prev-next__label {
    flex-direction: row;
  }
}

/* Light theme — tokens carry everything except the card title:
   14px accent text needs the text-tier accent (#0b9e93 is 3.18:1). */
:root.light .docs-prev-next__title {
  color: var(--nc-accent-text);
}
</style>
