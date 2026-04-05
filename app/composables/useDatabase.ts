import Dexie, { type EntityTable } from 'dexie'
import type { Camera, MapSettings, Node, Edge, Anchor } from '~/types'
import type { AISettings } from '~/types/ai-settings'
import { DEFAULT_AI_SETTINGS } from '~/types/ai-settings'

// Serializable versions of Node and Edge (without Map types)
export interface DBNode {
  id: string
  type: Node['type']
  position: { x: number; y: number }
  size: { width: number; height: number }
  content: string
  style: Node['style']
  parentId?: string
  collapsed?: boolean
  locked?: boolean
  isRoot?: boolean
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface DBEdge {
  id: string
  sourceId: string
  targetId: string
  style: Edge['style']
  label?: string
  controlPoints?: { x: number; y: number }[]
  sourceAnchor?: Anchor
  targetAnchor?: Anchor
  createdAt: number
  updatedAt: number
}

export interface DBMapDocument {
  id: string
  title: string
  nodes: DBNode[]
  edges: DBEdge[]
  camera: Camera
  settings: MapSettings
  rootNodeId?: string  // ID of the main topic/root node
  preview?: string // Base64 thumbnail
  createdAt: number
  updatedAt: number
  tags: string[]
  syncVersion?: number
  checksum?: string
}

export interface DBSyncQueueEntry {
  id?: number // Auto-increment
  mapId: string
  action: 'push' | 'delete'
  status: 'pending' | 'processing' | 'failed'
  retries: number
  createdAt: number
  lastAttempt?: number
  error?: string
}

export interface DBSyncMeta {
  id: string // 'default'
  deviceId: string
  lastSyncAt: number
  lastStreamId: string
}

export interface DBPreferences {
  id: string
  data: Record<string, unknown>
  updatedAt: number
}

export interface DBEncryptedSecret {
  id: string // Format: providerId
  encryptedValue: string // AES-GCM encrypted API key
  encryptionVersion: number // 1=legacy, 2=KEK, 3=rotated
  createdAt: number
  updatedAt: number
}

export interface DBAISettings {
  id: string // 'default' for main settings
  settings: AISettings
  updatedAt: number
}

export interface DBAICacheEntry {
  key: string
  systemPrompt: string
  userPrompt: string
  response: string
  usage?: unknown
  createdAt: number
  ttl: number
  accessCount: number
  lastAccessed: number
}

export interface DBUserMemory {
  id: string // 'default' for main memory
  data: Record<string, unknown>
  updatedAt: number
}

// Dexie database class
class NeuroCanvasDB extends Dexie {
  maps!: EntityTable<DBMapDocument, 'id'>
  preferences!: EntityTable<DBPreferences, 'id'>
  secrets!: EntityTable<DBEncryptedSecret, 'id'>
  aiSettings!: EntityTable<DBAISettings, 'id'>
  aiCache!: EntityTable<DBAICacheEntry, 'key'>
  userMemory!: EntityTable<DBUserMemory, 'id'>
  syncQueue!: EntityTable<DBSyncQueueEntry, 'id'>
  syncMeta!: EntityTable<DBSyncMeta, 'id'>

