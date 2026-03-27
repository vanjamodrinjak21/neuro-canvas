<script setup lang="ts">
export interface NcSkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  lines?: number
  animate?: boolean
}

const props = withDefaults(defineProps<NcSkeletonProps>(), {
  variant: 'text',
  animate: true,
  lines: 1
})

const baseClass = computed(() => [
  'nc-skeleton rounded-nc-md',
  props.animate && 'animate-pulse'
])

const styleObject = computed(() => {
  const style: Record<string, string> = {}

  if (props.width) {
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }

  if (props.height) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  return style
})

const variantClass = computed(() => {
  switch (props.variant) {
    case 'circular':
      return 'rounded-full aspect-square'
    case 'rectangular':
      return 'rounded-nc-md'
    case 'card':
      return 'rounded-nc-xl'
    case 'text':
    default:
      return 'rounded-nc-sm h-4'
  }
})
</script>

<template>
  <!-- Multiple lines for text variant -->
  <div v-if="variant === 'text' && lines > 1" class="space-y-2">
    <div
      v-for="i in lines"
      :key="i"
      :class="[baseClass, variantClass]"
      :style="{
        ...styleObject,
        width: i === lines ? '75%' : styleObject.width || '100%'
      }"
    />
  </div>

  <!-- Single skeleton element -->
  <div
    v-else
    :class="[baseClass, variantClass]"
    :style="styleObject"
  />
</template>

<style scoped>
.nc-skeleton {
  background: linear-gradient(
    90deg,
    #1A1A1E 0%,
    #2E2E34 50%,
    #1A1A1E 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
