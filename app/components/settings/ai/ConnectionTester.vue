<script setup lang="ts">
const props = defineProps<{
  status: 'idle' | 'testing' | 'success' | 'error'
  message?: string
}>()

const emit = defineEmits<{
  test: []
}>()

const statusConfig = computed(() => {
  switch (props.status) {
    case 'testing':
      return {
        icon: 'i-lucide-loader-2',
        iconClass: 'animate-spin',
        text: 'Testing...',
        color: 'muted'
      }
    case 'success':
      return {
        icon: 'i-lucide-check-circle',
        iconClass: '',
        text: props.message || 'Connected',
        color: 'success'
      }
    case 'error':
      return {
        icon: 'i-lucide-x-circle',
        iconClass: '',
        text: props.message || 'Failed',
        color: 'error'
      }
    default:
      return {
        icon: 'i-lucide-wifi',
        iconClass: '',
        text: 'Test Connection',
        color: 'default'
      }
  }
})
</script>

<template>
  <div class="connection-tester">
    <button
      class="test-btn"
      :class="[`status-${statusConfig.color}`]"
      :disabled="status === 'testing'"
      @click="emit('test')"
    >
      <span :class="[statusConfig.icon, statusConfig.iconClass, 'btn-icon']" />
      <span class="btn-text">{{ statusConfig.text }}</span>
    </button>
  </div>
</template>

<style scoped>
.connection-tester {
  display: inline-flex;
}

.test-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 8px;
  color: var(--nc-ink-muted, #A1A1AA);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.test-btn:hover:not(:disabled) {
  background: var(--nc-surface-2, #121216);
  border-color: var(--nc-teal, #00D2BE);
  color: var(--nc-teal, #00D2BE);
}

.test-btn:disabled {
  cursor: not-allowed;
}

.test-btn.status-success {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22C55E;
}

.test-btn.status-error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #EF4444;
}

.test-btn.status-muted {
  color: var(--nc-ink-muted, #A1A1AA);
}

.btn-icon {
  font-size: 0.95rem;
}

.btn-text {
  white-space: nowrap;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
