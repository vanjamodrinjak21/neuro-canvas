-- NeuroCanvas SQLite Schema
-- Used by Tauri (tauri-plugin-sql) and Capacitor (@capacitor-community/sqlite)
-- This schema mirrors the Dexie/IndexedDB stores for web but adds normalized
-- nodes/edges tables for relational querying on native platforms.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Maps (primary documents) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT NOT NULL DEFAULT '[]',
  camera TEXT NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
  settings TEXT DEFAULT '{}',
  root_node_id TEXT,
  preview TEXT,
  tags TEXT DEFAULT '[]',
  sync_version INTEGER DEFAULT 0,
  checksum TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maps_updated ON maps(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_maps_title ON maps(title);

-- ─── Nodes (normalized, for advanced querying) ─────────────────────
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY NOT NULL,
  map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  width REAL NOT NULL DEFAULT 200,
  height REAL NOT NULL DEFAULT 80,
  parent_id TEXT,
  is_root INTEGER DEFAULT 0,
  collapsed INTEGER DEFAULT 0,
  locked INTEGER DEFAULT 0,
  style TEXT DEFAULT '{}',
  metadata TEXT DEFAULT '{}',
  embedding BLOB,
  embedding_version INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nodes_map ON nodes(map_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_content ON nodes(content);

-- ─── Edges (normalized) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY NOT NULL,
  map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  label TEXT,
  style TEXT DEFAULT '{}',
  ai_metadata TEXT DEFAULT '{}',
  control_points TEXT DEFAULT '[]',
  source_anchor TEXT,
  target_anchor TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_edges_map ON edges(map_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);

-- ─── Preferences ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

-- ─── Encrypted secrets (API keys) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY NOT NULL,
  encrypted_value TEXT NOT NULL,
  encryption_version INTEGER DEFAULT 2,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ─── AI settings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
  settings TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

-- ─── AI response cache ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  usage TEXT,
  created_at INTEGER NOT NULL,
  ttl INTEGER NOT NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_created ON ai_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_accessed ON ai_cache(last_accessed);

-- ─── User AI memory ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_memory (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

-- ─── Sync queue (offline operations) ───────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  map_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('push', 'delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed')),
  retries INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_attempt INTEGER,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_map ON sync_queue(map_id);

-- ─── Sync metadata ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_meta (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
  device_id TEXT NOT NULL,
  last_sync_at INTEGER DEFAULT 0,
  last_stream_id TEXT DEFAULT ''
);

-- ─── Schema version tracking ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL,
  description TEXT
);
