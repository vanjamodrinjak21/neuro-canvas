import type { Node } from '~/types/canvas'
import type { DBMapDocument } from '~/composables/useDatabase'

/**
 * AER-69 — pure helpers for cross-map node links.
 *
 * Kept store-free (no Vue / Nuxt auto-imports) so the picker's set/clear and
 * list logic is unit-testable in isolation. The stateful composable
 * (`useCrossMapLink`) builds on these.
 */

/** A pickable link target — a candidate map, minus the map being edited. */
export interface CrossMapLinkOption {
  id: string
  title: string
}

/**
 * List transform: drop the current map so a node can't link to its own map,
 * drop rows without an id, normalize titles, and sort by title.
 */
export function toLinkOptions(
  maps: Pick<DBMapDocument, 'id' | 'title'>[],
  currentMapId: string | null,
): CrossMapLinkOption[] {
  return maps
    .filter(m => m.id && m.id !== currentMapId)
    .map(m => ({ id: m.id, title: m.title?.trim() || 'Untitled map' }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Metadata transform for setting a link. Passing `null` clears the link by
 * removing the key entirely rather than storing an empty string — a cleared
 * node must serialize with no `linkedMapId` at all. Does not mutate the input.
 */
export function applyLinkToMetadata(
  metadata: Node['metadata'] | undefined,
  linkedMapId: string | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(metadata ?? {}) }
  if (linkedMapId) {
    next.linkedMapId = linkedMapId
  } else {
    delete next.linkedMapId
  }
  return next
}
