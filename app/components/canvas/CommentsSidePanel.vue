<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

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
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to load'
  } finally {
    loading.value = false
  }
}

async function submitNew() {
  const body = composing.value.trim()
  if (!body) return
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
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to post'
  } finally {
    submitting.value = false
  }
}

async function replyTo(threadId: string, body: string) {
  const trimmed = body.trim()
  if (!trimmed) return
  try {
    const created = await $fetch<CommentRow>(`/api/maps/${props.mapId}/comments${queryParam.value}`, {
      method: 'POST',
      body: { body: trimmed, threadId, anchorNodeId: null, anchorX: null, anchorY: null, mentions: [] }
    })
    comments.value = [...comments.value, created]
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to reply'
  }
}

async function resolveThread(threadId: string) {
  try {
    await $fetch(`/api/maps/${props.mapId}/comments/${threadId}/resolve${queryParam.value}`, { method: 'POST' })
    const now = new Date().toISOString()
    comments.value = comments.value.map(c => c.threadId === threadId ? { ...c, resolvedAt: now } : c)
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to resolve'
  }
}
async function reopenThread(threadId: string) {
  try {
    await $fetch(`/api/maps/${props.mapId}/comments/${threadId}/reopen${queryParam.value}`, { method: 'POST' })
    comments.value = comments.value.map(c => c.threadId === threadId ? { ...c, resolvedAt: null } : c)
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to reopen'
  }
}

async function deleteComment(commentId: string) {
  if (!window.confirm(t('canvas.comments.delete_confirm'))) return
  try {
    await $fetch(`/api/maps/${props.mapId}/comments/${commentId}${queryParam.value}`, { method: 'DELETE' })
    comments.value = comments.value.filter(c => c.id !== commentId)
  } catch (e: unknown) {
    const err = e as { statusMessage?: string; message?: string }
    error.value = err.statusMessage || err.message || 'Failed to delete'
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
</script>

<template>
  <aside class="cm-panel" role="dialog" aria-modal="true" :aria-label="t('canvas.comments.title')">
    <header class="cm-header">
      <h2>{{ t('canvas.comments.title') }}</h2>
      <button class="cm-close" :aria-label="t('canvas.comments.close')" @click="emit('close')">×</button>
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
          <span class="cm-hint">{{ t('canvas.comments.submit_hint') }}</span>
          <button class="cm-submit" :disabled="!composing.trim() || submitting" @click="submitNew">
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
              <button class="cm-link" @click="deleteComment(m.id)">{{ t('canvas.comments.delete') }}</button>
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
            <button class="cm-link cm-resolve" @click="resolveThread(th.id)">
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
          <button v-if="canWrite !== false" class="cm-link" @click="reopenThread(th.id)">
            {{ t('canvas.comments.reopen') }}
          </button>
        </article>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.cm-panel {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: 380px;
  background: #111113; border-left: 1px solid #27272A;
  color: #FAFAFA;
  display: flex; flex-direction: column;
  z-index: 100;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
}
.cm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #27272A;
}
.cm-header h2 { font-size: 14px; font-weight: 600; margin: 0; letter-spacing: 0.02em; }
.cm-close {
  background: none; border: none; color: #A1A1AA;
  font-size: 22px; line-height: 1; cursor: pointer; padding: 4px 8px;
}
.cm-close:hover { color: #FAFAFA; }

.cm-error {
  margin: 12px 20px; padding: 10px 12px;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.4);
  border-radius: 6px; font-size: 12px; color: #FCA5A5;
}
.cm-state { padding: 28px 20px; color: #71717A; font-size: 13px; }
.cm-body { overflow-y: auto; padding: 16px 20px 24px; flex: 1; }

.cm-compose { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #1A1A1D; }
.cm-textarea {
  width: 100%; box-sizing: border-box;
  background: #161618; border: 1px solid #27272A; border-radius: 6px;
  color: #FAFAFA; padding: 8px 10px; font: inherit; font-size: 13px;
  resize: vertical; min-height: 60px;
}
.cm-textarea:focus { outline: none; border-color: #3DD9D6; }
.cm-compose-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 6px;
}
.cm-hint { font-size: 11px; color: #71717A; }
.cm-submit {
  background: #3DD9D6; color: #0D0D0F; border: none; border-radius: 4px;
  padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.cm-submit:disabled { opacity: 0.4; cursor: not-allowed; }

.cm-section { margin-bottom: 24px; }
.cm-section-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
  color: #71717A; margin: 0 0 8px; font-weight: 600;
}
.cm-thread {
  border: 1px solid #1A1A1D; border-radius: 6px; padding: 10px 12px;
  background: #0D0D0F; margin-bottom: 8px;
}
.cm-thread-anchor {
  font-size: 10px; color: #71717A; margin-bottom: 6px;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.cm-msg + .cm-msg { margin-top: 10px; padding-top: 10px; border-top: 1px solid #1A1A1D; }
.cm-msg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.cm-author-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.cm-author-name { font-size: 12px; font-weight: 500; }
.cm-msg-time { font-size: 11px; color: #71717A; margin-left: auto; }
.cm-msg-body { font-size: 13px; color: #E4E4E7; white-space: pre-wrap; word-break: break-word; }
.cm-msg-actions { margin-top: 4px; }

.cm-link {
  background: none; border: none; color: #71717A;
  font-size: 11px; cursor: pointer; padding: 2px 4px;
}
.cm-link:hover { color: #A1A1AA; }
.cm-resolve { color: #3DD9D6; }

.cm-reply { margin-top: 8px; }
.cm-textarea-reply { min-height: 40px; }

.cm-thread-resolved { opacity: 0.6; }
</style>
