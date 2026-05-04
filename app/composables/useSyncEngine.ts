import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { useDeviceId } from '~/composables/useDeviceId'
import { generateChecksum } from '~/utils/syncChecksum'
import { useMapStore } from '~/stores/mapStore'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'disabled'

export interface SyncConflict {
  mapId: string
  localTitle: string
  remoteTitle: string
  localNodeCount: number
  remoteNodeCount: number
  localUpdatedAt: number
  remoteUpdatedAt: number
}

// Singleton state
const state = reactive<{
  syncStatus: SyncStatus
  lastSyncAt: number | null
  pendingChanges: number
  isInitialized: boolean
}>({
  syncStatus: 'disabled',
  lastSyncAt: null,
  pendingChanges: 0,
  isInitialized: false
})

// Debounce timers
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>()
let eventSource: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0

function _isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

function _isCapacitor(): boolean {
  return typeof window !== 'undefined' && 'Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.()
}

const REMOTE_BASE = 'https://neuro-canvas.com'

/**
 * Fetch wrapper that uses native HTTP for remote API calls:
 * - Tauri: @tauri-apps/plugin-http (has auth cookies in native cookie jar)
 * - Capacitor: CapacitorHttp (bypasses CORS, native cookie jar)
 * - Web: $fetch (same-origin, session cookie in browser)
 */
async function syncFetch<T>(path: string, options?: { method?: string; body?: unknown; params?: Record<string, string | undefined> }): Promise<T> {
  if (_isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    let url = `${REMOTE_BASE}${path}`
    if (options?.params) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined) qs.set(k, v)
      }
      const qsStr = qs.toString()
      if (qsStr) url += `?${qsStr}`
    }
    const res = await tauriFetch(url, {
      method: options?.method || 'GET',
      headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    })
    if (!res.ok) {
      const err: any = new Error(`Sync fetch failed: ${res.status}`)
      err.statusCode = res.status
      throw err
    }
    return res.json() as Promise<T>
  }

  if (_isCapacitor()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    let url = `${REMOTE_BASE}${path}`
    if (options?.params) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined) qs.set(k, v)
      }
      const qsStr = qs.toString()
      if (qsStr) url += `?${qsStr}`
    }

    // Attach the JWT as an explicit Cookie header — CapacitorHttp's cookie
    // jar can't be relied on for cookies that crossed the WebView boundary.
    const headers: Record<string, string> = {}
    if (options?.body) headers['Content-Type'] = 'application/json'
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('nc-mobile-session') : null
      if (stored) {
        const data = JSON.parse(stored)
        if (data?.token && data?.cookieName) {
          headers.Cookie = `${data.cookieName}=${data.token}`
        }
      }
    } catch { /* ignore malformed storage */ }

    const res = await CapacitorHttp.request({
      url,
      method: options?.method || 'GET',
      headers,
      data: options?.body,
    })
    if (res.status < 200 || res.status >= 300) {
      const err: any = new Error(`Sync fetch failed: ${res.status}`)
      err.statusCode = res.status
      throw err
    }
    return (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as T
  }

  // Web mode: use $fetch (same-origin)
  return ($fetch as any)(path, {
    method: options?.method || 'GET',
    body: options?.body,
    params: options?.params,
  })
}

