<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface VersionRow {
  id: string
  version: number
  byteSize: number
  authorId: string | null
  createdAt: string
}

const props = defineProps<{ mapId: string }>()
const emit = defineEmits<{ (e: 'close' | 'restored'): void }>()
const { t, locale } = useI18n()

const versions = ref<VersionRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const restoringId = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await $fetch<{ items: VersionRow[]; nextCursor: string | null; total: number }>(
      `/api/maps/${props.mapId}/versions`
    )
    versions.value = res.items
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to load versions'
  } finally {
    loading.value = false
  }
}

async function restore(versionId: string) {
  if (!window.confirm(t('canvas.version_history.restore_confirm'))) return
  restoringId.value = versionId
  error.value = null
  try {
    await $fetch(`/api/maps/${props.mapId}/versions/${versionId}/restore`, { method: 'POST' })
    emit('restored')
    emit('close')
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to restore'
  } finally {
    restoringId.value = null
  }
}

const dateFmt = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
)
function formatDate(iso: string) {
  return dateFmt.value.format(new Date(iso))
}
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function shortAuthor(id: string | null) {
  if (!id) return t('canvas.version_history.author_unknown')
  if (id.startsWith('guest:')) return t('canvas.version_history.author_guest')
  return id.slice(0, 6)
}

onMounted(load)
</script>

<template>
  <aside class="vh-panel" role="dialog" aria-modal="true" :aria-label="t('canvas.version_history.title')">
    <header class="vh-header">
      <h2>{{ t('canvas.version_history.title') }}</h2>
      <button class="vh-close" :aria-label="t('canvas.version_history.close')" @click="emit('close')">×</button>
    </header>

    <div v-if="error" class="vh-error">{{ error }}</div>

    <div v-if="loading" class="vh-state">{{ t('canvas.version_history.loading') }}</div>

    <ul v-else-if="versions.length" class="vh-list">
      <li v-for="v in versions" :key="v.id" class="vh-row">
        <div class="vh-row-main">
          <div class="vh-row-time">{{ formatDate(v.createdAt) }}</div>
          <div class="vh-row-meta">
            <span class="vh-author">{{ shortAuthor(v.authorId) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ formatBytes(v.byteSize) }}</span>
            <span aria-hidden="true">·</span>
            <span>v{{ v.version }}</span>
          </div>
        </div>
        <button
          class="vh-restore"
          :disabled="restoringId !== null"
          @click="restore(v.id)"
        >
          {{ restoringId === v.id ? t('canvas.version_history.restoring') : t('canvas.version_history.restore') }}
        </button>
      </li>
    </ul>

    <div v-else class="vh-state">{{ t('canvas.version_history.empty') }}</div>
  </aside>
</template>

<style scoped>
.vh-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  background: #111113;
  border-left: 1px solid #27272A;
  color: #FAFAFA;
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
}
.vh-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #27272A;
}
.vh-header h2 {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin: 0;
}
.vh-close {
  background: none;
  border: none;
  color: #A1A1AA;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
}
.vh-close:hover { color: #FAFAFA; }

.vh-error {
  margin: 12px 20px;
  padding: 10px 12px;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.4);
  border-radius: 6px;
  font-size: 12px;
  color: #FCA5A5;
}
.vh-state {
  padding: 28px 20px;
  color: #71717A;
  font-size: 13px;
  text-align: center;
}

.vh-list {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}
.vh-row {
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #1A1A1D;
}
.vh-row:hover { background: #161618; }
.vh-row-time { font-size: 13px; font-weight: 500; }
.vh-row-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: #71717A;
  margin-top: 2px;
}
.vh-author { color: #A1A1AA; }

.vh-restore {
  border: 1px solid #27272A;
  background: transparent;
  color: #FAFAFA;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.vh-restore:hover:not(:disabled) {
  background: #1A1A1D;
  border-color: #3F3F46;
}
.vh-restore:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
