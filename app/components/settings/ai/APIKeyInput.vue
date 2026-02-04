<script setup lang="ts">
import { maskApiKey } from '~/utils/crypto'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  hasStoredKey?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isRevealed = ref(false)
const isFocused = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const displayValue = computed(() => {
  if (isFocused.value || isRevealed.value) {
    return props.modelValue
  }
  if (props.hasStoredKey && !props.modelValue) {
    return ''
  }
  if (props.modelValue) {
    return maskApiKey(props.modelValue)
  }
  return ''
})

const inputType = computed(() => {
  return (isFocused.value || isRevealed.value) ? 'text' : 'password'
})

function handleInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
}

function handleFocus() {
  isFocused.value = true
}

function handleBlur() {
  isFocused.value = false
}

function toggleReveal() {
  isRevealed.value = !isRevealed.value
  if (isRevealed.value && inputRef.value) {
    inputRef.value.focus()
  }
}
</script>

<template>
  <div class="api-key-input">
    <div class="input-wrapper" :class="{ focused: isFocused, disabled }">
      <span class="i-lucide-key input-icon" />
      <input
        ref="inputRef"
        :type="inputType"
        :value="isFocused ? modelValue : displayValue"
        :placeholder="hasStoredKey ? '••••••••••••' : (placeholder || 'Enter API key')"
        :disabled="disabled"
        class="key-input"
        autocomplete="off"
        spellcheck="false"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      >
      <button
        type="button"
        class="reveal-btn"
        :disabled="disabled || (!modelValue && !hasStoredKey)"
        :title="isRevealed ? 'Hide' : 'Show'"
        @click="toggleReveal"
      >
        <span :class="isRevealed ? 'i-lucide-eye-off' : 'i-lucide-eye'" />
      </button>
    </div>
    <p v-if="hasStoredKey && !modelValue" class="stored-hint">
      <span class="i-lucide-shield-check hint-icon" />
      API key is securely stored
    </p>
  </div>
</template>

<style scoped>
.api-key-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1rem;
  min-height: 48px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.input-wrapper.focused {
  border-color: var(--nc-teal, #00D2BE);
  box-shadow: 0 0 0 3px rgba(0, 210, 190, 0.1);
}

.input-wrapper.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-icon {
  font-size: 1rem;
  color: var(--nc-ink-muted, #A1A1AA);
  flex-shrink: 0;
}

.key-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 0.75rem 0;
  background: transparent;
  border: none;
  color: var(--nc-ink, #FAFAFA);
  font-size: 0.875rem;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  outline: none;
}

.key-input::placeholder {
  color: var(--nc-ink-faint, #71717A);
  font-family: inherit;
}

.key-input:disabled {
  cursor: not-allowed;
}

.reveal-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--nc-ink-muted, #A1A1AA);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.reveal-btn:hover:not(:disabled) {
  background: var(--nc-surface-2, #121216);
  color: var(--nc-ink, #FAFAFA);
}

.reveal-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stored-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #22C55E;
  margin: 0;
}

.hint-icon {
  font-size: 0.875rem;
}
</style>
