<script setup lang="ts">
export interface PasswordInputProps {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  size?: 'sm' | 'md' | 'lg'
  autocomplete?: string
}

const props = withDefaults(defineProps<PasswordInputProps>(), {
  modelValue: '',
  placeholder: 'Password',
  disabled: false,
  error: '',
  size: 'md',
  autocomplete: 'current-password'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPassword = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const inputType = computed(() => showPassword.value ? 'text' : 'password')

function toggleVisibility() {
  showPassword.value = !showPassword.value
  // Keep focus on input
  nextTick(() => inputRef.value?.focus())
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const sizeClasses: Record<string, string> = {
  sm: 'py-1.5 text-sm',
  md: 'py-2.5 text-base',
  lg: 'py-3 text-lg'
}
</script>

<template>
  <div class="password-input-wrapper">
    <div class="password-input-container">
      <input
        ref="inputRef"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :class="[
          'password-input',
          sizeClasses[size],
          error ? 'has-error' : ''
        ]"
        @input="handleInput"
      >
      <button
        type="button"
        class="visibility-toggle"
        :disabled="disabled"
        @click="toggleVisibility"
      >
        <span
          :class="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          class="toggle-icon"
        />
      </button>
    </div>
    <p v-if="error" class="error-message">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.password-input-wrapper {
  position: relative;
}

.password-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  width: 100%;
  padding-left: 1rem;
  padding-right: 2.75rem;
  background: rgba(24, 24, 28, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: var(--nc-ink, #FAFAFA);
  font-family: inherit;
  outline: none;
  transition: all 0.2s ease;
}

.password-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.password-input:focus {
  border-color: var(--nc-teal, #00D2BE);
  box-shadow: 0 0 0 3px rgba(0, 210, 190, 0.1);
}

.password-input.has-error {
  border-color: rgba(239, 68, 68, 0.5);
}

.password-input.has-error:focus {
  border-color: #EF4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.password-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visibility-toggle {
  position: absolute;
  right: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: color 0.2s ease;
}

.visibility-toggle:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.7);
}

.visibility-toggle:disabled {
  cursor: not-allowed;
}

.toggle-icon {
  font-size: 1.125rem;
}

.error-message {
  margin: 0.375rem 0 0;
  font-size: 0.875rem;
  color: #EF4444;
}
</style>
