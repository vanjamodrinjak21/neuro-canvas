<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface ShareRow {
  id: string
  token: string
  role: 'VIEWER' | 'EDITOR'
  label: string | null
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

const props = defineProps<{ mapId: string; mapTitle: string; nodeCount: number }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

const shares = ref<ShareRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const newLabel = ref('')
const newRole = ref<'viewer' | 'editor'>('editor')
const newExpiry = ref<'never' | '1d' | '7d' | '30d'>('7d')
const creating = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    shares.value = await $fetch<ShareRow[]>(`/api/maps/${props.mapId}/shares`)
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to load'
  } finally {
    loading.value = false
  }
}

function expiresAtFromChoice(): string | null {
  if (newExpiry.value === 'never') return null
  const days = newExpiry.value === '1d' ? 1 : newExpiry.value === '7d' ? 7 : 30
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

async function createLink() {
  creating.value = true
  error.value = null
  try {
    const created = await $fetch<ShareRow>(`/api/maps/${props.mapId}/shares`, {
      method: 'POST',
      body: { role: newRole.value, label: newLabel.value || null, expiresAt: expiresAtFromChoice() }
    })
    shares.value = [created, ...shares.value]
    newLabel.value = ''
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to create'
  } finally {
    creating.value = false
  }
}

async function revoke(shareId: string) {
  try {
    const res = await $fetch<{ ok: true; share: ShareRow }>(`/api/maps/${props.mapId}/shares/${shareId}`, { method: 'DELETE' })
    shares.value = shares.value.map(s => s.id === shareId ? res.share : s)
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to revoke'
  }
}

async function copyToken(token: string) {
  await navigator.clipboard.writeText(`${location.origin}/s/${token}`)
}

function expiryLabel(s: ShareRow): string {
  if (s.revokedAt) return t('canvas.share_modal.revoked_ago', { rel: rel(s.revokedAt) })
  if (!s.expiresAt) return t('canvas.share_modal.no_expiry')
  const ms = new Date(s.expiresAt).getTime() - Date.now()
  if (ms <= 0) return t('canvas.share_modal.expired')
  return t('canvas.share_modal.expires_in', { rel: rel(s.expiresAt) })
}

function rel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const days = Math.round(abs / 86400000)
  if (days >= 1) return t('canvas.share_modal.rel_days', { n: days })
  const hours = Math.round(abs / 3600000)
  if (hours >= 1) return t('canvas.share_modal.rel_hours', { n: hours })
  const mins = Math.max(1, Math.round(abs / 60000))
  return t('canvas.share_modal.rel_mins', { n: mins })
}

const activeCount = computed(() => shares.value.filter(s => !s.revokedAt).length)

