<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { userFriendlyError } from '~/utils/userFriendlyError'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { useConfirmDialog } from '~/composables/useConfirmDialog'

interface CommentRow {
  id: string
  threadId: string
  authorId: string
  authorName: string
  authorColor: string
  body: string
  anchorNodeId: string | null
  anchorX: number | null
  anchorY: number | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{ mapId: string; viaToken?: string | null; canWrite?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t, locale } = useI18n()

// Every comment mutation (add/reply/resolve/reopen/delete) is a server call —
// gate them when offline. Reading cached threads still works offline.
const { isOnline } = useSyncEngine()
const offlineHint = computed(() => (isOnline.value ? undefined : t('common.offline.action_unavailable')))

const { confirm, ConfirmDialog } = useConfirmDialog()

const comments = ref<CommentRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const composing = ref('')
const submitting = ref(false)

const queryParam = computed(() => (props.viaToken ? `?via=${encodeURIComponent(props.viaToken)}` : ''))

async function load() {
  loading.value = true
  error.value = null
  try {
    comments.value = await $fetch<CommentRow[]>(`/api/maps/${props.mapId}/comments${queryParam.value}`)
  } catch (e: unknown) {
    console.error('[comments] load failed', e)
    error.value = userFriendlyError(e, t)
  } finally {
    loading.value = false
  }
}

async function submitNew() {
  const body = composing.value.trim()
  if (!body || !isOnline.value) return
  submitting.value = true
  error.value = null
  try {
    const created = await $fetch<CommentRow>(`/api/maps/${props.mapId}/comments${queryParam.value}`, {
      method: 'POST',
      body: { body, threadId: null, anchorNodeId: null, anchorX: null, anchorY: null, mentions: [] }
    })
    comments.value = [...comments.value, created]
    composing.value = ''
  } catch (e: unknown) {
    console.error('[comments] submit failed', e)
    error.value = userFriendlyError(e, t)
  } finally {
    submitting.value = false
  }
}

async function replyTo(threadId: string, body: string) {
  const trimmed = body.trim()
  if (!trimmed || !isOnline.value) return
  try {
    const created = await $fetch<CommentRow>(`/api/maps/${props.mapId}/comments${queryParam.value}`, {
      method: 'POST',
      body: { body: trimmed, threadId, anchorNodeId: null, anchorX: null, anchorY: null, mentions: [] }
    })
    comments.value = [...comments.value, created]
  } catch (e: unknown) {
    console.error('[comments] reply failed', e)
    error.value = userFriendlyError(e, t)
  }
}

async function resolveThread(threadId: string) {
  try {
    await $fetch(`/api/maps/${props.mapId}/comments/${threadId}/resolve${queryParam.value}`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    const now = new Date().toISOString()
    comments.value = comments.value.map(c => c.threadId === threadId ? { ...c, resolvedAt: now } : c)
  } catch (e: unknown) {
    console.error('[comments] resolve failed', e)
    error.value = userFriendlyError(e, t)
  }
}
async function reopenThread(threadId: string) {
  try {
    await $fetch(`/api/maps/${props.mapId}/comments/${threadId}/reopen${queryParam.value}`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    comments.value = comments.value.map(c => c.threadId === threadId ? { ...c, resolvedAt: null } : c)
  } catch (e: unknown) {
    console.error('[comments] reopen failed', e)
    error.value = userFriendlyError(e, t)
  }
}

async function deleteComment(commentId: string) {
  const confirmed = await confirm({
    title: t('canvas.comments.delete_confirm'),
    confirmText: t('common.buttons.delete'),
    cancelText: t('common.buttons.cancel'),
    variant: 'danger',
    icon: 'i-lucide-trash-2'
  })
  if (!confirmed) return
  try {
    await $fetch(`/api/maps/${props.mapId}/comments/${commentId}${queryParam.value}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    comments.value = comments.value.filter(c => c.id !== commentId)
  } catch (e: unknown) {
    console.error('[comments] delete failed', e)
    error.value = userFriendlyError(e, t)
  }
}

interface Thread {
  id: string
  messages: CommentRow[]
  resolvedAt: string | null
  anchorNodeId: string | null
  anchorX: number | null
  anchorY: number | null
}

const threads = computed(() => {
  const grouped = new Map<string, Thread>()
  for (const c of comments.value) {
    const t = grouped.get(c.threadId)
    if (t) {
      t.messages.push(c)
      if (c.resolvedAt) t.resolvedAt = c.resolvedAt
    } else {
      grouped.set(c.threadId, {
        id: c.threadId,
        messages: [c],
        resolvedAt: c.resolvedAt,
        anchorNodeId: c.anchorNodeId,
        anchorX: c.anchorX,
        anchorY: c.anchorY
      })
    }
  }
  for (const t of grouped.values()) {
    t.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }
  return Array.from(grouped.values())
})

const openThreads = computed(() => threads.value.filter(t => !t.resolvedAt))
const resolvedThreads = computed(() => threads.value.filter(t => t.resolvedAt))

const dateFmt = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' })
)
function fmt(iso: string) { return dateFmt.value.format(new Date(iso)) }

const replyDrafts = ref<Record<string, string>>({})
function onReplyKey(ev: KeyboardEvent, threadId: string) {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
    ev.preventDefault()
    const v = replyDrafts.value[threadId] ?? ''
    replyTo(threadId, v).then(() => { replyDrafts.value[threadId] = '' })
  }
}
function onComposeKey(ev: KeyboardEvent) {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
    ev.preventDefault()
    submitNew()
  }
}

onMounted(load)

// ESC closes the panel — users expect this from any modal/side rail
onKeyStroke('Escape', () => emit('close'))
</script>

<template>
  <aside class="cm-panel" role="dialog" aria-modal="true" :aria-label="t('canvas.comments.title')">
    <header class="cm-header">
      <h2>{{ t('canvas.comments.title') }}</h2>
      <button class="cm-close" :aria-label="t('canvas.comments.close')" @click="emit('close')">
        <span class="i-lucide-x" />
      </button>
    </header>

    <div v-if="error" class="cm-error">{{ error }}</div>
    <div v-if="loading" class="cm-state">{{ t('canvas.comments.loading') }}</div>

    <div v-else class="cm-body">
      <!-- New thread composer -->
      <section v-if="canWrite !== false" class="cm-compose">
        <textarea
          v-model="composing"
          class="cm-textarea"
          :placeholder="t('canvas.comments.compose_placeholder')"
          rows="3"
          @keydown="onComposeKey"
        />
        <div class="cm-compose-row">
          <span class="cm-hint">{{ offlineHint ?? t('canvas.comments.submit_hint') }}</span>
          <button class="cm-submit" :disabled="!composing.trim() || submitting || !isOnline" :title="offlineHint" @click="submitNew">
            {{ t('canvas.comments.submit') }}
          </button>
        </div>
      </section>

      <!-- Open threads -->
      <section v-if="openThreads.length" class="cm-section">
        <h3 class="cm-section-title">{{ t('canvas.comments.section_open') }}</h3>
        <article v-for="th in openThreads" :key="th.id" class="cm-thread">
          <div class="cm-thread-anchor">
            <template v-if="th.anchorNodeId">
              {{ t('canvas.comments.anchor_node') }}
            </template>
            <template v-else>
              {{ t('canvas.comments.anchor_canvas') }}
            </template>
          </div>
          <div v-for="m in th.messages" :key="m.id" class="cm-msg">
            <div class="cm-msg-head">
              <span class="cm-author-dot" :style="{ backgroundColor: m.authorColor }" />
              <span class="cm-author-name">{{ m.authorName }}</span>
              <span class="cm-msg-time">{{ fmt(m.createdAt) }}</span>
            </div>
            <div class="cm-msg-body">{{ m.body }}</div>
            <div class="cm-msg-actions">
              <button class="cm-link" :disabled="!isOnline" :title="offlineHint" @click="deleteComment(m.id)">{{ t('canvas.comments.delete') }}</button>
            </div>
          </div>
          <div v-if="canWrite !== false" class="cm-reply">
            <textarea
              :value="replyDrafts[th.id] ?? ''"
              :placeholder="t('canvas.comments.compose_placeholder')"
              class="cm-textarea cm-textarea-reply"
              rows="2"
              @input="(e) => (replyDrafts[th.id] = (e.target as HTMLTextAreaElement).value)"
              @keydown="(e) => onReplyKey(e, th.id)"
            />
            <button class="cm-link cm-resolve" :disabled="!isOnline" :title="offlineHint" @click="resolveThread(th.id)">
              {{ t('canvas.comments.resolve') }}
            </button>
          </div>
        </article>
      </section>
      <p v-else class="cm-state">{{ t('canvas.comments.empty_open') }}</p>

      <!-- Resolved threads -->
      <section v-if="resolvedThreads.length" class="cm-section cm-section-resolved">
        <h3 class="cm-section-title">{{ t('canvas.comments.section_resolved') }}</h3>
        <article v-for="th in resolvedThreads" :key="th.id" class="cm-thread cm-thread-resolved">
          <div v-for="m in th.messages" :key="m.id" class="cm-msg">
            <div class="cm-msg-head">
              <span class="cm-author-dot" :style="{ backgroundColor: m.authorColor }" />
              <span class="cm-author-name">{{ m.authorName }}</span>
              <span class="cm-msg-time">{{ fmt(m.createdAt) }}</span>
            </div>
            <div class="cm-msg-body">{{ m.body }}</div>
          </div>
          <button v-if="canWrite !== false" class="cm-link" :disabled="!isOnline" :title="offlineHint" @click="reopenThread(th.id)">
            {{ t('canvas.comments.reopen') }}
          </button>
        </article>
      </section>
    </div>
  </aside>
  <component :is="ConfirmDialog" />
</template>

<style scoped>
.cm-panel {
  position: fixed; top: 64px; right: 0; bottom: 0;
  width: 380px;
  background: #111113; border-left: 1px solid #27272A;
  color: #FAFAFA;
  display: flex; flex-direction: column;
  z-index: 120;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.18);
}
.cm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid #27272A;
}
.cm-header h2 { font-size: calc(14px * var(--nc-text-scale, 1)); font-weight: 600; margin: 0; }
.cm-close {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid transparent;
  border-radius: 6px;
  color: var(--nc-ink-soft, #A1A1AA);
  font-size: calc(16px * var(--nc-text-scale, 1)); cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.cm-close:hover {
  color: var(--nc-ink, #FAFAFA);
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--nc-border, #27272A);
}
.cm-close:focus-visible {
  outline: none;
  border-color: var(--nc-accent, #00D2BE);
}

.cm-error {
  margin: 12px 20px; padding: 10px 12px;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.4);
  border-radius: 6px; font-size: calc(12px * var(--nc-text-scale, 1)); color: #FCA5A5;
}
.cm-state { padding: 28px 20px; color: #71717A; font-size: calc(13px * var(--nc-text-scale, 1)); }
.cm-body { overflow-y: auto; padding: 16px 20px 24px; flex: 1; }

.cm-compose { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #1A1A1D; }
.cm-textarea {
  width: 100%; box-sizing: border-box;
  background: #161618; border: 1px solid #27272A; border-radius: 6px;
  color: #FAFAFA; padding: 8px 10px; font: inherit; font-size: calc(13px * var(--nc-text-scale, 1));
  resize: vertical; min-height: 60px;
}
.cm-textarea:focus { outline: none; border-color: #3DD9D6; }
.cm-compose-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 6px;
}
.cm-hint { font-size: calc(11px * var(--nc-text-scale, 1)); color: #71717A; }
.cm-submit {
  background: #3DD9D6; color: #0D0D0F; border: none; border-radius: 4px;
  padding: 6px 14px; font-size: calc(12px * var(--nc-text-scale, 1)); font-weight: 600; cursor: pointer;
}
.cm-submit:disabled { opacity: 0.4; cursor: not-allowed; }

.cm-section { margin-bottom: 24px; }
.cm-section-title {
  font-size: calc(11px * var(--nc-text-scale, 1)); text-transform: uppercase; letter-spacing: 0.08em;
  color: #71717A; margin: 0 0 8px; font-weight: 600;
}
.cm-thread {
  border: 1px solid #1A1A1D; border-radius: 6px; padding: 10px 12px;
  background: #0D0D0F; margin-bottom: 8px;
}
.cm-thread-anchor {
  font-size: calc(10px * var(--nc-text-scale, 1)); color: #71717A; margin-bottom: 6px;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.cm-msg + .cm-msg { margin-top: 10px; padding-top: 10px; border-top: 1px solid #1A1A1D; }
.cm-msg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.cm-author-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.cm-author-name { font-size: calc(12px * var(--nc-text-scale, 1)); font-weight: 500; }
.cm-msg-time { font-size: calc(11px * var(--nc-text-scale, 1)); color: #71717A; margin-left: auto; }
.cm-msg-body { font-size: calc(13px * var(--nc-text-scale, 1)); color: #E4E4E7; white-space: pre-wrap; word-break: break-word; }
.cm-msg-actions { margin-top: 4px; }

.cm-link {
  background: none; border: none; color: #71717A;
  font-size: calc(11px * var(--nc-text-scale, 1)); cursor: pointer; padding: 2px 4px;
}
.cm-link:hover:not(:disabled) { color: #A1A1AA; }
.cm-link:disabled { opacity: 0.4; cursor: not-allowed; }
.cm-resolve { color: #3DD9D6; }

.cm-reply { margin-top: 8px; }
.cm-textarea-reply { min-height: 40px; }

.cm-thread-resolved { opacity: 0.6; }
</style>
