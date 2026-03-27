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
const isFocused = ref(false)

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-5 py-3 text-lg'
}

const inputClass = computed(() => [
  // Base
  'w-full rounded-nc-md',
  'bg-nc-graphite',
  'border transition-all duration-200',
  'text-nc-ink placeholder-nc-ink-muted',
  'font-sans',
  'focus:outline-none',

  // Size
  sizeClasses[props.size],

  // Border states
  props.error
    ? 'border-nc-error/50 focus:border-nc-error focus:ring-2 focus:ring-nc-error/20'
    : 'border-nc-pencil focus:border-nc-teal focus:ring-2 focus:ring-nc-teal/20',

  // Focus glow
  isFocused.value && !props.error && 'shadow-[0_0_0_3px_rgba(0,210,190,0.1)]',

  // Disabled
  props.disabled && 'opacity-40 grayscale-[0.3] cursor-not-allowed bg-nc-pencil'
])

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleFocus(event: FocusEvent) {
  isFocused.value = true
  emit('focus', event)
}

function handleBlur(event: FocusEvent) {
  isFocused.value = false
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

    <!-- Error message -->
    <p v-if="error" class="mt-1.5 text-sm text-nc-error font-sans">
      {{ error }}
    </p>
  </div>
</template>