  constructor() {
    super('neurocanvas')

    this.version(1).stores({
      maps: 'id, title, updatedAt, createdAt, *tags',
      preferences: 'id'
    })

    // Version 2: Add AI settings tables
    this.version(2).stores({
      maps: 'id, title, updatedAt, createdAt, *tags',
      preferences: 'id',
      secrets: 'id, updatedAt',
      aiSettings: 'id'
    })

    // Version 3: Add AI cache and user memory tables
    this.version(3).stores({
      maps: 'id, title, updatedAt, createdAt, *tags',
      preferences: 'id',
      secrets: 'id, updatedAt',
      aiSettings: 'id',
      aiCache: 'key, createdAt, lastAccessed',
      userMemory: 'id'
    })

    // Version 4: Add sync queue and sync meta tables
    this.version(4).stores({
      maps: 'id, title, updatedAt, createdAt, *tags',
      preferences: 'id',
      secrets: 'id, updatedAt',
      aiSettings: 'id',
      aiCache: 'key, createdAt, lastAccessed',
      userMemory: 'id',
      syncQueue: '++id, mapId, status, createdAt',
      syncMeta: 'id'
    })
  }
}

// Singleton database instance
let db: NeuroCanvasDB | null = null
let dbReadyPromise: Promise<NeuroCanvasDB> | null = null

function getDB(): NeuroCanvasDB {
  if (!db) {
    db = new NeuroCanvasDB()
  }
  return db
}

async function ensureDBReady(): Promise<NeuroCanvasDB> {
  if (!dbReadyPromise) {
    const database = getDB()
    dbReadyPromise = database.open().then(() => database)
  }
  return dbReadyPromise
}

// Database operations
export function useDatabase() {
  const isReady = ref(false)
  const error = ref<Error | null>(null)

  // Initialize database
  async function init(): Promise<void> {
    try {
      const database = getDB()
      await database.open()
      isReady.value = true
    } catch (e) {
      error.value = e as Error
      console.error('Failed to open database:', e)
    }
  }

  // Map operations
  async function getAllMaps(): Promise<DBMapDocument[]> {
    const database = await ensureDBReady()
    return database.maps.orderBy('updatedAt').reverse().toArray()
  }

  async function getMap(id: string): Promise<DBMapDocument | undefined> {
    const database = await ensureDBReady()
    return database.maps.get(id)
  }

  async function saveMap(map: DBMapDocument): Promise<void> {
    const database = await ensureDBReady()
    await database.maps.put(map)
  }

  async function deleteMap(id: string): Promise<void> {
    const database = await ensureDBReady()
    await database.maps.delete(id)
  }

  async function getRecentMaps(limit: number = 20): Promise<DBMapDocument[]> {
    const database = await ensureDBReady()
    return database.maps.orderBy('updatedAt').reverse().limit(limit).toArray()
  }

  async function searchMaps(query: string): Promise<DBMapDocument[]> {
    const database = await ensureDBReady()
    const lowerQuery = query.toLowerCase()
    return database.maps
      .filter(map => map.title.toLowerCase().includes(lowerQuery))
      .toArray()
  }

  // Preferences operations
  async function getPreferences<T extends Record<string, unknown>>(
    key: string,
    defaultValue: T
  ): Promise<T> {
    const database = await ensureDBReady()
    const pref = await database.preferences.get(key)
    return pref ? (pref.data as T) : defaultValue
  }

  async function savePreferences(
    key: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const database = await ensureDBReady()
    await database.preferences.put({
      id: key,
      data,
      updatedAt: Date.now()
    })
  }

  // AI Settings operations
  async function getAISettings(): Promise<AISettings> {
    const database = await ensureDBReady()
    const record = await database.aiSettings.get('default')
    if (record) {
      return record.settings
    }
    // Return default settings
    return {
      ...DEFAULT_AI_SETTINGS,
      updatedAt: Date.now()
    }
  }

  async function saveAISettings(settings: AISettings): Promise<void> {
    const database = await ensureDBReady()
    await database.aiSettings.put({
      id: 'default',
      settings: {
        ...settings,
        updatedAt: Date.now()
      },
      updatedAt: Date.now()
    })
  }

  // Encrypted secrets operations
  async function getSecret(id: string): Promise<string | undefined> {
    const database = await ensureDBReady()
    const record = await database.secrets.get(id)
    return record?.encryptedValue
  }

  async function getSecretWithVersion(id: string): Promise<{ encryptedValue: string; encryptionVersion: number } | undefined> {
    const database = await ensureDBReady()
    const record = await database.secrets.get(id)
    if (!record) return undefined
    return { encryptedValue: record.encryptedValue, encryptionVersion: record.encryptionVersion ?? 1 }
  }

  async function saveSecret(id: string, encryptedValue: string, encryptionVersion: number = 2): Promise<void> {
    const database = await ensureDBReady()
    await database.secrets.put({
      id,
      encryptedValue,
      encryptionVersion,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
  }

  async function deleteSecret(id: string): Promise<void> {
    const database = await ensureDBReady()
    await database.secrets.delete(id)
  }

  async function clearAllSecrets(): Promise<void> {
    const database = await ensureDBReady()
    await database.secrets.clear()
  }

  // ─── Sync Queue Operations ───────────────────────────────────────

  async function addToSyncQueue(entry: Omit<DBSyncQueueEntry, 'id'>): Promise<void> {
    const database = await ensureDBReady()
    // Avoid duplicate entries for same mapId+action
    const existing = await database.syncQueue
      .where('mapId').equals(entry.mapId)
      .and(e => e.action === entry.action && e.status === 'pending')
      .first()
    if (!existing) {
      await database.syncQueue.add(entry as DBSyncQueueEntry)
    }
  }

  async function getPendingSyncOps(): Promise<DBSyncQueueEntry[]> {
    const database = await ensureDBReady()
    return database.syncQueue
      .where('status').equals('pending')
      .sortBy('createdAt')
  }

  async function updateSyncQueueEntry(id: number, updates: Partial<DBSyncQueueEntry>): Promise<void> {
    const database = await ensureDBReady()
    await database.syncQueue.update(id, updates)
  }

  async function removeSyncQueueEntry(id: number): Promise<void> {
    const database = await ensureDBReady()
    await database.syncQueue.delete(id)
  }

  async function countPendingSyncOps(): Promise<number> {
    const database = await ensureDBReady()
    return database.syncQueue.where('status').equals('pending').count()
  }

  // ─── Sync Meta Operations ────────────────────────────────────────

  async function getSyncMeta(): Promise<DBSyncMeta | undefined> {
    const database = await ensureDBReady()
    return database.syncMeta.get('default')
  }

  async function saveSyncMeta(meta: Partial<DBSyncMeta>): Promise<void> {
    const database = await ensureDBReady()
    const existing = await database.syncMeta.get('default')
    await database.syncMeta.put({
      id: 'default',
      deviceId: meta.deviceId || existing?.deviceId || '',
      lastSyncAt: meta.lastSyncAt ?? existing?.lastSyncAt ?? 0,
      lastStreamId: meta.lastStreamId ?? existing?.lastStreamId ?? '0'
    })
  }

  async function updateMapSyncVersion(mapId: string, syncVersion: number, checksum: string): Promise<void> {
    const database = await ensureDBReady()
    await database.maps.update(mapId, { syncVersion, checksum })
  }

  // Initialize on first use if in browser
  if (typeof window !== 'undefined') {
    init()
  }

  return {
    isReady: readonly(isReady),
    error: readonly(error),
    init,
    getAllMaps,
    getMap,
    saveMap,
    deleteMap,
    getRecentMaps,
    searchMaps,
    getPreferences,
    savePreferences,
    // AI Settings
    getAISettings,
    saveAISettings,
    // Secrets
    getSecret,
    getSecretWithVersion,
    saveSecret,
    deleteSecret,
    clearAllSecrets,
    // Sync Queue
    addToSyncQueue,
    getPendingSyncOps,
    updateSyncQueueEntry,
    removeSyncQueueEntry,
    countPendingSyncOps,
    // Sync Meta
    getSyncMeta,
    saveSyncMeta,
    updateMapSyncVersion
  }
}
