<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { userFriendlyError } from '~/utils/userFriendlyError'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { useConfirmDialog } from '~/composables/useConfirmDialog'
import { useApiFetch } from '~/composables/useApiFetch'
import NcSelect from '~/components/ui/NcSelect.vue'

interface ShareRow {
  id: string
  token: string
  role: 'VIEWER' | 'COMMENTER' | 'EDITOR'
  label: string | null
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

const props = defineProps<{ mapId: string; mapTitle: string; nodeCount: number }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

// Sharing is server-only (create/revoke links, send email invites). Gate the
// mutating actions when offline; the offline hint reuses common.offline.*.
const { isOnline } = useSyncEngine()
const offlineHint = computed(() => (isOnline.value ? undefined : t('common.offline.action_unavailable')))

const { confirm, ConfirmDialog } = useConfirmDialog()

// Share CRUD is server-only and auth-gated. On the native shells a plain
// $fetch has no session (and no server behind the local origin), so every
// call in this modal 401/403'd — "Nemaš dozvolu" on maps the user owns
// (AER-103). apiFetch routes through the platform's authenticated transport.
const { apiFetch } = useApiFetch()

const shares = ref<ShareRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const newLabel = ref('')
const newRole = ref<'viewer' | 'commenter' | 'editor'>('editor')
const newExpiry = ref<'never' | '1d' | '7d' | '30d'>('7d')
const creating = ref(false)

const roleOptions = computed(() => [
  { value: 'viewer', label: t('canvas.share_modal.role_viewer') },
  { value: 'commenter', label: t('canvas.comments.share_modal_role_commenter') },
  { value: 'editor', label: t('canvas.share_modal.role_editor') },
])
const expiryOptions = computed(() => [
  { value: '1d', label: t('canvas.share_modal.expiry_1d') },
  { value: '7d', label: t('canvas.share_modal.expiry_7d') },
  { value: '30d', label: t('canvas.share_modal.expiry_30d') },
  { value: 'never', label: t('canvas.share_modal.expiry_never') },
])

// Per-share email-invite form state, keyed by share.id. Lazy: only
// populated when the user clicks "Email link" on a given row.
interface InviteFormState {
  open: boolean
  recipients: string
  note: string
  sending: boolean
  status: string | null
  error: string | null
}
const inviteForms = reactive<Record<string, InviteFormState>>({})

function toggleInvite(shareId: string) {
  const existing = inviteForms[shareId]
  if (existing) {
    existing.open = !existing.open
    if (existing.open) { existing.status = null; existing.error = null }
  } else {
    inviteForms[shareId] = {
      open: true,
      recipients: '',
      note: '',
      sending: false,
      status: null,
      error: null,
    }
  }
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

const EMAIL_RX = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

async function sendInvite(shareId: string) {
  const form = inviteForms[shareId]
  if (!form) return
  const recipients = parseRecipients(form.recipients)
  const invalid = recipients.find(r => !EMAIL_RX.test(r))
  if (recipients.length === 0) {
    form.error = t('canvas.share_modal.invite_no_recipients')
    return
  }
  if (invalid) {
    form.error = t('canvas.share_modal.invite_invalid_email', { email: invalid })
    return
  }
  if (recipients.length > 20) {
    form.error = t('canvas.share_modal.invite_too_many')
    return
  }
  form.sending = true
  form.error = null
  form.status = null
  try {
    const res = await apiFetch<{ sent: number; failed: number; recipients: number }>(
      `/api/maps/${props.mapId}/shares/${shareId}/invite`,
      {
        method: 'POST',
        body: {
          recipients,
          personalNote: form.note.trim() || undefined,
        },
      },
    )
    if (res.failed > 0 && res.sent === 0) {
      form.error = t('canvas.share_modal.invite_all_failed')
    } else if (res.failed > 0) {
      form.status = t('canvas.share_modal.invite_partial', { sent: res.sent, failed: res.failed })
    } else {
      form.status = t('canvas.share_modal.invite_sent', { n: res.sent })
      // Close the form after a brief moment so the user sees the confirmation.
      setTimeout(() => { if (inviteForms[shareId]) inviteForms[shareId].open = false }, 1800)
      form.recipients = ''
      form.note = ''
    }
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; data?: { statusMessage?: string }; statusCode?: number }
    if (err.statusCode === 429) {
      form.error = t('canvas.share_modal.invite_rate_limited')
    } else {
      form.error = err.data?.statusMessage || err.statusMessage || t('canvas.share_modal.invite_failed')
    }
  } finally {
    form.sending = false
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    shares.value = await apiFetch<ShareRow[]>(`/api/maps/${props.mapId}/shares`)
  } catch (e: unknown) {
    console.error('[share] load failed', e)
    error.value = userFriendlyError(e, t)
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
    const created = await apiFetch<ShareRow>(`/api/maps/${props.mapId}/shares`, {
      method: 'POST',
      body: { role: newRole.value, label: newLabel.value || null, expiresAt: expiresAtFromChoice() }
    })
    shares.value = [created, ...shares.value]
    newLabel.value = ''
  } catch (e: unknown) {
    console.error('[share] create failed', e)
    error.value = userFriendlyError(e, t)
  } finally {
    creating.value = false
  }
}

async function revoke(share: ShareRow) {
  // Revoking is irreversible for the link (anyone holding it loses access
  // immediately) — gate it behind a danger confirm (NcConfirmDialog grammar).
  const confirmed = await confirm({
    title: t('canvas.share_modal.revoke_confirm_title'),
    description: t('canvas.share_modal.revoke_confirm_desc', {
      label: share.label || t('canvas.share_modal.untitled')
    }),
    confirmText: t('canvas.share_modal.revoke'),
    cancelText: t('common.buttons.cancel'),
    variant: 'danger',
    icon: 'i-lucide-link-2-off'
  })
  if (!confirmed) return
  try {
    // apiFetch adds X-Requested-With on bodyless mutating calls, which the
    // CSRF middleware needs (no Content-Type means the JSON bypass can't fire).
    const res = await apiFetch<{ ok: true; share: ShareRow }>(`/api/maps/${props.mapId}/shares/${share.id}`, {
      method: 'DELETE'
    })
    shares.value = shares.value.map(s => s.id === share.id ? res.share : s)
  } catch (e: unknown) {
    console.error('[share] revoke failed', e)
    error.value = userFriendlyError(e, t)
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
            <div class="row-hint">{{ offlineHint ?? t('canvas.share_modal.editor_requires_signin') }}</div>
          </div>
          <div class="row-fields">
            <input
              v-model="newLabel"
              :placeholder="t('canvas.share_modal.label_placeholder')"
              maxlength="64"
              class="text-input"
            >
            <NcSelect
              :model-value="newRole"
              :options="roleOptions"
              :aria-label="t('canvas.share_modal.role_aria')"
              class="role-select"
              @update:model-value="v => newRole = v as typeof newRole"
            />
            <NcSelect
              :model-value="newExpiry"
              :options="expiryOptions"
              :aria-label="t('canvas.share_modal.expiry_aria')"
              class="expiry-select"
              @update:model-value="v => newExpiry = v as typeof newExpiry"
            />
            <button class="btn-primary" :disabled="creating || !isOnline" :title="offlineHint" @click="createLink">
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
            <li v-for="s in shares" :key="s.id" class="row-wrap" :class="{ revoked: !!s.revokedAt }">
              <div class="row">
                <div class="role-icon" :data-role="s.role">
                  <svg v-if="s.role === 'EDITOR'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                </div>
                <div class="row-body">
                  <div class="row-label-line">
                    <span class="row-label">{{ s.label || t('canvas.share_modal.untitled') }}</span>
                    <span class="role-chip" :data-role="s.revokedAt ? 'REVOKED' : s.role">
                      {{
                        s.revokedAt
                          ? t('canvas.share_modal.role_revoked')
                          : s.role === 'EDITOR'
                            ? t('canvas.share_modal.role_editor_chip')
                            : s.role === 'COMMENTER'
                              ? t('canvas.comments.share_modal_role_commenter_chip')
                              : t('canvas.share_modal.role_viewer_chip')
                      }}
                    </span>
                  </div>
                  <div class="row-meta">
                    <span class="token">{{ `s/${s.token.slice(0, 16)}` }}</span>
                    <span class="dot" />
                    <span>{{ expiryLabel(s) }}</span>
                  </div>
                </div>
                <button
                  class="icon-btn"
                  :aria-label="t('canvas.share_modal.invite_aria')"
                  :disabled="!!s.revokedAt || !isOnline"
                  :title="offlineHint"
                  :class="{ 'is-open': inviteForms[s.id]?.open }"
                  @click="toggleInvite(s.id)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                </button>
                <button class="icon-btn" :aria-label="t('canvas.share_modal.copy_link')" :disabled="!!s.revokedAt" @click="copyToken(s.token)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                </button>
                <button v-if="!s.revokedAt" class="icon-btn danger" :aria-label="t('canvas.share_modal.revoke')" :disabled="!isOnline" :title="offlineHint" @click="revoke(s)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /></svg>
                </button>
              </div>

              <div v-if="inviteForms[s.id]?.open && !s.revokedAt" class="invite-form">
                <label class="invite-label">{{ t('canvas.share_modal.invite_label') }}</label>
                <textarea
                  v-model="inviteForms[s.id]!.recipients"
                  :placeholder="t('canvas.share_modal.invite_recipients_placeholder')"
                  class="invite-recipients"
                  rows="2"
                  :disabled="inviteForms[s.id]!.sending"
                />
                <textarea
                  v-model="inviteForms[s.id]!.note"
                  :placeholder="t('canvas.share_modal.invite_note_placeholder')"
                  class="invite-note"
                  rows="2"
                  maxlength="500"
                  :disabled="inviteForms[s.id]!.sending"
                />
                <div class="invite-actions">
                  <span v-if="inviteForms[s.id]!.error" class="invite-error">{{ inviteForms[s.id]!.error }}</span>
                  <span v-else-if="inviteForms[s.id]!.status" class="invite-status">{{ inviteForms[s.id]!.status }}</span>
                  <span v-else class="invite-hint">{{ t('canvas.share_modal.invite_hint') }}</span>
                  <button
                    class="btn-primary btn-sm"
                    :disabled="inviteForms[s.id]!.sending || !isOnline"
                    :title="offlineHint"
                    @click="sendInvite(s.id)"
                  >
                    {{ inviteForms[s.id]!.sending ? t('canvas.share_modal.invite_sending') : t('canvas.share_modal.invite_send') }}
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <footer class="modal-foot">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <span>{{ t('canvas.share_modal.footnote') }}</span>
        </footer>
      </div>
    </div>
    <component :is="ConfirmDialog" />
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
/* Dialog — flat surface-2 + hairline (REDESIGN.md §5) */
.modal-card {
  width: 100%; max-width: 720px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  box-shadow: var(--nc-shadow-md);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 14px 24px;
  border-bottom: 1px solid var(--nc-border);
}
.head-text { display: flex; flex-direction: column; gap: 4px; }
/* Modal title — display face (REDESIGN.md §4) */
.title {
  font: 700 15px var(--nc-font-display);
  color: var(--nc-text);
  letter-spacing: -0.015em;
}
.subtitle { font: 400 12px var(--nc-font-body); color: var(--nc-text-muted); }
.icon-btn {
  width: 32px; height: 32px; border-radius: 6px;
  background: transparent; border: 1px solid var(--nc-border);
  color: var(--nc-text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition:
    color var(--nc-duration-fast) var(--nc-ease),
    background var(--nc-duration-fast) var(--nc-ease),
    border-color var(--nc-duration-fast) var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}
@media (hover: hover) and (pointer: fine) {
  .icon-btn:hover { background: var(--nc-surface-3); }
  /* Destructive action — coral (REDESIGN.md §1 accent discipline) */
  .icon-btn.danger:hover { color: var(--nc-coral); border-color: var(--nc-coral); }
}
.icon-btn:active:not(:disabled) { transform: scale(0.97); }
.icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.create-row {
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px 24px 18px 24px;
  border-bottom: 1px solid var(--nc-border);
}
.row-head { display: flex; align-items: center; justify-content: space-between; }
/* Section header — mono uppercase micro-label (REDESIGN.md §4) */
.row-title {
  font: 500 calc(10.5px * var(--nc-text-scale, 1)) var(--nc-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}
.row-hint { font: 400 11px var(--nc-font-body); color: var(--nc-text-dim); }
.row-fields { display: flex; gap: 8px; }
/* Input — chip fill, hairline, accent focus border only (REDESIGN.md §5) */
.text-input {
  flex: 1;
  height: 36px; padding: 0 12px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: 0.5rem;
  color: var(--nc-text);
  font: 400 13px var(--nc-font-body);
  transition: border-color 150ms var(--nc-ease);
}
.text-input::placeholder { color: var(--nc-text-dim); }
.text-input:focus { outline: none; border-color: var(--nc-accent); }
.role-select { width: 136px; }
.expiry-select { width: 116px; }
.btn-primary {
  height: 36px; padding: 0 14px;
  background: var(--nc-accent); color: var(--nc-bg);
  border: 0; border-radius: 6px;
  font: 600 13px var(--nc-font-body);
  cursor: pointer;
  transition:
    background var(--nc-duration-fast) var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}
@media (hover: hover) and (pointer: fine) {
  .btn-primary:hover:not(:disabled) { background: var(--nc-accent-light); }
}
.btn-primary:active { transform: scale(0.97); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary.btn-sm { height: 30px; padding: 0 14px; font-size: calc(12px * var(--nc-text-scale, 1)); }
.list-section { display: flex; flex-direction: column; }
/* Section header — mono uppercase micro-label (REDESIGN.md §4) */
.list-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 10px 24px;
  font: 500 calc(10.5px * var(--nc-text-scale, 1)) var(--nc-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}
.list-head .list-meta {
  font: 400 calc(11px * var(--nc-text-scale, 1)) var(--nc-font-body);
  text-transform: none;
  letter-spacing: normal;
  color: var(--nc-text-muted);
}
.list { list-style: none; padding: 0; margin: 0; }
.row-wrap {
  border-top: 1px solid var(--nc-border);
}
.row-wrap.revoked { opacity: 0.45; }
.row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 24px;
}
.icon-btn.is-open { border-color: var(--nc-accent); color: var(--nc-accent-text); }
.invite-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 24px 16px 74px;
  background: color-mix(in srgb, var(--nc-accent) 4%, transparent);
  border-top: 1px dashed var(--nc-border);
}
/* Field label — mono uppercase micro-label (REDESIGN.md §4/§5) */
.invite-label {
  font: 500 calc(10.5px * var(--nc-text-scale, 1)) var(--nc-font-mono);
  color: var(--nc-text-secondary);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.invite-recipients,
.invite-note {
  width: 100%;
  padding: 8px 12px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  color: var(--nc-text);
  font: 400 13px var(--nc-font-body);
  resize: vertical;
  min-height: 36px;
  transition: border-color 150ms var(--nc-ease);
}
.invite-recipients::placeholder,
.invite-note::placeholder { color: var(--nc-text-dim); }
.invite-recipients:focus,
.invite-note:focus { outline: none; border-color: var(--nc-accent); }
.invite-recipients:disabled,
.invite-note:disabled { opacity: 0.6; cursor: wait; }
.invite-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.invite-hint { font-size: calc(11px * var(--nc-text-scale, 1)); color: var(--nc-text-dim); }
/* Validation error — coral (REDESIGN.md §1 accent discipline) */
.invite-error { font-size: calc(12px * var(--nc-text-scale, 1)); color: var(--nc-coral); }
.invite-status { font-size: calc(12px * var(--nc-text-scale, 1)); color: var(--nc-accent-text); }
.role-icon {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  color: var(--nc-accent-text);
  flex-shrink: 0;
}
.role-icon[data-role="VIEWER"] { color: var(--nc-text-secondary); }
.row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.row-label-line { display: flex; align-items: center; gap: 8px; }
.row-label { font: 500 13px var(--nc-font-body); color: var(--nc-text); }
.role-chip {
  font: 500 10px var(--nc-font-body);
  letter-spacing: 0.02em;
  padding: 1px 7px; border-radius: 4px;
  border: 1px solid var(--nc-border);
  background: var(--nc-chip-bg);
  color: var(--nc-text-secondary);
}
.role-chip[data-role="EDITOR"] {
  color: var(--nc-accent-text);
  background: var(--nc-accent-glow);
  border-color: var(--nc-accent-glow-strong);
}
/* Revoked marker — coral (REDESIGN.md §1 accent discipline) */
.role-chip[data-role="REVOKED"] {
  color: var(--nc-coral);
  background: rgba(var(--nc-coral-rgb), 0.1);
  border-color: rgba(var(--nc-coral-rgb), 0.25);
}
.row-meta {
  display: flex; align-items: center; gap: 6px;
  font: 400 11px var(--nc-font-body);
  color: var(--nc-text-muted);
}
.row-meta .token { font-family: var(--nc-font-mono); }
.row-meta .dot { width: 2px; height: 2px; border-radius: 50%; background: var(--nc-text-dim); }
.error { padding: 16px 24px; color: var(--nc-coral); font-size: calc(12px * var(--nc-text-scale, 1)); }
.loading, .empty { padding: 16px 24px; color: var(--nc-text-muted); font-size: calc(12px * var(--nc-text-scale, 1)); }
.modal-foot {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 24px;
  background: var(--nc-bg);
  border-top: 1px solid var(--nc-border);
  font: 400 11px var(--nc-font-body);
  color: var(--nc-text-muted);
}
</style>
