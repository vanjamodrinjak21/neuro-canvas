import Dexie, { type EntityTable } from 'dexie'
import type { Camera, MapSettings, Node, Edge, Anchor } from '~/types'

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

// Dexie database class
class NeuroCanvasDB extends Dexie {
  maps!: EntityTable<DBMapDocument, 'id'>
  preferences!: EntityTable<DBPreferences, 'id'>

  constructor() {
    super('neurocanvas')

    this.version(1).stores({
      maps: 'id, title, updatedAt, createdAt, *tags',
      preferences: 'id'
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
    savePreferences
  }
}
