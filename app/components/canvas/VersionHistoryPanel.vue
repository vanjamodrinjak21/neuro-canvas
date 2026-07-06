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
/* Scrim — flat, no backdrop blur (REDESIGN.md §5) */
.vh-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(var(--nc-bg-rgb), 0.66);
  animation: vh-fade 140ms var(--nc-ease);
}
@keyframes vh-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Modal — flat surface-2 + hairline, enter scale(0.97)+opacity, no slide-in */
.vh-modal {
  width: 100%;
  max-width: 520px;
  max-height: min(80vh, 720px);
  display: flex;
  flex-direction: column;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  color: var(--nc-text);
  box-shadow: var(--nc-shadow-md);
  overflow: hidden;
  transform-origin: center;
  animation: vh-rise 200ms var(--nc-ease);
}
@keyframes vh-rise {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.vh-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--nc-border);
}
/* Modal header — display face (REDESIGN.md §4) */
.vh-heading h2 {
  font-family: var(--nc-font-display);
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  margin: 0;
}
.vh-subtitle {
  margin: 4px 0 0;
  font-size: calc(12.5px * var(--nc-text-scale, 1));
  line-height: 1.4;
  color: var(--nc-text-secondary);
}
.vh-close {
  flex-shrink: 0;
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  color: var(--nc-text-secondary);
  font-size: calc(16px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: background 120ms var(--nc-ease),
              color 120ms var(--nc-ease),
              border-color 120ms var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}
@media (hover: hover) and (pointer: fine) {
  .vh-close:hover:not(:disabled) {
    color: var(--nc-text);
    background: var(--nc-surface-3);
    border-color: var(--nc-border);
  }
}
.vh-close:active:not(:disabled) { transform: scale(0.97); }
.vh-close:focus-visible {
  outline: none;
  border-color: var(--nc-accent);
}
.vh-close:disabled { opacity: 0.4; cursor: not-allowed; }

/* Validation/error surface — coral (REDESIGN.md §1 accent discipline) */
.vh-error {
  margin: 14px 22px 0;
  padding: 10px 12px;
  background: rgba(var(--nc-coral-rgb), 0.1);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.4);
  border-radius: 0.5rem;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-coral);
}
.vh-state {
  padding: 40px 22px;
  color: var(--nc-text-secondary);
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
  border-bottom: 1px solid var(--nc-border-subtle);
  transition: background 120ms var(--nc-ease), box-shadow 120ms var(--nc-ease);
}
.vh-row:last-child { border-bottom: none; }
@media (hover: hover) and (pointer: fine) {
  .vh-row:hover { background: var(--nc-chip-bg); }
}
.vh-row-main { min-width: 0; }
.vh-row-time { font-size: calc(13.5px * var(--nc-text-scale, 1)); font-weight: 550; }
.vh-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  margin-top: 3px;
}
.vh-author { color: var(--nc-text-secondary); }

.vh-btn {
  border-radius: 0.4rem;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 550;
  padding: 7px 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms var(--nc-ease),
              color 120ms var(--nc-ease),
              border-color 120ms var(--nc-ease),
              opacity 120ms var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}
.vh-btn:active:not(:disabled) { transform: scale(0.97); }
.vh-restore {
  flex-shrink: 0;
  border: 1px solid var(--nc-border);
  background: transparent;
  color: var(--nc-text);
}
@media (hover: hover) and (pointer: fine) {
  .vh-restore:hover:not(:disabled) {
    background: var(--nc-surface-3);
    border-color: var(--nc-border-active);
  }
}
.vh-restore:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
