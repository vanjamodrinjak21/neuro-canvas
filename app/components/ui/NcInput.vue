<script setup lang="ts">
export interface NcInputProps {
  modelValue?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'url' | 'tel'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  error?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<NcInputProps>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
  readonly: false,
  error: '',
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'focus': [event: FocusEvent]
  'blur': [event: FocusEvent]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-5 py-3 text-lg'
}

// Input grammar (REDESIGN.md §5): chip fill, 1px hairline, radius 0.5rem.
// Focus = border-color accent ONLY (no ring, no glow). Invalid = coral border.
const inputClass = computed(() => [
  // Base
  'w-full rounded-nc-md',
  'bg-nc-chip',
  'border nc-anim',
  'text-nc-ink placeholder-nc-ink-faint',
  'font-sans',
  'focus:outline-none',

  // Size
  sizeClasses[props.size],

  // Border states — form-control boundary token (WCAG 1.4.11 in light)
  props.error
    ? 'border-nc-coral focus:border-nc-coral'
    : 'border-nc-border-input focus:border-nc-accent',

  // Disabled
  props.disabled && 'opacity-45 cursor-not-allowed'
])

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleFocus(event: FocusEvent) {
  emit('focus', event)
}

function handleBlur(event: FocusEvent) {
  emit('blur', event)
}

function focus() {
  inputRef.value?.focus()
}

function blur() {
  inputRef.value?.blur()
}

defineExpose({ focus, blur, inputRef })
</script>

<template>
  <div class="relative">
    <!-- Optional label — mono micro-label (REDESIGN.md §4/§5) -->
    <label v-if="$slots.label" class="nc-input-label">
      <slot name="label" />
    </label>

    <input
      ref="inputRef"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :class="inputClass"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    >

    <!-- Error message — validation errors are coral (REDESIGN.md §1) -->
    <p v-if="error" class="mt-1.5 text-sm text-nc-coral font-sans">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.nc-input-label {
  display: block;
  margin-bottom: 0.45rem;
  font-family: var(--nc-font-mono);
  font-size: 0.68rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--nc-text-secondary);
}
</style>
