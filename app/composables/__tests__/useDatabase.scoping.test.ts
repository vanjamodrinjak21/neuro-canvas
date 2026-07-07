// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { ref, computed, reactive, watch, readonly } from 'vue'
import { useDatabase, NATIVE_LOCAL_USER_ID, type DBMapDocument } from '~/composables/useDatabase'

// ---------------------------------------------------------------------------
// useDatabase — user scoping + adoption migration (first-open-empty bug)
// ---------------------------------------------------------------------------
//
// On native, dashboard.vue renders against a minimal placeholder session whose
// user id is 'native-local', and (before the fix) fed that placeholder to
// db.setCurrentUserId() — tagging every local map 'native-local'. The sync
// engine then scoped the DB to the REAL session id, so getMap()'s ownership
// check rejected every map: the first open after a cold start fell through to
// a blank newDocument(). These tests pin the adoption migration that heals
// those rows and the ownership semantics around the placeholder id.
// ---------------------------------------------------------------------------

// Nuxt-style auto-import globals — useDatabase touches ref/readonly only at
// call time, so assigning after the (hoisted) import is safe.
Object.assign(globalThis, { ref, computed, reactive, watch, readonly })

function doc(id: string, userId?: string): DBMapDocument {
  return {
    id,
    title: `Map ${id}`,
    nodes: [{ id: 'n1' }],
    edges: [],
    camera: { x: 0, y: 0, zoom: 1 },
    settings: {},
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...(userId ? { userId } : {}),
  } as unknown as DBMapDocument
}

const db = useDatabase()

beforeEach(async () => {
  await db.setCurrentUserId(null)
  const raw = await db.rawDB()
  await raw.maps.clear()
})

describe('setCurrentUserId adoption migration', () => {
  it('adopts untagged maps for the signing-in user (existing v4→v5 behavior)', async () => {
    const raw = await db.rawDB()
    await raw.maps.put(doc('untagged'))

    await db.setCurrentUserId('real-user')

    const map = await db.getMap('untagged')
    expect(map).toBeDefined()
    expect(map!.userId).toBe('real-user')
  })

  it('adopts native-local placeholder maps when a real user signs in', async () => {
    const raw = await db.rawDB()
    await raw.maps.put(doc('placeholder-tagged', NATIVE_LOCAL_USER_ID))

    await db.setCurrentUserId('real-user')

    const map = await db.getMap('placeholder-tagged')
    expect(map).toBeDefined()
    expect(map!.userId).toBe('real-user')
  })

  it('never adopts maps tagged with a different real user', async () => {
    const raw = await db.rawDB()
    await raw.maps.put(doc('foreign', 'other-user'))

    await db.setCurrentUserId('real-user')

    expect(await db.getMap('foreign')).toBeUndefined()
    expect((await raw.maps.get('foreign'))!.userId).toBe('other-user')
  })

  it('setting the placeholder id does not steal real-user maps', async () => {
    const raw = await db.rawDB()
    await raw.maps.put(doc('owned', 'real-user'))

    await db.setCurrentUserId(NATIVE_LOCAL_USER_ID)

    expect((await raw.maps.get('owned'))!.userId).toBe('real-user')
  })

  it('cold-start sequence: placeholder-then-real id keeps maps openable (regression)', async () => {
    // 1. Map saved while signed out / pre-fix — no tag.
    const raw = await db.rawDB()
    await raw.maps.put(doc('m1'))

    // 2. Dashboard mounts on native → placeholder id tags it 'native-local'.
    await db.setCurrentUserId(NATIVE_LOCAL_USER_ID)
    expect((await raw.maps.get('m1'))!.userId).toBe(NATIVE_LOCAL_USER_ID)

    // 3. Sync engine initialize() lands the real session id.
    await db.setCurrentUserId('real-user')

    // 4. First open of the map must NOT be ownership-rejected.
    const map = await db.getMap('m1')
    expect(map).toBeDefined()
    expect(map!.nodes.length).toBe(1)
  })
})
