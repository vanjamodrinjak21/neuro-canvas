// ---------------------------------------------------------------------------
// Background map-generation queue.
//
// The blocking full-screen "Generiranje…" modal used to trap the user on the
// dashboard for the full 20–60s of an AI map generation. This manager moves
// that work into the background so the user can navigate the app freely while
// a map builds, watch progress in a corner dock, and get a notification when
// it's done.
//
// SAFETY — why this never clobbers the open map:
//   The slow part, `ai.generateMapStructure()`, is PURE with respect to app
//   state: it resolves a provider, calls the LLM, and returns a MapStructure.
//   It never touches the singleton `mapStore`. So a job can run while the user
//   has a completely different map open in the editor.
//   MATERIALIZATION (structure → real nodes via the shared mapStore singleton)
//   is DEFERRED to `openJob()`, which mirrors the dashboard's proven
//   newDocument → render → save → navigate flow. The transient write to the
//   singleton is immediately followed by navigation to the new map, so any
//   previously-open (already auto-saved) map is simply torn down — never
//   silently overwritten.
//
// DURABILITY: a 'running' job lives only in memory (its Promise dies on a full
// page reload), so it survives in-app SPA navigation but not a hard refresh.
// 'ready' / 'error' jobs are persisted to localStorage so a finished-but-
// unopened map isn't lost across reloads. (A server-side BullMQ worker — the
// infra already exists for document ingestion — is the follow-up for true
// closed-tab durability.)
// ---------------------------------------------------------------------------

import type { MapGenerationOptions, MapStructure } from '~/types/ai-generation'
import { useAI } from '~/composables/useAI'
import { useMapStore } from '~/stores/mapStore'
import { useMapRenderer } from '~/composables/useMapRenderer'
import { useDatabase } from '~/composables/useDatabase'
import { useSyncEngine } from '~/composables/useSyncEngine'

export type GenJobStatus = 'running' | 'ready' | 'error'

export interface GenJob {
  id: string
  topic: string
  title: string
  options: MapGenerationOptions
  status: GenJobStatus
  /** 0..1 — smooth creep while the LLM call is in flight, snaps to 1 on done. */
  progress: number
  structure: MapStructure | null
  error: string | null
  /** Set once the map has been materialized + opened. */
  mapId: string | null
  createdAt: number
  /** Dock side-effect guard so a toast/notification fires exactly once. */
  notified: boolean
}

const STORAGE_KEY = 'nc:generation-queue'
const MAX_PERSISTED = 12

// ── Module-singleton state (shared across every useGenerationQueue() caller) ──
const jobs = ref<GenJob[]>([])
const activeTimers = new Map<string, ReturnType<typeof setInterval>>()
let initialized = false

