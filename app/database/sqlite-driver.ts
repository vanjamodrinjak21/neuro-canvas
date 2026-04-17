/**
 * SQLite Driver Abstraction
 *
 * Provides a unified interface over tauri-plugin-sql and
 * @capacitor-community/sqlite so the database composable
 * doesn't care which native runtime it's running on.
 */

export interface SQLiteDriver {
  execute(sql: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number }>
  select<T = Record<string, unknown>>(sql: string, bindValues?: unknown[]): Promise<T[]>
  close(): Promise<void>
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Convert PostgreSQL-style $1, $2 placeholders to SQLite-style ?
 * and reorder bind values accordingly.
 * tauri-plugin-sql (sqlx) uses ? for SQLite, not $N.
 */
function convertPlaceholders(sql: string, values: unknown[]): { sql: string; values: unknown[] } {
  if (!sql.includes('$')) return { sql, values }

  // Find all $N placeholders and replace with ?
  const converted = sql.replace(/\$(\d+)/g, '?')
  return { sql: converted, values }
}

// ─── Tauri Driver ──────────────────────────────────────────────────

async function createTauriDriver(): Promise<SQLiteDriver> {
  const { default: Database } = await import('@tauri-apps/plugin-sql')
  const db = await Database.load('sqlite:neurocanvas.db')

  return {
    async execute(sql: string, bindValues: unknown[] = []) {
      const { sql: q, values } = convertPlaceholders(sql, bindValues)
      try {
        const result = await db.execute(q, values)
        return { rowsAffected: result.rowsAffected, lastInsertId: result.lastInsertId ?? 0 }
      } catch (e) {
        console.error('[SQLite:Tauri] execute error:', e, '\nSQL:', q)
        return { rowsAffected: 0, lastInsertId: 0 }
      }
    },
    async select<T = Record<string, unknown>>(sql: string, bindValues: unknown[] = []) {
      const { sql: q, values } = convertPlaceholders(sql, bindValues)
      try {
        return db.select<T[]>(q, values) as Promise<T[]>
      } catch (e) {
        console.error('[SQLite:Tauri] select error:', e, '\nSQL:', q)
        return [] as T[]
      }
    },
    async close() {
      await db.close()
    }
  }
}

// ─── Capacitor Driver ──────────────────────────────────────────────

async function createCapacitorDriver(): Promise<SQLiteDriver> {
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite')
  const sqlite = new SQLiteConnection(CapacitorSQLite)

  const dbName = 'neurocanvas'
  const ret = await sqlite.checkConnectionsConsistency()
  const isConn = (await sqlite.isConnection(dbName, false)).result

  let db
  if (ret.result && isConn) {
    db = await sqlite.retrieveConnection(dbName, false)
  } else {
    db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, false)
  }
  await db.open()

  return {
    async execute(sql: string, bindValues: unknown[] = []) {
      // Capacitor SQLite expects statements via execute for DDL/DML
      if (bindValues.length > 0) {
        const result = await db.run(sql, bindValues as (string | number | boolean)[], false)
        return {
          rowsAffected: result.changes?.changes ?? 0,
          lastInsertId: result.changes?.lastId ?? 0
        }
      }
      const result = await db.execute(sql, false)
      return {
        rowsAffected: result.changes?.changes ?? 0,
        lastInsertId: result.changes?.lastId ?? 0
      }
    },
    async select<T = Record<string, unknown>>(sql: string, bindValues: unknown[] = []) {
      const result = await db.query(sql, bindValues as (string | number | boolean)[])
      return (result.values ?? []) as T[]
    },
    async close() {
      await db.close()
      await sqlite.closeConnection(dbName, false)
    }
  }
}

// ─── Factory ───────────────────────────────────────────────────────

function detectPlatform(): 'tauri' | 'capacitor' | 'web' {
  if (typeof window === 'undefined') return 'web'
  if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) return 'tauri'
  if ('Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.()) return 'capacitor'
  return 'web'
}

let driverInstance: SQLiteDriver | null = null
let driverPromise: Promise<SQLiteDriver> | null = null

export async function getSQLiteDriver(): Promise<SQLiteDriver> {
  if (driverInstance) return driverInstance

  if (!driverPromise) {
    const platform = detectPlatform()
    if (platform === 'web') {
      throw new Error('SQLite driver is not available on web — use Dexie instead')
    }

    driverPromise = (platform === 'tauri' ? createTauriDriver() : createCapacitorDriver())
      .then(driver => {
        driverInstance = driver
        return driver
      })
  }

  return driverPromise
}

export function isSQLiteAvailable(): boolean {
  return detectPlatform() !== 'web'
}
