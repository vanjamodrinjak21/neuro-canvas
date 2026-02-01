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
        disabled && 'opacity-50 cursor-not-allowed'
      ]"
    >
      <SliderTrack
        :class="[
          'relative grow rounded-full bg-nc-pencil',
          orientation === 'horizontal' ? 'h-1.5' : 'w-1.5'
        ]"
      >
        <SliderRange
          class="absolute rounded-full bg-nc-teal"
          :class="orientation === 'horizontal' ? 'h-full' : 'w-full'"
        />
      </SliderTrack>

      <SliderThumb
        v-for="(_, index) in modelValue"
        :key="index"
        :class="[
          'block w-4 h-4 rounded-full bg-nc-teal shadow-nc-md',
          'border-2 border-nc-charcoal',
          'focus:outline-none focus:ring-2 focus:ring-nc-teal/30 focus:ring-offset-2 focus:ring-offset-nc-charcoal',
          'transition-all duration-200',
          'hover:bg-nc-teal-dark hover:shadow-nc-glow',
          disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
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
