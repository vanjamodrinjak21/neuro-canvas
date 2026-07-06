<script setup lang="ts">
import {
  SliderRoot,
  SliderTrack,
  SliderRange,
  SliderThumb
} from 'radix-vue'

export interface NcSliderProps {
  modelValue?: number[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  orientation?: 'horizontal' | 'vertical'
  showValue?: boolean
}

const props = withDefaults(defineProps<NcSliderProps>(), {
  modelValue: () => [50],
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  orientation: 'horizontal',
  showValue: false
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const internalValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <div class="flex items-center gap-3">
    <SliderRoot
      v-model="internalValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :orientation="orientation"
      :class="[
        'relative flex items-center select-none touch-none',
        orientation === 'horizontal' ? 'w-full h-5' : 'flex-col w-5 h-full',
        disabled && 'opacity-45 cursor-not-allowed'
      ]"
    >
      <!-- Hairline track, accent fill — no glow (REDESIGN.md §5) -->
      <SliderTrack
        :class="[
          'relative grow rounded-full bg-nc-chip border border-nc-border',
          orientation === 'horizontal' ? 'h-2' : 'w-2'
        ]"
      >
        <SliderRange
          class="absolute rounded-full bg-nc-accent"
          :class="orientation === 'horizontal' ? 'h-full' : 'w-full'"
        />
      </SliderTrack>

      <!-- Ink thumb with press feedback -->
      <SliderThumb
        v-for="(_, index) in modelValue"
        :key="index"
        :class="[
          'block w-5 h-5 rounded-full bg-nc-ink border border-nc-border',
          'nc-anim',
          disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing active:scale-97'
        ]"
      />
    </SliderRoot>

    <span
      v-if="showValue"
      class="min-w-[3ch] text-sm text-nc-ink-muted text-right tabular-nums font-sans"
    >
      {{ modelValue[0] }}
    </span>
  </div>
</template>
