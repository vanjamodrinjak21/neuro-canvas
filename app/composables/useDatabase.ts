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
}

export interface DBPreferences {
  id: string
  data: Record<string, unknown>
  updatedAt: number
}

export interface DBEncryptedSecret {
  id: string // Format: providerId
  encryptedValue: string // AES-GCM encrypted API key
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

  async function saveSecret(id: string, encryptedValue: string): Promise<void> {
    const database = await ensureDBReady()
    await database.secrets.put({
      id,
      encryptedValue,
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
    saveSecret,
    deleteSecret,
    clearAllSecrets
  }
}
