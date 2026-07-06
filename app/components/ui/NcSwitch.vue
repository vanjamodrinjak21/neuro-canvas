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
  <span class="nc-switch-touch" :class="[disabled && 'cursor-not-allowed']">
    <!-- Hairline track, accent fill when on, ink thumb — no glow (REDESIGN.md §5) -->
    <SwitchRoot
      v-model:checked="checked"
      :disabled="disabled"
      :class="[
        'group relative inline-flex shrink-0 cursor-pointer items-center rounded-full',
        'border border-nc-border nc-anim',
        'data-[state=unchecked]:bg-nc-chip',
        'data-[state=checked]:bg-nc-accent data-[state=checked]:border-nc-accent',
        'active:scale-97',
        disabled && 'opacity-45 cursor-not-allowed',
        sizeClasses[size].root
      ]"
    >
      <SwitchThumb
        :class="[
          'pointer-events-none block rounded-full bg-nc-ink',
          'nc-anim',
          'data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:scale-90',
          'data-[state=checked]:scale-100',
          'group-data-[state=checked]:bg-nc-bg',
          sizeClasses[size].thumb
        ]"
      />
    </SwitchRoot>
  </span>
</template>

<style scoped>
/* Ensure 44px touch target on mobile without changing visual size */
.nc-switch-touch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
</style>
