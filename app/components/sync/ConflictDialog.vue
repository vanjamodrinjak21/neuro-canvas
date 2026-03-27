<script setup lang="ts">
import { useSyncEngine, type SyncConflict } from '~/composables/useSyncEngine'

const syncEngine = useSyncEngine()

const isOpen = computed(() => syncEngine.conflicts.value.length > 0)

const currentConflict = computed<SyncConflict | null>(() =>
  syncEngine.conflicts.value[0] ?? null
)

function formatTime(ts: number | string): string {
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts)
  return d.toLocaleString()
}

async function keepLocal() {
  if (currentConflict.value) {
    await syncEngine.resolveConflict(currentConflict.value.mapId, 'local')
  }
}

async function keepRemote() {
  if (currentConflict.value) {
    await syncEngine.resolveConflict(currentConflict.value.mapId, 'remote')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen && currentConflict" class="conflict-overlay" @click.self="() => {}">
      <div class="conflict-dialog">
        <header class="conflict-header">
          <span class="i-lucide-git-merge conflict-icon" />
          <h3>Sync Conflict</h3>
        </header>

        <p class="conflict-desc">
          This map was modified on another device. Choose which version to keep.
        </p>

        <div class="conflict-comparison">
          <div class="version-card">
            <div class="version-badge local-badge">This Device</div>
            <h4 class="version-title">{{ currentConflict.localTitle }}</h4>
            <div class="version-meta">
              <span>{{ currentConflict.localNodeCount }} nodes</span>
              <span>{{ formatTime(currentConflict.localUpdatedAt) }}</span>
            </div>
          </div>

          <div class="version-vs">vs</div>

          <div class="version-card">
            <div class="version-badge remote-badge">Server</div>
            <h4 class="version-title">{{ currentConflict.remoteTitle }}</h4>
            <div class="version-meta">
              <span>{{ currentConflict.remoteNodeCount }} nodes</span>
              <span>{{ formatTime(currentConflict.remoteUpdatedAt) }}</span>
            </div>
          </div>
        </div>

        <div class="conflict-actions">
          <button class="btn btn-outline" @click="keepLocal">
            Keep Mine
          </button>
          <button class="btn btn-primary" @click="keepRemote">
            Keep Theirs
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.conflict-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.conflict-dialog {
  background: var(--nc-surface-1);
  border: 1px solid var(--nc-border);
  border-radius: 12px;
  padding: 24px;
  max-width: 520px;
  width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.conflict-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.conflict-icon {
  font-size: 20px;
  color: #f59e0b;
}

.conflict-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--nc-ink);
  margin: 0;
}

.conflict-desc {
  font-size: 13px;
  color: var(--nc-ink-soft);
  margin: 0 0 16px;
}

.conflict-comparison {
  display: flex;
  align-items: stretch;
  gap: 12px;
  margin-bottom: 20px;
}

.version-card {
  flex: 1;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 8px;
  padding: 12px;
}

.version-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 8px;
}

.local-badge {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.remote-badge {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.version-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--nc-ink);
  margin: 0 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--nc-ink-muted);
}

.version-vs {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--nc-ink-muted);
  font-weight: 500;
}

.conflict-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-outline {
  background: none;
  border: 1px solid var(--nc-border);
  color: var(--nc-ink-soft);
}

.btn-outline:hover {
  background: var(--nc-surface-2);
  color: var(--nc-ink);
}

.btn-primary {
  background: var(--nc-accent);
  border: 1px solid var(--nc-accent);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}
</style>
