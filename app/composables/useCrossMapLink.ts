import { useDatabase } from '~/composables/useDatabase'
import { useMapStore } from '~/stores/mapStore'
import {
  toLinkOptions,
  applyLinkToMetadata,
  type CrossMapLinkOption,
} from '~/utils/crossMapLink'

/**
 * AER-69 — cross-map node links.
 *
 * A node may link to another of the current user's maps via
 * `metadata.linkedMapId`. Clicking a linked node (or the panel action)
 * navigates to `/map/{linkedMapId}`. Forward-only in v1 — no backlinks index.
 *
 * The map list is sourced from IndexedDB (`useDatabase().getAllMaps()`), which
 * is already scoped to the current user AND works in the native SPA build
 * (Tauri/Capacitor) where there is no server to query. Pure list/metadata
 * transforms live in `~/utils/crossMapLink` so they're unit-testable.
 */
export function useCrossMapLink() {
  const db = useDatabase()
  const mapStore = useMapStore()

  const options = ref<CrossMapLinkOption[]>([])
  const isLoading = ref(false)

  /** Load the current user's other maps as link targets. Fails soft to []. */
  async function loadOptions(): Promise<void> {
    isLoading.value = true
    try {
      const maps = await db.getAllMaps()
      options.value = toLinkOptions(maps, mapStore.id || null)
    } catch (error) {
      console.error('[useCrossMapLink] failed to load maps:', error)
      options.value = []
    } finally {
      isLoading.value = false
    }
  }

  /** Set or clear a node's cross-map link. `null` clears it. */
  function setLink(nodeId: string, linkedMapId: string | null): void {
    const node = mapStore.nodes.get(nodeId)
    if (!node) return
    mapStore.updateNode(nodeId, {
      metadata: applyLinkToMetadata(node.metadata, linkedMapId),
    })
  }

  /**
   * Navigate to a node's linked map. Guards against a missing/deleted target:
   * if the map no longer exists (or is no longer owned by the user), we do NOT
   * navigate — the caller can surface a toast. Returns whether navigation ran.
   */
  async function navigateToLink(linkedMapId: string | null | undefined): Promise<boolean> {
    if (!linkedMapId) return false
    try {
      const target = await db.getMap(linkedMapId)
      if (!target) return false
    } catch (error) {
      // DB unavailable — fall through and let the map page handle a bad id.
      console.warn('[useCrossMapLink] could not verify link target:', error)
    }
    await navigateTo(`/map/${linkedMapId}`)
    return true
  }

  return {
    options,
    isLoading,
    loadOptions,
    setLink,
    navigateToLink,
  }
}