export function useSyncEngine() {
  const db = useDatabase()
  const { deviceId } = useDeviceId()

  // Auth gate: sync only when logged in
  // Native apps: check desktop/mobile auth state (signed in via native HTTP plugin)
  const desktopAuth = _isTauri() ? useDesktopAuth() : null
  const mobileAuth = _isCapacitor() ? useMobileAuth() : null
  const _isNative = _isTauri() || _isCapacitor()
  const _nativeSession = _isNative ? { user: null } : null
  const { data: _sessionData } = _nativeSession
    ? { data: ref(_nativeSession) }
    : useAuth()
  const session = _sessionData ?? ref(null)

  const currentUserId = computed(() => {
    // Tauri: use desktop auth user id
    if (desktopAuth?.isSignedIn.value && desktopAuth.user.value?.id) {
      return desktopAuth.user.value.id
    }
    // Capacitor: use mobile auth user id
    if (mobileAuth?.isSignedIn.value && mobileAuth.user.value?.id) {
      return mobileAuth.user.value.id
    }
    return (session.value?.user as { id?: string })?.id || null
  })

  const isSyncEnabled = computed(() => {
    return !!currentUserId.value
  })

  // Online state
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { isOnline.value = true })
    window.addEventListener('offline', () => { isOnline.value = false })
  }

  // ─── Push ────────────────────────────────────────────────────────

  async function pushMap(mapId: string): Promise<void> {
    if (!isSyncEnabled.value) return

    const doc = await db.getMap(mapId)
    if (!doc) return

    const checksum = await generateChecksum(doc)

    state.syncStatus = 'syncing'

    try {
      const response = await syncFetch<{ ok: boolean; syncVersion?: number; noChange?: boolean }>('/api/sync/push', {
        method: 'POST',
        body: {
          mapId: doc.id,
          data: {
            nodes: doc.nodes,
            edges: doc.edges,
            camera: doc.camera,
            settings: doc.settings,
            rootNodeId: doc.rootNodeId
          },
          title: doc.title,
          syncVersion: doc.syncVersion || 0,
          checksum,
          deviceId,
          preview: doc.preview,
          tags: doc.tags
        }
      })

      if (response.ok && response.syncVersion) {
        await db.updateMapSyncVersion(mapId, response.syncVersion, checksum)
      }

      state.syncStatus = 'idle'
      state.lastSyncAt = Date.now()
      await db.saveSyncMeta({ lastSyncAt: Date.now() })
      state.pendingChanges = await db.countPendingSyncOps()
    } catch (err: any) {
      const statusCode = err?.statusCode || err?.response?.status

      if (statusCode === 401) {
        // Session expired — don't queue, don't retry, just stop syncing
        state.syncStatus = 'error'
        disconnectSSE()
      } else if (statusCode === 423) {
        setTimeout(() => pushMap(mapId), 2000)
      } else if (statusCode === 429) {
        state.syncStatus = 'error'
      } else {
        await queueForLater(mapId, 'push')
        state.syncStatus = isOnline.value ? 'error' : 'offline'
      }
    }
  }

  function debouncedPush(mapId: string): void {
    if (!isSyncEnabled.value) return

    const existing = pushTimers.get(mapId)
    if (existing) clearTimeout(existing)

    pushTimers.set(mapId, setTimeout(() => {
      pushTimers.delete(mapId)
      pushMap(mapId)
    }, 5000))
  }

  // ─── Pull ────────────────────────────────────────────────────────

  async function pullChanges(): Promise<void> {
    if (!isSyncEnabled.value) return

    state.syncStatus = 'syncing'

    try {
      const meta = await db.getSyncMeta()
      const since = meta?.lastSyncAt ? new Date(meta.lastSyncAt).toISOString() : undefined

      const response = await syncFetch<{ maps: any[]; deleted: string[] }>('/api/sync/pull', {
        params: { since }
      })

      // Merge server maps into IndexedDB — tagged with current userId
      for (const serverMap of response.maps) {
        const localMap = await db.getMap(serverMap.id)

        if (!localMap || (serverMap.syncVersion > (localMap.syncVersion || 0))) {
          // Server is newer or map is new — save locally
          await db.saveMap({
            id: serverMap.id,
            title: serverMap.title,
            nodes: serverMap.data.nodes || [],
            edges: serverMap.data.edges || [],
            camera: serverMap.data.camera || { x: 0, y: 0, zoom: 1 },
            settings: serverMap.data.settings || {},
            rootNodeId: serverMap.data.rootNodeId,
            preview: serverMap.preview,
            tags: serverMap.tags || [],
            createdAt: new Date(serverMap.createdAt).getTime(),
            updatedAt: new Date(serverMap.updatedAt).getTime(),
            syncVersion: serverMap.syncVersion,
            checksum: serverMap.checksum,
            userId: currentUserId.value || undefined
          } as DBMapDocument)
        }
      }

      // Remove deleted maps from IndexedDB
      for (const deletedId of response.deleted) {
        await db.deleteMap(deletedId)
      }

      state.syncStatus = 'idle'
      state.lastSyncAt = Date.now()
      await db.saveSyncMeta({ lastSyncAt: Date.now() })
    } catch {
      state.syncStatus = isOnline.value ? 'error' : 'offline'
    }
  }

  async function pullMap(mapId: string): Promise<void> {
    if (!isSyncEnabled.value) return

    try {
      const response = await syncFetch<{ maps: any[]; deleted: string[] }>('/api/sync/pull', {
        params: { mapId }
      })

      if (response.maps.length > 0) {
        const serverMap = response.maps[0]
        const localMap = await db.getMap(serverMap.id)

        if (!localMap || (serverMap.syncVersion > (localMap.syncVersion || 0))) {
          await db.saveMap({
            id: serverMap.id,
            title: serverMap.title,
            nodes: serverMap.data.nodes || [],
            edges: serverMap.data.edges || [],
            camera: serverMap.data.camera || { x: 0, y: 0, zoom: 1 },
            settings: serverMap.data.settings || {},
            rootNodeId: serverMap.data.rootNodeId,
            preview: serverMap.preview,
            tags: serverMap.tags || [],
            createdAt: new Date(serverMap.createdAt).getTime(),
            updatedAt: new Date(serverMap.updatedAt).getTime(),
            syncVersion: serverMap.syncVersion,
            checksum: serverMap.checksum,
            userId: currentUserId.value || undefined
          } as DBMapDocument)

          // If this map is currently open, reload it in the store
          const mapStore = useMapStore()
          if (mapStore.id === mapId) {
            const updated = await db.getMap(mapId)
            if (updated) mapStore.fromSerializable(updated)
          }
        }
      }

      for (const deletedId of response.deleted) {
        await db.deleteMap(deletedId)
      }
    } catch {
      // Silent — SSE will retry
    }
  }

  // ─── SSE ─────────────────────────────────────────────────────────

  function connectSSE(): void {
    if (!isSyncEnabled.value || typeof EventSource === 'undefined') return
    disconnectSSE()

    // Native apps: SSE won't work (no same-origin server). Use periodic polling instead.
    if (_isTauri() || _isCapacitor()) {
      startTauriPolling()
      return
    }

    const url = `/api/sync/stream?deviceId=${encodeURIComponent(deviceId)}`
    eventSource = new EventSource(url)

    eventSource.addEventListener('sync', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data)
        if (data.mapId) {
          pullMap(data.mapId)
        }
      } catch {
        // Malformed event
      }
    })

    eventSource.addEventListener('connected', () => {
      reconnectAttempts = 0
    })

    eventSource.onerror = () => {
      disconnectSSE()

      // Stop reconnecting after too many attempts (likely auth failure, not transient)
      if (reconnectAttempts >= 5) {
        state.syncStatus = 'error'
        return
      }

      // Only reconnect if we still have an active session
      if (!isSyncEnabled.value) {
        state.syncStatus = 'disabled'
        return
      }

      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000)
      reconnectAttempts++
      reconnectTimer = setTimeout(connectSSE, delay)
    }
  }

  // Tauri: periodic pull instead of SSE
  let tauriPollTimer: ReturnType<typeof setInterval> | null = null
  function startTauriPolling(): void {
    if (tauriPollTimer) return
    tauriPollTimer = setInterval(() => {
      if (isSyncEnabled.value && isOnline.value) {
        pullChanges().catch(() => {})
      }
    }, 30000) // Poll every 30s
  }
  function stopTauriPolling(): void {
    if (tauriPollTimer) {
      clearInterval(tauriPollTimer)
      tauriPollTimer = null
    }
  }

  function disconnectSSE(): void {
    stopTauriPolling()
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  // ─── Offline Queue ───────────────────────────────────────────────

  async function queueForLater(mapId: string, action: 'push' | 'delete'): Promise<void> {
    await db.addToSyncQueue({
      mapId,
      action,
      status: 'pending',
      retries: 0,
      createdAt: Date.now()
    })
    state.pendingChanges = await db.countPendingSyncOps()
  }

  async function replayQueue(): Promise<void> {
    if (!isSyncEnabled.value || !isOnline.value) return

    const ops = await db.getPendingSyncOps()
    for (const op of ops) {
      try {
        await db.updateSyncQueueEntry(op.id!, { status: 'processing', lastAttempt: Date.now() })

        if (op.action === 'push') {
          await pushMap(op.mapId)
        } else if (op.action === 'delete') {
          await syncFetch('/api/sync/push', {
            method: 'POST',
            body: { mapId: op.mapId, data: {}, title: '', checksum: '', action: 'delete', deviceId }
          })
        }

        await db.removeSyncQueueEntry(op.id!)
      } catch {
        const retries = (op.retries || 0) + 1
        if (retries >= 5) {
          await db.updateSyncQueueEntry(op.id!, { status: 'failed', retries })
        } else {
          await db.updateSyncQueueEntry(op.id!, { status: 'pending', retries })
        }
      }
    }

    state.pendingChanges = await db.countPendingSyncOps()
  }

  // ─── Full Sync ───────────────────────────────────────────────────

  async function fullSync(): Promise<void> {
    if (!isSyncEnabled.value) return

    state.syncStatus = 'syncing'

    try {
      // Push all local maps that have no syncVersion (never synced)
      // Only push maps belonging to the current user to prevent cross-account leakage
      const allMaps = await db.getAllMaps()
      const unsyncedMaps = allMaps.filter(m =>
        !m.syncVersion &&
        (!m.userId || m.userId === currentUserId.value)
      )

      if (unsyncedMaps.length > 0) {
        // Bulk push
        const maps = await Promise.all(unsyncedMaps.map(async (doc) => ({
          mapId: doc.id,
          data: {
            nodes: doc.nodes,
            edges: doc.edges,
            camera: doc.camera,
            settings: doc.settings,
            rootNodeId: doc.rootNodeId
          },
          title: doc.title,
          syncVersion: 0,
          checksum: await generateChecksum(doc)
        })))

        try {
          await syncFetch('/api/sync/bulk-push', {
            method: 'POST',
            body: { maps, deviceId }
          })
        } catch {
          // Fallback: push one by one
          for (const doc of unsyncedMaps) {
            await pushMap(doc.id).catch(() => {})
          }
        }
      }

      // Then pull everything from server
      await pullChanges()
    } catch {
      state.syncStatus = isOnline.value ? 'error' : 'offline'
    }
  }

  // ─── Initialize ──────────────────────────────────────────────────

  async function initialize(): Promise<void> {
    if (state.isInitialized && isSyncEnabled.value) return

    if (!isSyncEnabled.value) {
      // Don't mark as initialized — when the user signs in later we want
      // the watcher's re-init to actually run (pull maps, open SSE).
      state.syncStatus = 'disabled'
      return
    }

    // Set current user for IndexedDB scoping
    if (currentUserId.value) {
      await db.setCurrentUserId(currentUserId.value)
    }

    state.pendingChanges = await db.countPendingSyncOps()
    state.syncStatus = isOnline.value ? 'idle' : 'offline'

    // Connect SSE for real-time (or polling in Tauri)
    connectSSE()

    // Full sync: push local unsynced maps, then pull remote changes
    if (_isTauri()) {
      await fullSync()
    } else {
      await pullChanges()
    }

    // Replay any offline queue
    await replayQueue()

    state.isInitialized = true
  }

  // ─── Watchers ────────────────────────────────────────────────────

  watch(isOnline, (online) => {
    if (online && isSyncEnabled.value) {
      connectSSE()
      replayQueue()
      state.syncStatus = 'idle'
    } else if (!online) {
      disconnectSSE()
      state.syncStatus = 'offline'
    }
  })

  watch(isSyncEnabled, (enabled) => {
    if (enabled) {
      initialize()
    } else {
      disconnectSSE()
      state.syncStatus = 'disabled'
    }
  })

  // Conflict resolution (stub — conflicts are resolved server-side via LWW)
  const conflicts = ref<SyncConflict[]>([])

  async function resolveConflict(mapId: string, resolution: 'local' | 'remote'): Promise<void> {
    if (resolution === 'local') {
      await pushMap(mapId)
    } else {
      await pullMap(mapId)
    }
    conflicts.value = conflicts.value.filter(c => c.mapId !== mapId)
  }

  return {
    // State
    syncStatus: computed(() => state.syncStatus),
    lastSyncAt: computed(() => state.lastSyncAt),
    pendingChanges: computed(() => state.pendingChanges),
    isSyncEnabled,
    conflicts,

    // Actions
    pushMap,
    debouncedPush,
    pullChanges,
    pullMap,
    fullSync,
    queueForLater,
    replayQueue,
    resolveConflict,
    connectSSE,
    disconnectSSE,
    initialize
  }
}
