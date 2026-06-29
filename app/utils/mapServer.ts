import type { DBMapDocument } from '~/composables/useDatabase'

/**
 * Normalize a map record from the `/api/sync/pull` server response into the
 * client-side `DBMapDocument` shape.
 *
 * Extracted from `dashboard.vue` / `maps/index.vue`, which each had their own
 * identical copy. The server stores map content under `data` and timestamps as
 * ISO strings; this flattens `data.*` and converts timestamps to epoch millis.
 */
export function mapServerToDoc(m: any): DBMapDocument {
  return {
    id: m.id,
    title: m.title,
    nodes: m.data?.nodes || [],
    edges: m.data?.edges || [],
    camera: m.data?.camera || { x: 0, y: 0, zoom: 1 },
    settings: m.data?.settings || {},
    rootNodeId: m.data?.rootNodeId,
    preview: m.preview,
    tags: m.tags || [],
    createdAt: new Date(m.createdAt).getTime(),
    updatedAt: new Date(m.updatedAt).getTime(),
    syncVersion: m.syncVersion,
    checksum: m.checksum,
  } as DBMapDocument
}