onMounted(load)
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <div class="modal-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div class="head-text">
            <div class="title">{{ t('canvas.share_modal.title') }}</div>
            <div class="subtitle">{{ mapTitle }} · {{ t('canvas.share_modal.node_count', { n: nodeCount }) }}</div>
          </div>
          <button class="icon-btn" :aria-label="t('canvas.share_modal.close')" @click="emit('close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <section class="create-row">
          <div class="row-head">
            <div class="row-title">{{ t('canvas.share_modal.create_new') }}</div>
            <div class="row-hint">{{ t('canvas.share_modal.editor_requires_signin') }}</div>
          </div>
          <div class="row-fields">
            <input
              v-model="newLabel"
              :placeholder="t('canvas.share_modal.label_placeholder')"
              maxlength="64"
              class="text-input"
            >
            <select v-model="newRole" class="select">
              <option value="viewer">{{ t('canvas.share_modal.role_viewer') }}</option>
              <option value="editor">{{ t('canvas.share_modal.role_editor') }}</option>
            </select>
            <select v-model="newExpiry" class="select">
              <option value="1d">{{ t('canvas.share_modal.expiry_1d') }}</option>
              <option value="7d">{{ t('canvas.share_modal.expiry_7d') }}</option>
              <option value="30d">{{ t('canvas.share_modal.expiry_30d') }}</option>
              <option value="never">{{ t('canvas.share_modal.expiry_never') }}</option>
            </select>
            <button class="btn-primary" :disabled="creating" @click="createLink">
              {{ creating ? t('canvas.share_modal.creating') : t('canvas.share_modal.create') }}
            </button>
          </div>
        </section>

        <section class="list-section">
          <header class="list-head">
            <div>{{ t('canvas.share_modal.active_links') }}</div>
            <div class="list-meta">{{ t('canvas.share_modal.link_count', { n: activeCount }) }}</div>
          </header>

          <div v-if="error" class="error">{{ error }}</div>
          <div v-else-if="loading" class="loading">{{ t('canvas.share_modal.loading') }}</div>
          <div v-else-if="!shares.length" class="empty">{{ t('canvas.share_modal.empty') }}</div>

          <ul v-else class="list">
            <li v-for="s in shares" :key="s.id" class="row" :class="{ revoked: !!s.revokedAt }">
              <div class="role-icon" :data-role="s.role">
                <svg v-if="s.role === 'EDITOR'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              </div>
              <div class="row-body">
                <div class="row-label-line">
                  <span class="row-label">{{ s.label || t('canvas.share_modal.untitled') }}</span>
                  <span class="role-chip" :data-role="s.revokedAt ? 'REVOKED' : s.role">
                    {{ s.revokedAt ? t('canvas.share_modal.role_revoked') : (s.role === 'EDITOR' ? t('canvas.share_modal.role_editor_chip') : t('canvas.share_modal.role_viewer_chip')) }}
                  </span>
                </div>
                <div class="row-meta">
                  <span class="token">{{ `s/${s.token.slice(0, 16)}` }}</span>
                  <span class="dot" />
                  <span>{{ expiryLabel(s) }}</span>
                </div>
              </div>
              <button class="icon-btn" :aria-label="t('canvas.share_modal.copy_link')" :disabled="!!s.revokedAt" @click="copyToken(s.token)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              </button>
              <button v-if="!s.revokedAt" class="icon-btn danger" :aria-label="t('canvas.share_modal.revoke')" @click="revoke(s.id)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /></svg>
              </button>
            </li>
          </ul>
        </section>

        <footer class="modal-foot">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <span>{{ t('canvas.share_modal.footnote') }}</span>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.modal-card {
  width: 100%; max-width: 720px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: 12px;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 14px 24px;
  border-bottom: 1px solid var(--nc-border);
}
.head-text { display: flex; flex-direction: column; gap: 4px; }
.title { font: 600 15px Inter, system-ui, sans-serif; color: var(--nc-text); letter-spacing: -0.01em; }
.subtitle { font: 400 12px Inter, system-ui, sans-serif; color: var(--nc-text-muted); }
.icon-btn {
  width: 32px; height: 32px; border-radius: 6px;
  background: transparent; border: 1px solid var(--nc-border);
  color: var(--nc-text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background var(--nc-duration-fast) ease, border-color var(--nc-duration-fast) ease;
}
.icon-btn:hover { background: var(--nc-surface-3); }
.icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.icon-btn.danger:hover { color: var(--nc-danger); border-color: var(--nc-danger); }
.create-row {
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px 24px 18px 24px;
  border-bottom: 1px solid var(--nc-border);
}
.row-head { display: flex; align-items: center; justify-content: space-between; }
.row-title { font: 500 13px Inter, system-ui, sans-serif; color: var(--nc-text); }
.row-hint { font: 400 11px Inter, system-ui, sans-serif; color: var(--nc-text-dim); }
.row-fields { display: flex; gap: 8px; }
.text-input, .select {
  height: 36px; padding: 0 12px;
  background: var(--nc-bg);
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  color: var(--nc-text);
  font: 400 13px Inter, system-ui, sans-serif;
}
.text-input { flex: 1; }
.select { min-width: 100px; }
.btn-primary {
  height: 36px; padding: 0 14px;
  background: var(--nc-accent); color: #09090B;
  border: 0; border-radius: 6px;
  font: 600 13px Inter, system-ui, sans-serif;
  cursor: pointer;
  transition: transform var(--nc-duration-press) ease-out;
}
.btn-primary:active { transform: scale(0.97); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.list-section { display: flex; flex-direction: column; }
.list-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 10px 24px;
  font: 500 13px Inter, system-ui, sans-serif; color: var(--nc-text);
}
.list-head .list-meta { font-weight: 400; font-size: 11px; color: var(--nc-text-muted); }
.list { list-style: none; padding: 0; margin: 0; }
.row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 24px;
  border-top: 1px solid var(--nc-border);
}
.row.revoked { opacity: 0.45; }
.role-icon {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--nc-bg);
  border: 1px solid var(--nc-border);
  border-radius: 8px;
  color: var(--nc-accent);
  flex-shrink: 0;
}
.role-icon[data-role="VIEWER"] { color: var(--nc-text-secondary); }
.row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.row-label-line { display: flex; align-items: center; gap: 8px; }
.row-label { font: 500 13px Inter, system-ui, sans-serif; color: var(--nc-text); }
.role-chip {
  font: 500 10px Inter, system-ui, sans-serif;
  letter-spacing: 0.02em;
  padding: 1px 7px; border-radius: 4px;
  border: 1px solid var(--nc-border);
  background: var(--nc-surface-3);
  color: var(--nc-text-secondary);
}
.role-chip[data-role="EDITOR"] {
  color: var(--nc-accent);
  background: var(--nc-accent-glow);
  border-color: var(--nc-accent-glow-strong);
}
.role-chip[data-role="REVOKED"] {
  color: var(--nc-danger);
  background: var(--nc-danger-glow);
  border-color: rgba(239, 68, 68, 0.25);
}
.row-meta {
  display: flex; align-items: center; gap: 6px;
  font: 400 11px Inter, system-ui, sans-serif;
  color: var(--nc-text-muted);
}
.row-meta .token { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.row-meta .dot { width: 2px; height: 2px; border-radius: 999px; background: var(--nc-text-dim); }
.error { padding: 16px 24px; color: var(--nc-danger); font-size: 12px; }
.loading, .empty { padding: 16px 24px; color: var(--nc-text-muted); font-size: 12px; }
.modal-foot {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 24px;
  background: var(--nc-bg);
  border-top: 1px solid var(--nc-border);
  font: 400 11px Inter, system-ui, sans-serif;
  color: var(--nc-text-muted);
}
</style>
