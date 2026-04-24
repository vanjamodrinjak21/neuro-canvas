<script setup lang="ts">
import { useSyncEngine } from '~/composables/useSyncEngine'

const syncEngine = useSyncEngine()
const { t } = useI18n()

const emit = defineEmits<{
  'open-conflicts': []
}>()

const statusLabel = computed(() => {
  switch (syncEngine.syncStatus.value) {
    case 'idle': return t('canvas.sync.status.synced')
    case 'syncing': return t('canvas.sync.status.syncing')
    case 'offline': return syncEngine.pendingChanges.value > 0
      ? t('canvas.sync.status.offline_pending', { n: syncEngine.pendingChanges.value })
      : t('canvas.sync.status.offline')
    case 'conflict': return t('canvas.sync.status.conflict')
    case 'error': return t('canvas.sync.status.error')
    case 'disabled': return t('canvas.sync.status.local_only')
    default: return ''
  }
})

const dotClass = computed(() => {
  switch (syncEngine.syncStatus.value) {
    case 'idle': return 'dot-green'
    case 'syncing': return 'dot-blue dot-pulse'
    case 'offline': return 'dot-yellow'
    case 'conflict': return 'dot-red dot-pulse'
    case 'error': return 'dot-red'
    case 'disabled': return 'dot-gray'
    default: return 'dot-gray'
  }
})

const isClickable = computed(() => syncEngine.syncStatus.value === 'conflict')
</script>

<template>
  <button
    class="sync-indicator"
    :class="{ clickable: isClickable }"
    :disabled="!isClickable"
    @click="isClickable && emit('open-conflicts')"
  >
    <span class="sync-dot" :class="dotClass" />
    <span class="sync-label">{{ statusLabel }}</span>
  </button>
</template>

<style scoped>
.sync-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--nc-ink-muted);
  background: none;
  border: none;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: default;
  user-select: none;
}

.sync-indicator.clickable {
  cursor: pointer;
}

.sync-indicator.clickable:hover {
  background: var(--nc-surface-2);
  color: var(--nc-ink-soft);
}

.sync-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green { background: var(--nc-accent, #10b981); }
.dot-blue { background: #3b82f6; }
.dot-yellow { background: #f59e0b; }
.dot-red { background: #ef4444; }
.dot-gray { background: var(--nc-ink-muted, #6b7280); }

.dot-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.sync-label {
  white-space: nowrap;
}
</style>
