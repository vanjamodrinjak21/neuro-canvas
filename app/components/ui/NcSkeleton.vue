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

// Dynamic sizing flows through v-bind() custom properties in the scoped
// style block — no inline :style (REDESIGN.md §9).
const widthCss = computed(() =>
  typeof props.width === 'number' ? `${props.width}px` : (props.width || '100%')
)

const heightCss = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : (props.height || 'auto')
)

const baseClass = computed(() => [
  'nc-skeleton',
  props.animate && 'nc-skeleton--animate'
])

const variantClass = computed(() => {
  switch (props.variant) {
    case 'circular':
      return 'rounded-full aspect-square'
    case 'rectangular':
      return 'rounded-nc-md'
    case 'card':
      return 'rounded-nc-md'
    case 'text':
    default:
      return 'rounded-nc-sm h-4'
  }
})
</script>

<template>
  <!-- Multiple lines for text variant — last line is shortened to 75% -->
  <div v-if="variant === 'text' && lines > 1" class="space-y-2">
    <div
      v-for="i in lines"
      :key="i"
      :class="[
        baseClass,
        variantClass,
        i === lines ? 'nc-skeleton--last' : 'nc-skeleton--w',
        height !== undefined && 'nc-skeleton--h'
      ]"
    />
  </div>

  <!-- Single skeleton element -->
  <div
    v-else
    :class="[
      baseClass,
      variantClass,
      width !== undefined && 'nc-skeleton--w',
      height !== undefined && 'nc-skeleton--h'
    ]"
  />
</template>

<style scoped>
/* Shimmer rides the surface tones — no blue-gray (REDESIGN.md §1) */
.nc-skeleton {
  background: var(--nc-surface-2);
}

.nc-skeleton--animate {
  background: linear-gradient(
    90deg,
    var(--nc-surface-2) 0%,
    var(--nc-surface-3) 50%,
    var(--nc-surface-2) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}

.nc-skeleton--w {
  width: v-bind(widthCss);
}

.nc-skeleton--h {
  height: v-bind(heightCss);
}

.nc-skeleton--last {
  width: 75%;
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