function genId(): string {
  return `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function persist() {
  if (typeof window === 'undefined') return
  try {
    // Persist only settled jobs — a 'running' job's Promise can't survive a
    // reload, so it would be a permanently-stuck ghost.
    const settled = jobs.value
      .filter(j => j.status !== 'running')
      .slice(-MAX_PERSISTED)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settled))
  } catch {
    /* quota / private mode — non-fatal, the dock just won't survive reload */
  }
}

function restoreOnce() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as GenJob[]
    if (Array.isArray(saved)) {
      // Mark notified so restored jobs don't re-fire a stale "done" toast.
      jobs.value = saved.map(j => ({ ...j, notified: true }))
    }
  } catch {
    /* corrupt payload — start clean */
  }
}

export function useGenerationQueue() {
  // Obtained in (component) setup context — useGenerationQueue() MUST only be
  // called from a component's setup (the dock in app.vue, the dashboard, …),
  // never at module top-level. The instances are cheap singleton wrappers.
  const ai = useAI()
  const mapStore = useMapStore()
  const mapRenderer = useMapRenderer()
  const db = useDatabase()
  const sync = useSyncEngine()

  restoreOnce()

  const activeJobs = computed(() => jobs.value.filter(j => j.status === 'running'))
  const hasJobs = computed(() => jobs.value.length > 0)

  /** Best-effort: ask for OS notification permission on a real user gesture. */
  function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }

  /**
   * Queue a new background map generation. Returns the job id immediately; the
   * LLM call runs detached so the caller (and the page) is free to move on.
   */
  function enqueueMapGeneration(
    topic: string,
    options: MapGenerationOptions = {},
    title?: string,
  ): string {
    requestNotificationPermission()

    const job = reactive<GenJob>({
      id: genId(),
      topic: topic.trim(),
      title: (title ?? topic).trim(),
      options,
      status: 'running',
      progress: 0.06,
      structure: null,
      error: null,
      mapId: null,
      createdAt: Date.now(),
      notified: false,
    })
    jobs.value = [...jobs.value, job]

    void runJob(job)
    return job.id
  }

  async function runJob(job: GenJob) {
    // Smooth progress creep toward 0.9 while the LLM call is in flight. As a
    // floor it climbs on a timer; streamed tokens (below) nudge it faster.
    const timer = setInterval(() => {
      job.progress = Math.min(0.9, job.progress + (0.9 - job.progress) * 0.16)
    }, 650)
    activeTimers.set(job.id, timer)

    try {
      // STREAM the generation. A big map can take >100s, which blows Cloudflare's
      // ~100s edge timeout on the non-streaming /api/ai/completions path (HTTP
      // 524). Streaming via /api/ai/stream returns headers immediately and keeps
      // bytes flowing, so the edge never idle-times-out. onPartialResult also
      // gives us real progress from the growing response.
      const structure = await ai.generateMapStructure(job.topic, job.options, {
        stream: true,
        onPartialResult: (partial) => {
          // Heuristic: a typical map JSON is a few KB; map length → 0.15..0.9.
          const est = Math.min(0.9, 0.15 + partial.length / 6000)
          if (est > job.progress) job.progress = est
        },
      })
      job.structure = structure
      job.progress = 1
      job.status = 'ready'
    } catch (e) {
      job.error = e instanceof Error ? e.message : 'Generation failed'
      job.status = 'error'
    } finally {
      clearInterval(timer)
      activeTimers.delete(job.id)
      persist()
    }
  }

  /** Re-run a failed job from scratch. */
  function retry(id: string) {
    const job = jobs.value.find(j => j.id === id)
    if (!job || job.status === 'running') return
    job.status = 'running'
    job.error = null
    job.progress = 0.06
    job.notified = false
    persist()
    void runJob(job)
  }

  /** Remove a job from the dock. */
  function dismiss(id: string) {
    const timer = activeTimers.get(id)
    if (timer) {
      clearInterval(timer)
      activeTimers.delete(id)
    }
    jobs.value = jobs.value.filter(j => j.id !== id)
    persist()
  }

  /**
   * Materialize a finished job into a real map and open it.
   *
   * This is the ONLY place that touches the singleton mapStore. It mirrors the
   * dashboard's create-from-structure flow and is immediately followed by
   * navigation, so it never silently clobbers an open map.
   */
  async function openJob(id: string): Promise<void> {
    const job = jobs.value.find(j => j.id === id)
    if (!job || !job.structure) return

    // Already built once (e.g. opened, came back) → just navigate.
    if (job.mapId) {
      await navigateTo(`/map/${job.mapId}`)
      return
    }

    mapStore.newDocument()
    mapStore.setTitle(job.title || job.topic)
    mapRenderer.renderMapStructure(job.structure, { x: 0, y: 0 })

    const doc = mapStore.toSerializable()
    await db.saveMap(doc)
    if (sync.isSyncEnabled.value) sync.debouncedPush(doc.id)

    job.mapId = doc.id
    persist()

    await navigateTo(`/map/${doc.id}`)
  }

  return {
    jobs,
    activeJobs,
    hasJobs,
    enqueueMapGeneration,
    openJob,
    retry,
    dismiss,
  }
}
