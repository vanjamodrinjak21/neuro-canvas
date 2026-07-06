<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { userFriendlyError } from '~/utils/userFriendlyError'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { useConfirmDialog } from '~/composables/useConfirmDialog'

interface VersionRow {
  id: string
  version: number
  byteSize: number
  authorId: string | null
  /** Display name resolved server-side from User.name. */
  authorName?: string | null
  /** Fallback identity when User.name is missing; absent on legacy rows. */
  authorEmail?: string | null
  createdAt: string
}

const props = defineProps<{ mapId: string }>()
const emit = defineEmits<{ (e: 'close' | 'restored'): void }>()
const { t, locale } = useI18n()

// Restoring a version is a server call — gate it when offline. Viewing the
// (already-loaded) history list stays available.
const { isOnline } = useSyncEngine()
const offlineHint = computed(() => (isOnline.value ? undefined : t('common.offline.action_unavailable')))

const { confirm, ConfirmDialog } = useConfirmDialog()

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
    console.error('[versions] load failed', e)
    error.value = userFriendlyError(e, t)
  } finally {
    loading.value = false
  }
}

async function askRestore(versionId: string) {
  if (restoringId.value || !isOnline.value) return
  const confirmed = await confirm({
    title: t('canvas.version_history.title'),
    description: t('canvas.version_history.restore_confirm'),
    confirmText: t('canvas.version_history.restore'),
    cancelText: t('canvas.version_history.cancel'),
    variant: 'danger',
    icon: 'i-lucide-history'
  })
  if (!confirmed) return
  restoringId.value = versionId
  error.value = null
  try {
    await $fetch(`/api/maps/${props.mapId}/versions/${versionId}/restore`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    emit('restored')
    emit('close')
  } catch (e: unknown) {
    console.error('[versions] restore failed', e)
    error.value = userFriendlyError(e, t)
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

/**
 * Resolve the human-friendly author label for a version row.
 * Prefers User.name (joined server-side), then email, then the legacy
 * short-id fallback so older rows without enrichment still show something.
 */
function authorLabel(v: VersionRow): string {
  if (v.authorId?.startsWith('guest:')) return t('canvas.version_history.author_guest')
  if (v.authorName && v.authorName.trim()) return v.authorName
  if (v.authorEmail && v.authorEmail.trim()) return v.authorEmail
  return shortAuthor(v.authorId)
}

function onBackdrop() {
  if (restoringId.value) return
  emit('close')
}

onMounted(load)
onKeyStroke('Escape', () => {
  if (!restoringId.value) emit('close')
})
</script>

<template>
  <Teleport to="body">
    <div class="vh-backdrop" @click.self="onBackdrop">
      <section
        class="vh-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('canvas.version_history.title')"
      >
        <header class="vh-header">
          <div class="vh-heading">
            <h2>{{ t('canvas.version_history.title') }}</h2>
            <p class="vh-subtitle">{{ t('canvas.version_history.subtitle') }}</p>
          </div>
          <button
            class="vh-close"
            :aria-label="t('canvas.version_history.close')"
            :disabled="!!restoringId"
            @click="emit('close')"
          >
            <span class="i-lucide-x" />
          </button>
        </header>

        <div v-if="error" class="vh-error">{{ error }}</div>

        <div v-if="loading" class="vh-state">{{ t('canvas.version_history.loading') }}</div>

        <ul v-else-if="versions.length" class="vh-list">
          <li
            v-for="v in versions"
            :key="v.id"
            class="vh-row"
          >
            <div class="vh-row-main">
              <div class="vh-row-time">{{ formatDate(v.createdAt) }}</div>
              <div class="vh-row-meta">
                <span class="vh-author" :title="v.authorEmail || v.authorId || ''">{{ authorLabel(v) }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ formatBytes(v.byteSize) }}</span>
                <span aria-hidden="true">·</span>
                <span>v{{ v.version }}</span>
              </div>
            </div>

            <button
              class="vh-btn vh-restore"
              :disabled="!!restoringId || !isOnline"
              :title="offlineHint"
              @click="askRestore(v.id)"
            >
              {{ restoringId === v.id ? t('canvas.version_history.restoring') : t('canvas.version_history.restore') }}
            </button>
          </li>
        </ul>

        <div v-else class="vh-state">{{ t('canvas.version_history.empty') }}</div>
      </section>
    </div>
  </Teleport>
  <component :is="ConfirmDialog" />
</template>

<style scoped>
.vh-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(4, 4, 6, 0.62);
  backdrop-filter: blur(4px);
  animation: vh-fade 140ms ease;
}
@keyframes vh-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.vh-modal {
  width: 100%;
  max-width: 520px;
  max-height: min(80vh, 720px);
  display: flex;
  flex-direction: column;
  background: var(--nc-surface, #111113);
  border: 1px solid var(--nc-border, #27272A);
  border-radius: 14px;
  color: var(--nc-ink, #FAFAFA);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  animation: vh-rise 160ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes vh-rise {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.vh-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--nc-border, #27272A);
}
.vh-heading h2 {
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 650;
  letter-spacing: -0.01em;
  margin: 0;
}
.vh-subtitle {
  margin: 4px 0 0;
  font-size: calc(12.5px * var(--nc-text-scale, 1));
  line-height: 1.4;
  color: var(--nc-ink-soft, #A1A1AA);
}
.vh-close {
  flex-shrink: 0;
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--nc-ink-soft, #A1A1AA);
  font-size: calc(16px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.vh-close:hover:not(:disabled) {
  color: var(--nc-ink, #FAFAFA);
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--nc-border, #27272A);
}
.vh-close:focus-visible {
  outline: none;
  border-color: var(--nc-accent, #00D2BE);
}
.vh-close:disabled { opacity: 0.4; cursor: not-allowed; }

.vh-error {
  margin: 14px 22px 0;
  padding: 10px 12px;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.4);
  border-radius: 8px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: #FCA5A5;
}
.vh-state {
  padding: 40px 22px;
  color: var(--nc-ink-soft, #71717A);
  font-size: calc(13px * var(--nc-text-scale, 1));
  text-align: center;
}

.vh-list {
  list-style: none;
  margin: 0;
  padding: 6px 0;
  overflow-y: auto;
  flex: 1;
}
.vh-row {
  padding: 12px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--nc-border-soft, #1A1A1D);
  transition: background 120ms ease;
}
.vh-row:last-child { border-bottom: none; }
.vh-row:hover { background: rgba(255, 255, 255, 0.025); }
.vh-row-main { min-width: 0; }
.vh-row-time { font-size: calc(13.5px * var(--nc-text-scale, 1)); font-weight: 550; }
.vh-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-soft, #71717A);
  margin-top: 3px;
}
.vh-author { color: var(--nc-ink-soft, #A1A1AA); }

.vh-btn {
  border-radius: 7px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 550;
  padding: 7px 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease;
}
.vh-restore {
  flex-shrink: 0;
  border: 1px solid var(--nc-border, #27272A);
  background: transparent;
  color: var(--nc-ink, #FAFAFA);
}
.vh-restore:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  border-color: #3F3F46;
}
.vh-restore:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
