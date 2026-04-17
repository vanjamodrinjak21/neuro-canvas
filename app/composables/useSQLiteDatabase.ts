/**
 * SQLite Database Implementation
 *
 * Drop-in replacement for the Dexie-based useDatabase() on native platforms.
 * Uses tauri-plugin-sql (desktop) or @capacitor-community/sqlite (mobile).
 * The public API is identical to useDatabase() so consumers don't know the difference.
 */
import { ref, readonly } from 'vue'
import type { MapSettings } from '~/types/canvas'
import type { AISettings } from '~/types/ai-settings'
import { DEFAULT_AI_SETTINGS } from '~/types/ai-settings'
import type {
  DBMapDocument,
  DBNode,
  DBEdge,
  DBSyncQueueEntry,
  DBSyncMeta,
  DBAICacheEntry,
  DBUserMemory
} from './useDatabase'
import { getSQLiteDriver, type SQLiteDriver } from '~/database/sqlite-driver'
import { getMigrationsToApply } from '~/database/migrations'

// ─── Row types (snake_case from SQLite) ────────────────────────────

interface MapRow {
  id: string
  title: string
  nodes: string
  edges: string
  camera: string
  settings: string
  root_node_id: string | null
  preview: string | null
  tags: string
  sync_version: number
  checksum: string | null
  created_at: number
  updated_at: number
}

interface SyncQueueRow {
  id: number
  map_id: string
  action: string
  status: string
  retries: number
  created_at: number
  last_attempt: number | null
  error: string | null
}

interface SyncMetaRow {
  id: string
  device_id: string
  last_sync_at: number
  last_stream_id: string
}

interface PreferencesRow {
  id: string
  data: string
  updated_at: number
}

interface SecretRow {
  id: string
  encrypted_value: string
  encryption_version: number
  created_at: number
  updated_at: number
}

interface AISettingsRow {
  id: string
  settings: string
  updated_at: number
}

interface AICacheRow {
  key: string
  system_prompt: string
  user_prompt: string
  response: string
  usage: string | null
  created_at: number
  ttl: number
  access_count: number
  last_accessed: number
}

interface UserMemoryRow {
  id: string
  data: string
  updated_at: number
}

