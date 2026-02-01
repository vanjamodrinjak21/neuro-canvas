<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'radix-vue'

export interface NcSwitchProps {
  modelValue?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<NcSwitchProps>(), {
  modelValue: false,
  disabled: false,
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const checked = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const sizeClasses = {
  sm: {
    root: 'w-8 h-4',
    thumb: 'w-3 h-3 data-[state=checked]:translate-x-4'
  },
  md: {
    root: 'w-10 h-5',
    thumb: 'w-4 h-4 data-[state=checked]:translate-x-5'
  },
  lg: {
    root: 'w-12 h-6',
    thumb: 'w-5 h-5 data-[state=checked]:translate-x-6'
  }
}
</script>

<template>
  <SwitchRoot
    v-model:checked="checked"
    :disabled="disabled"
    :class="[
      'group relative inline-flex shrink-0 cursor-pointer items-center rounded-full',
      'border-2 border-transparent transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nc-teal focus-visible:ring-offset-2 focus-visible:ring-offset-nc-charcoal',
      'data-[state=checked]:bg-nc-teal data-[state=unchecked]:bg-nc-pencil',
      'data-[state=checked]:shadow-nc-glow',
      disabled && 'opacity-50 cursor-not-allowed',
      sizeClasses[size].root
    ]"
  >
    <SwitchThumb
      :class="[
        'pointer-events-none block rounded-full bg-nc-ink shadow-nc-sm ring-0',
        'transition-transform duration-200',
        'data-[state=unchecked]:translate-x-0.5',
        'group-data-[state=checked]:bg-nc-charcoal',
        sizeClasses[size].thumb
      ]"
    />
  </SwitchRoot>
</template>
