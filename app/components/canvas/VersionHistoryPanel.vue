<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { userFriendlyError } from '~/utils/userFriendlyError'

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

const versions = ref<VersionRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const restoringId = ref<string | null>(null)
/** Row currently showing the inline "are you sure?" confirm. */
const pendingId = ref<string | null>(null)

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

function askRestore(versionId: string) {
  if (restoringId.value) return
  pendingId.value = versionId
}
function cancelRestore() {
  pendingId.value = null
}

async function confirmRestore(versionId: string) {
  restoringId.value = versionId
  pendingId.value = null
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
  if (pendingId.value) { pendingId.value = null; return }
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
            :class="{ 'is-pending': pendingId === v.id }"
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

            <div v-if="pendingId === v.id" class="vh-confirm">
              <span class="vh-confirm-q">{{ t('canvas.version_history.restore_confirm') }}</span>
              <div class="vh-confirm-actions">
                <button class="vh-btn vh-btn-ghost" @click="cancelRestore">
                  {{ t('canvas.version_history.cancel') }}
                </button>
                <button class="vh-btn vh-btn-primary" @click="confirmRestore(v.id)">
                  {{ t('canvas.version_history.restore') }}
                </button>
              </div>
            </div>
            <button
              v-else
              class="vh-btn vh-restore"
              :disabled="!!restoringId"
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
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
  margin: 0;
}
.vh-subtitle {
  margin: 4px 0 0;
  font-size: 12.5px;
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
  font-size: 16px;
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
  font-size: 12px;
  color: #FCA5A5;
}
.vh-state {
  padding: 40px 22px;
  color: var(--nc-ink-soft, #71717A);
  font-size: 13px;
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
.vh-row.is-pending { background: rgba(0, 210, 190, 0.06); }
.vh-row-main { min-width: 0; }
.vh-row-time { font-size: 13.5px; font-weight: 550; }
.vh-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: var(--nc-ink-soft, #71717A);
  margin-top: 3px;
}
.vh-author { color: var(--nc-ink-soft, #A1A1AA); }

.vh-btn {
  border-radius: 7px;
  font-size: 12px;
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

.vh-confirm {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.vh-confirm-q {
  font-size: 11.5px;
  color: var(--nc-ink-soft, #A1A1AA);
  max-width: 180px;
  text-align: right;
  line-height: 1.35;
}
.vh-confirm-actions { display: flex; gap: 8px; }
.vh-btn-ghost {
  border: 1px solid transparent;
  background: transparent;
  color: var(--nc-ink-soft, #A1A1AA);
}
.vh-btn-ghost:hover { color: var(--nc-ink, #FAFAFA); background: rgba(255, 255, 255, 0.05); }
.vh-btn-primary {
  border: 1px solid transparent;
  background: var(--nc-accent, #00D2BE);
  color: #04201D;
  font-weight: 650;
}
.vh-btn-primary:hover { filter: brightness(1.06); }

@media (max-width: 560px) {
  .vh-confirm { flex-direction: column; align-items: flex-end; gap: 8px; }
  .vh-confirm-q { max-width: none; }
}
</style>