interface SchemaVersionRow {
  version: number
  applied_at: number
  description: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

function mapRowToDocument(row: MapRow): DBMapDocument {
  return {
    id: row.id,
    title: row.title,
    nodes: parseJSON<DBNode[]>(row.nodes, []),
    edges: parseJSON<DBEdge[]>(row.edges, []),
    camera: parseJSON(row.camera, { x: 0, y: 0, zoom: 1 }),
    settings: parseJSON<MapSettings>(row.settings, {
      gridEnabled: false,
      gridSize: 20,
      snapToGrid: false,
      backgroundColor: '#050508',
      defaultNodeStyle: {},
      defaultEdgeStyle: {}
    }),
    rootNodeId: row.root_node_id ?? undefined,
    preview: row.preview ?? undefined,
    tags: parseJSON<string[]>(row.tags, []),
    syncVersion: row.sync_version,
    checksum: row.checksum ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function syncQueueRowToEntry(row: SyncQueueRow): DBSyncQueueEntry {
  return {
    id: row.id,
    mapId: row.map_id,
    action: row.action as 'push' | 'delete',
    status: row.status as 'pending' | 'processing' | 'failed',
    retries: row.retries,
    createdAt: row.created_at,
    lastAttempt: row.last_attempt ?? undefined,
    error: row.error ?? undefined
  }
}

// ─── Migration Runner ──────────────────────────────────────────────

async function runMigrations(driver: SQLiteDriver): Promise<void> {
  // Ensure schema_version table exists
  await driver.execute(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL,
      description TEXT
    )
  `)

  // Get current version
  const rows = await driver.select<SchemaVersionRow>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  )
  const currentVersion = rows.length > 0 ? rows[0]!.version : 0

  // Apply pending migrations
  const pending = getMigrationsToApply(currentVersion)
  for (const migration of pending) {
    // Split multi-statement SQL and execute each separately
    const statements = migration.sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const stmt of statements) {
      await driver.execute(stmt)
    }

    await driver.execute(
      'INSERT INTO schema_version (version, applied_at, description) VALUES ($1, $2, $3)',
      [migration.version, Date.now(), migration.description]
    )
  }
}

// ─── Sync normalized nodes/edges ───────────────────────────────────

async function syncNormalizedNodes(driver: SQLiteDriver, mapId: string, nodes: DBNode[]): Promise<void> {
  // Delete existing nodes for this map, then bulk insert
  await driver.execute('DELETE FROM nodes WHERE map_id = $1', [mapId])

  for (const node of nodes) {
    await driver.execute(
      `INSERT INTO nodes (id, map_id, type, content, position_x, position_y, width, height,
        parent_id, is_root, collapsed, locked, style, metadata, embedding_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        node.id, mapId, node.type ?? 'text', node.content ?? '',
        node.position?.x ?? 0, node.position?.y ?? 0,
        node.size?.width ?? 200, node.size?.height ?? 80,
        node.parentId ?? null, node.isRoot ? 1 : 0,
        node.collapsed ? 1 : 0, node.locked ? 1 : 0,
        JSON.stringify(node.style ?? {}), JSON.stringify(node.metadata ?? {}),
        0, node.createdAt, node.updatedAt
      ]
    )
  }
}

async function syncNormalizedEdges(driver: SQLiteDriver, mapId: string, edges: DBEdge[]): Promise<void> {
  await driver.execute('DELETE FROM edges WHERE map_id = $1', [mapId])

  for (const edge of edges) {
    await driver.execute(
      `INSERT INTO edges (id, map_id, source_id, target_id, label, style, control_points,
        source_anchor, target_anchor, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        edge.id, mapId, edge.sourceId, edge.targetId,
        edge.label ?? null, JSON.stringify(edge.style ?? {}),
        JSON.stringify(edge.controlPoints ?? []),
        edge.sourceAnchor ?? null, edge.targetAnchor ?? null,
        edge.createdAt, edge.updatedAt
      ]
    )
  }
}

// ─── Main Composable ───────────────────────────────────────────────

export function useSQLiteDatabase() {
  const isReady = ref(false)
  const error = ref<Error | null>(null)

  let driver: SQLiteDriver | null = null

  async function getDriver(): Promise<SQLiteDriver> {
    if (driver) return driver
    driver = await getSQLiteDriver()
    return driver
  }

  // Initialize database + run migrations
  async function init(): Promise<void> {
    try {
      const db = await getDriver()
      await runMigrations(db)
      isReady.value = true
    } catch (e) {
      error.value = e as Error
      console.error('[SQLite] Failed to initialize:', e)
    }
  }

  // ─── Map Operations ────────────────────────────────────────────

  async function getAllMaps(): Promise<DBMapDocument[]> {
    const db = await getDriver()
    const rows = await db.select<MapRow>('SELECT * FROM maps ORDER BY updated_at DESC')
    return rows.map(mapRowToDocument)
  }

  async function getMap(id: string): Promise<DBMapDocument | undefined> {
    const db = await getDriver()
    const rows = await db.select<MapRow>('SELECT * FROM maps WHERE id = $1', [id])
    return rows.length > 0 ? mapRowToDocument(rows[0]!) : undefined
  }

  async function saveMap(map: DBMapDocument): Promise<void> {
    const db = await getDriver()
    const nodesJSON = JSON.stringify(map.nodes ?? [])
    const edgesJSON = JSON.stringify(map.edges ?? [])

    await db.execute(
      `INSERT INTO maps (id, title, nodes, edges, camera, settings, root_node_id, preview, tags,
        sync_version, checksum, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT(id) DO UPDATE SET
        title = $2, nodes = $3, edges = $4, camera = $5, settings = $6,
        root_node_id = $7, preview = $8, tags = $9, sync_version = $10,
        checksum = $11, updated_at = $13`,
      [
        map.id, map.title, nodesJSON, edgesJSON,
        JSON.stringify(map.camera ?? { x: 0, y: 0, zoom: 1 }),
        JSON.stringify(map.settings ?? {}),
        map.rootNodeId ?? null, map.preview ?? null,
        JSON.stringify(map.tags ?? []),
        map.syncVersion ?? 0, map.checksum ?? null,
        map.createdAt, map.updatedAt
      ]
    )

    // Sync normalized tables for relational queries
    await syncNormalizedNodes(db, map.id, map.nodes ?? [])
    await syncNormalizedEdges(db, map.id, map.edges ?? [])
  }

  async function deleteMap(id: string): Promise<void> {
    const db = await getDriver()
    // CASCADE handles nodes/edges automatically
    await db.execute('DELETE FROM maps WHERE id = $1', [id])
  }

  async function getRecentMaps(limit: number = 20): Promise<DBMapDocument[]> {
    const db = await getDriver()
    const rows = await db.select<MapRow>(
      'SELECT * FROM maps ORDER BY updated_at DESC LIMIT $1',
      [limit]
    )
    return rows.map(mapRowToDocument)
  }

  async function searchMaps(query: string): Promise<DBMapDocument[]> {
    const db = await getDriver()
    const rows = await db.select<MapRow>(
      'SELECT * FROM maps WHERE title LIKE $1 ORDER BY updated_at DESC',
      [`%${query}%`]
    )
    return rows.map(mapRowToDocument)
  }

  async function updateMapSyncVersion(mapId: string, syncVersion: number, checksum: string): Promise<void> {
    const db = await getDriver()
    await db.execute(
      'UPDATE maps SET sync_version = $1, checksum = $2 WHERE id = $3',
      [syncVersion, checksum, mapId]
    )
  }

  // ─── Preferences ───────────────────────────────────────────────

  async function getPreferences<T extends Record<string, unknown>>(
    key: string,
    defaultValue: T
  ): Promise<T> {
    const db = await getDriver()
    const rows = await db.select<PreferencesRow>(
      'SELECT * FROM preferences WHERE id = $1',
      [key]
    )
    if (rows.length > 0) {
      return parseJSON<T>(rows[0]!.data, defaultValue)
    }
    return defaultValue
  }

  async function savePreferences(key: string, data: Record<string, unknown>): Promise<void> {
    const db = await getDriver()
    await db.execute(
      `INSERT INTO preferences (id, data, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET data = $2, updated_at = $3`,
      [key, JSON.stringify(data), Date.now()]
    )
  }

  // ─── AI Settings ───────────────────────────────────────────────

  async function getAISettings(): Promise<AISettings> {
    const db = await getDriver()
    const rows = await db.select<AISettingsRow>(
      'SELECT * FROM ai_settings WHERE id = $1',
      ['default']
    )
    if (rows.length > 0) {
      return parseJSON<AISettings>(rows[0]!.settings, { ...DEFAULT_AI_SETTINGS, updatedAt: Date.now() })
    }
    return { ...DEFAULT_AI_SETTINGS, updatedAt: Date.now() }
  }

  async function saveAISettings(settings: AISettings): Promise<void> {
    const db = await getDriver()
    const now = Date.now()
    await db.execute(
      `INSERT INTO ai_settings (id, settings, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET settings = $2, updated_at = $3`,
      ['default', JSON.stringify({ ...settings, updatedAt: now }), now]
    )
  }

  // ─── Secrets ───────────────────────────────────────────────────

  async function getSecret(id: string): Promise<string | undefined> {
    const db = await getDriver()
    const rows = await db.select<SecretRow>(
      'SELECT encrypted_value FROM secrets WHERE id = $1',
      [id]
    )
    return rows.length > 0 ? rows[0]!.encrypted_value : undefined
  }

  async function getSecretWithVersion(id: string): Promise<{ encryptedValue: string; encryptionVersion: number } | undefined> {
    const db = await getDriver()
    const rows = await db.select<SecretRow>(
      'SELECT encrypted_value, encryption_version FROM secrets WHERE id = $1',
      [id]
    )
    if (rows.length === 0) return undefined
    return {
      encryptedValue: rows[0]!.encrypted_value,
      encryptionVersion: rows[0]!.encryption_version ?? 1
    }
  }

  async function saveSecret(id: string, encryptedValue: string, encryptionVersion: number = 2): Promise<void> {
    const db = await getDriver()
    const now = Date.now()
    await db.execute(
      `INSERT INTO secrets (id, encrypted_value, encryption_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET encrypted_value = $2, encryption_version = $3, updated_at = $5`,
      [id, encryptedValue, encryptionVersion, now, now]
    )
  }

  async function deleteSecret(id: string): Promise<void> {
    const db = await getDriver()
    await db.execute('DELETE FROM secrets WHERE id = $1', [id])
  }

  async function clearAllSecrets(): Promise<void> {
    const db = await getDriver()
    await db.execute('DELETE FROM secrets')
  }

  // ─── AI Cache ──────────────────────────────────────────────────

  async function getAICacheEntry(key: string): Promise<DBAICacheEntry | undefined> {
    const db = await getDriver()
    const rows = await db.select<AICacheRow>(
      'SELECT * FROM ai_cache WHERE key = $1',
      [key]
    )
    if (rows.length === 0) return undefined
    const row = rows[0]!
    // Check TTL
    if (Date.now() - row.created_at > row.ttl * 1000) {
      await db.execute('DELETE FROM ai_cache WHERE key = $1', [key])
      return undefined
    }
    // Update access stats
    await db.execute(
      'UPDATE ai_cache SET access_count = access_count + 1, last_accessed = $1 WHERE key = $2',
      [Date.now(), key]
    )
    return {
      key: row.key,
      systemPrompt: row.system_prompt,
      userPrompt: row.user_prompt,
      response: row.response,
      usage: row.usage ? parseJSON(row.usage, undefined) : undefined,
      createdAt: row.created_at,
      ttl: row.ttl,
      accessCount: row.access_count + 1,
      lastAccessed: Date.now()
    }
  }

  async function saveAICacheEntry(entry: DBAICacheEntry): Promise<void> {
    const db = await getDriver()
    await db.execute(
      `INSERT INTO ai_cache (key, system_prompt, user_prompt, response, usage, created_at, ttl, access_count, last_accessed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(key) DO UPDATE SET response = $4, usage = $5, access_count = $8, last_accessed = $9`,
      [
        entry.key, entry.systemPrompt, entry.userPrompt, entry.response,
        entry.usage ? JSON.stringify(entry.usage) : null,
        entry.createdAt, entry.ttl, entry.accessCount, entry.lastAccessed
      ]
    )
  }

  // ─── User Memory ───────────────────────────────────────────────

  async function getUserMemory(): Promise<DBUserMemory | undefined> {
    const db = await getDriver()
    const rows = await db.select<UserMemoryRow>(
      'SELECT * FROM user_memory WHERE id = $1',
      ['default']
    )
    if (rows.length === 0) return undefined
    return {
      id: rows[0]!.id,
      data: parseJSON(rows[0]!.data, {}),
      updatedAt: rows[0]!.updated_at
    }
  }

  async function saveUserMemory(data: Record<string, unknown>): Promise<void> {
    const db = await getDriver()
    const now = Date.now()
    await db.execute(
      `INSERT INTO user_memory (id, data, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET data = $2, updated_at = $3`,
      ['default', JSON.stringify(data), now]
    )
  }

  // ─── Sync Queue ────────────────────────────────────────────────

  async function addToSyncQueue(entry: Omit<DBSyncQueueEntry, 'id'>): Promise<void> {
    const db = await getDriver()
    // Avoid duplicate entries for same mapId + action
    const existing = await db.select<SyncQueueRow>(
      `SELECT id FROM sync_queue WHERE map_id = $1 AND action = $2 AND status = 'pending' LIMIT 1`,
      [entry.mapId, entry.action]
    )
    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO sync_queue (map_id, action, status, retries, created_at, last_attempt, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.mapId, entry.action, entry.status, entry.retries,
          entry.createdAt, entry.lastAttempt ?? null, entry.error ?? null
        ]
      )
    }
  }

  async function getPendingSyncOps(): Promise<DBSyncQueueEntry[]> {
    const db = await getDriver()
    const rows = await db.select<SyncQueueRow>(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`
    )
    return rows.map(syncQueueRowToEntry)
  }

  async function updateSyncQueueEntry(id: number, updates: Partial<DBSyncQueueEntry>): Promise<void> {
    const db = await getDriver()
    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIdx++}`)
      values.push(updates.status)
    }
    if (updates.retries !== undefined) {
      setClauses.push(`retries = $${paramIdx++}`)
      values.push(updates.retries)
    }
    if (updates.lastAttempt !== undefined) {
      setClauses.push(`last_attempt = $${paramIdx++}`)
      values.push(updates.lastAttempt)
    }
    if (updates.error !== undefined) {
      setClauses.push(`error = $${paramIdx++}`)
      values.push(updates.error)
    }

    if (setClauses.length > 0) {
      values.push(id)
      await db.execute(
        `UPDATE sync_queue SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
        values
      )
    }
  }

  async function removeSyncQueueEntry(id: number): Promise<void> {
    const db = await getDriver()
    await db.execute('DELETE FROM sync_queue WHERE id = $1', [id])
  }

  async function countPendingSyncOps(): Promise<number> {
    const db = await getDriver()
    const rows = await db.select<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
    )
    return rows[0]?.count ?? 0
  }

  // ─── Sync Meta ─────────────────────────────────────────────────

  async function getSyncMeta(): Promise<DBSyncMeta | undefined> {
    const db = await getDriver()
    const rows = await db.select<SyncMetaRow>(
      'SELECT * FROM sync_meta WHERE id = $1',
      ['default']
    )
    if (rows.length === 0) return undefined
    return {
      id: rows[0]!.id,
      deviceId: rows[0]!.device_id,
      lastSyncAt: rows[0]!.last_sync_at,
      lastStreamId: rows[0]!.last_stream_id
    }
  }

  async function saveSyncMeta(meta: Partial<DBSyncMeta>): Promise<void> {
    const db = await getDriver()
    const existing = await getSyncMeta()

    await db.execute(
      `INSERT INTO sync_meta (id, device_id, last_sync_at, last_stream_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET
        device_id = $2, last_sync_at = $3, last_stream_id = $4`,
      [
        'default',
        meta.deviceId || existing?.deviceId || '',
        meta.lastSyncAt ?? existing?.lastSyncAt ?? 0,
        meta.lastStreamId ?? existing?.lastStreamId ?? '0'
      ]
    )
  }

  // ─── Native-Only: Advanced Queries ─────────────────────────────

  /** Search nodes across all maps by content (native only) */
  async function searchNodes(query: string, mapId?: string): Promise<Array<{
    nodeId: string
    mapId: string
    content: string
    type: string
  }>> {
    const db = await getDriver()
    const sql = mapId
      ? 'SELECT id, map_id, content, type FROM nodes WHERE content LIKE $1 AND map_id = $2 LIMIT 100'
      : 'SELECT id, map_id, content, type FROM nodes WHERE content LIKE $1 LIMIT 100'
    const params = mapId ? [`%${query}%`, mapId] : [`%${query}%`]
    const rows = await db.select<{ id: string; map_id: string; content: string; type: string }>(sql, params)
    return rows.map(r => ({ nodeId: r.id, mapId: r.map_id, content: r.content, type: r.type }))
  }

  /** Get node count per map (native only) */
  async function getMapStats(): Promise<Array<{ mapId: string; nodeCount: number; edgeCount: number }>> {
    const db = await getDriver()
    const rows = await db.select<{ map_id: string; node_count: number; edge_count: number }>(`
      SELECT m.id as map_id,
        COALESCE(n.cnt, 0) as node_count,
        COALESCE(e.cnt, 0) as edge_count
      FROM maps m
      LEFT JOIN (SELECT map_id, COUNT(*) as cnt FROM nodes GROUP BY map_id) n ON m.id = n.map_id
      LEFT JOIN (SELECT map_id, COUNT(*) as cnt FROM edges GROUP BY map_id) e ON m.id = e.map_id
      ORDER BY m.updated_at DESC
    `)
    return rows.map(r => ({ mapId: r.map_id, nodeCount: r.node_count, edgeCount: r.edge_count }))
  }

  /** Find connected nodes (graph traversal, native only) */
  async function getConnectedNodes(nodeId: string, mapId: string): Promise<string[]> {
    const db = await getDriver()
    const rows = await db.select<{ id: string }>(`
      SELECT DISTINCT n.id FROM nodes n
      JOIN edges e ON (e.source_id = n.id OR e.target_id = n.id)
      WHERE e.map_id = $1 AND (e.source_id = $2 OR e.target_id = $2) AND n.id != $2
    `, [mapId, nodeId])
    return rows.map(r => r.id)
  }

  /** Prune expired AI cache entries */
  async function pruneExpiredCache(): Promise<number> {
    const db = await getDriver()
    const now = Date.now()
    const result = await db.execute(
      'DELETE FROM ai_cache WHERE (created_at + ttl * 1000) < $1',
      [now]
    )
    return result.rowsAffected
  }

  // Initialize on import
  if (typeof window !== 'undefined') {
    init()
  }

  return {
    isReady: readonly(isReady),
    error: readonly(error),
    init,
    // Maps
    getAllMaps,
    getMap,
    saveMap,
    deleteMap,
    getRecentMaps,
    searchMaps,
    updateMapSyncVersion,
    // Preferences
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
    // AI Cache
    getAICacheEntry,
    saveAICacheEntry,
    pruneExpiredCache,
    // User Memory
    getUserMemory,
    saveUserMemory,
    // Sync Queue
    addToSyncQueue,
    getPendingSyncOps,
    updateSyncQueueEntry,
    removeSyncQueueEntry,
    countPendingSyncOps,
    // Sync Meta
    getSyncMeta,
    saveSyncMeta,
    // Native-only advanced queries
    searchNodes,
    getMapStats,
    getConnectedNodes
  }
}
