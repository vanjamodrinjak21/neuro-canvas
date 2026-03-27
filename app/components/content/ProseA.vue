<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  href?: string
}>()

const isExternal = computed(() => {
  return !!props.href && (props.href.startsWith('http://') || props.href.startsWith('https://'))
})
</script>

<template>
  <NuxtLink
    :to="href"
    class="prose-link"
    :target="isExternal ? '_blank' : undefined"
    :rel="isExternal ? 'noopener noreferrer' : undefined"
  >
    <slot />
    <span v-if="isExternal" class="external-icon" aria-hidden="true">&#8599;</span>
  </NuxtLink>
</template>

<style scoped>
.prose-link {
  color: var(--nc-accent);
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s ease;
}

.prose-link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.external-icon {
  display: inline-block;
  font-size: 0.8em;
  margin-left: 2px;
  vertical-align: super;
  line-height: 1;
}

:root.light .prose-link {
  color: var(--nc-accent-dark);
}

:root.light .prose-link:hover {
  color: var(--nc-accent);
}
</style>
