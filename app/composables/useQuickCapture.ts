import { ref, computed, readonly } from 'vue'
import { nanoid } from 'nanoid'
import type { DBMapDocument, DBNode } from '~/composables/useDatabase'
import { useDatabase } from '~/composables/useDatabase'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { measureNodeSize } from '~/utils/nodeSizing'
import type { NodeStyle, MapSettings, EdgeStyle } from '~/types/canvas'

// ---------------------------------------------------------------------------
// useQuickCapture — mobile "capture a thought/URL into the Inbox map" (AER-70)
// ---------------------------------------------------------------------------
//
// The habit loop most mind-map apps miss: a friction-free way to drop a thought
// or link somewhere it won't get lost, then triage it later. This composable
// owns:
//
//   1. A per-user auto-provisioned "Inbox" map (create-on-first-use, never
//      duplicated). It is identified by the stable `INBOX_TAG` marker on the
//      map's `tags[]` — a field that already round-trips through sync push/pull
//      (server persists + returns it), so the marker survives across devices.
//
//   2. A quick-add primitive: append a new node (text OR URL) to the Inbox map.
//
// Persistence deliberately reuses the app's NORMAL node-add persistence path —
// `db.saveMap()` + `syncEngine.debouncedPush()` — the exact pair `useAutoSave`
// uses. That means the offline sync queue and last-writer-wins conflict handling
// apply for free: capture works offline (writes to Dexie, queues the push) and
// reconciles when the device comes back online. We do NOT touch the shared
// `mapStore` singleton — mutating it would clobber whatever map the user has
// open — we operate on the Inbox `DBMapDocument` directly instead.
//
// State (`isOpen` / `prefill`) is module-scoped so a single mounted sheet can be
// driven from anywhere: a header button, or the `neurocanvas://capture` deep
// link (see `plugins/quick-capture-deeplink.client.ts`).
// ---------------------------------------------------------------------------

/** Stable marker on `DBMapDocument.tags` identifying the auto-provisioned Inbox. */
export const INBOX_TAG = 'inbox'

/** Default title for a freshly provisioned Inbox map. */
export const INBOX_TITLE = 'Inbox'

/** What a single capture carries — at least one of `text`/`url` must be set. */
export interface CapturePayload {
  text?: string
  url?: string
}

/** Result of a capture: the affected inbox map id + the new node's id. */
export interface CaptureResult {
  mapId: string
  nodeId: string
}

// Node/edge/map defaults. `mapStore` keeps equivalents module-private and does
// not export them, so we mirror the minimal set needed to author a valid
// `DBMapDocument` from scratch. The map is fully editable once opened; these are
// just sane starting points consistent with the store's own defaults.
const CAPTURE_NODE_STYLE: NodeStyle = {
  shape: 'rounded',
  fillColor: '#111113',
  borderColor: '#27272A',
  borderWidth: 1.5,
  textColor: '#FAFAFA',
  fontSize: 14,
  fontWeight: 500,
  shadowEnabled: true,
  glowEnabled: false,
}

const CAPTURE_EDGE_STYLE: EdgeStyle = {
  type: 'bezier',
  strokeColor: '#2A2A30',
  strokeWidth: 2,
  arrowStart: 'none',
  arrowEnd: 'arrow',
  animated: false,
}

const CAPTURE_MAP_SETTINGS: MapSettings = {
  gridEnabled: true,
  gridSize: 32,
  snapToGrid: true,
  backgroundColor: '#0D0D0F',
  defaultNodeStyle: CAPTURE_NODE_STYLE,
  defaultEdgeStyle: CAPTURE_EDGE_STYLE,
}

// Vertical rhythm for stacking captured nodes beneath one another.
const CAPTURE_ROW_GAP = 24

// ── Module-scoped UI state (shared across every useQuickCapture() caller) ─────
const isOpen = ref(false)
const prefill = ref<CapturePayload>({})

// ---------------------------------------------------------------------------
// Pure helpers (exported for direct unit testing — no Nuxt runtime required)
// ---------------------------------------------------------------------------

/**
 * True when `raw` looks like an http(s) URL. Deliberately conservative: only
 * absolute web URLs are treated as links so plain text like "call mom" or a
 * word containing a dot is never mis-classified.
 */
export function looksLikeUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  try {
    const u = new URL(trimmed)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Parse a `neurocanvas://capture?text=...&url=...` deep link into a payload.
 *
 * Returns `null` when the URL is not a capture link (wrong scheme/host) so the
 * caller can ignore auth callbacks and other deep links. Both params are
 * optional individually, but a payload with neither `text` nor `url` yields
 * `null` (nothing to capture). Percent-encoding is decoded by `URLSearchParams`.
 *
 * Accepts the host in either position browsers/OSes produce it:
 *   neurocanvas://capture?...   (host = "capture")
 *   neurocanvas:///capture?...  (path = "/capture")
 */
export function parseCaptureUrl(raw: string): CapturePayload | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  if (url.protocol.toLowerCase() !== 'neurocanvas:') return null

  const host = url.host.toLowerCase()
  const path = url.pathname.replace(/^\/+/, '').toLowerCase()
  const isCapture = host === 'capture' || path === 'capture' || (!host && path === 'capture')
  if (!isCapture) return null

  const text = url.searchParams.get('text')?.trim() || undefined
  const link = url.searchParams.get('url')?.trim() || undefined
  if (!text && !link) return null

  return { text, url: link }
}

/**
 * Build the display content for a captured node from a payload. A URL is
 * rendered as a Markdown-style link when a text label is also present, or as
 * the bare URL otherwise; plain text passes through verbatim.
 */
export function buildCaptureContent(payload: CapturePayload): string {
  const text = payload.text?.trim()
  const url = payload.url?.trim()

  if (url && text) return `[${text}](${url})`
  if (url) return url
  return text ?? ''
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useQuickCapture() {
  const db = useDatabase()
  const sync = useSyncEngine()

  /** Whether the current payload has anything worth capturing. */
  function hasContent(payload: CapturePayload): boolean {
    return Boolean(payload.text?.trim() || payload.url?.trim())
  }

  /**
   * Find the caller's Inbox map, creating it on first use. Idempotent: repeated
   * calls return the SAME map (identified by the `INBOX_TAG` marker) rather than
   * spawning duplicates. When multiple tagged maps somehow exist (e.g. a race
   * across devices before sync converges), the oldest is chosen deterministically
   * so every device settles on one inbox.
   */
  async function findOrCreateInbox(): Promise<DBMapDocument> {
    const all = await db.getAllMaps()
    const existing = all
      .filter(m => Array.isArray(m.tags) && m.tags.includes(INBOX_TAG))
      .sort((a, b) => a.createdAt - b.createdAt)

    if (existing[0]) return existing[0]

    const now = Date.now()
    const userId = db.getCurrentUserId() ?? undefined
    const inbox: DBMapDocument = {
      id: nanoid(),
      title: INBOX_TITLE,
      nodes: [],
      edges: [],
      camera: { x: 0, y: 0, zoom: 1 },
      settings: { ...CAPTURE_MAP_SETTINGS },
      rootNodeId: undefined,
      createdAt: now,
      updatedAt: now,
      tags: [INBOX_TAG],
      ...(userId ? { userId } : {}),
    }

    await db.saveMap(inbox)
    // Push through the normal sync path so the inbox (and its marker tag)
    // propagates to other devices. Offline-safe: debouncedPush is a no-op when
    // sync is disabled and queues when offline.
    sync.debouncedPush(inbox.id)
    return inbox
  }

  /** Compute the position for the next captured node — stacked vertically. */
  function nextPosition(nodes: DBNode[]): { x: number; y: number } {
    if (nodes.length === 0) return { x: 0, y: 0 }
    let maxBottom = -Infinity
    let anchorX = 0
    for (const n of nodes) {
      const bottom = n.position.y + n.size.height
      if (bottom > maxBottom) {
        maxBottom = bottom
        anchorX = n.position.x
      }
    }
    return { x: anchorX, y: maxBottom + CAPTURE_ROW_GAP }
  }

  /**
   * Append a captured node to the Inbox map and persist it via the normal path.
   *
   * The very first node in an empty inbox becomes the root/topic node so the map
   * renders and lays out correctly. Returns the affected map + new node ids.
   *
   * Throws when the payload is empty (no text and no URL) — callers should gate
   * on `hasContent` / disable the submit control instead of relying on the throw.
   */
  async function captureToInbox(payload: CapturePayload): Promise<CaptureResult> {
    if (!hasContent(payload)) {
      throw new Error('Nothing to capture: payload has neither text nor url.')
    }

    const inbox = await findOrCreateInbox()
    const content = buildCaptureContent(payload)
    const now = Date.now()
    const isFirst = inbox.nodes.length === 0
    const size = measureNodeSize(
      content,
      CAPTURE_NODE_STYLE.fontSize,
      CAPTURE_NODE_STYLE.fontWeight,
      CAPTURE_NODE_STYLE.shape,
    )

    const node: DBNode = {
      id: nanoid(),
      type: 'text',
      position: nextPosition(inbox.nodes),
      size,
      content,
      style: { ...CAPTURE_NODE_STYLE },
      isRoot: isFirst,
      metadata: {
        source: 'quick-capture',
        ...(payload.url ? { capturedUrl: payload.url } : {}),
      },
      createdAt: now,
      updatedAt: now,
    }

    const updated: DBMapDocument = {
      ...inbox,
      nodes: [...inbox.nodes, node],
      rootNodeId: inbox.rootNodeId ?? (isFirst ? node.id : undefined),
      updatedAt: now,
    }

    // Normal persistence path — identical to useAutoSave.save(): write to the
    // local DB, then fire a debounced cloud push. Offline queue + LWW just work.
    await db.saveMap(updated)
    sync.debouncedPush(updated.id)

    return { mapId: updated.id, nodeId: node.id }
  }

  // ── UI controls (drive the mounted <QuickCaptureSheet />) ──────────────────

  /** Open the capture sheet, optionally pre-filled (e.g. from a deep link). */
  function open(payload: CapturePayload = {}): void {
    prefill.value = { text: payload.text, url: payload.url }
    isOpen.value = true
  }

  /** Close the capture sheet and clear any prefill. */
  function close(): void {
    isOpen.value = false
    prefill.value = {}
  }

  return {
    // State
    isOpen: readonly(isOpen),
    prefill: readonly(prefill),
    canSubmit: computed(() => hasContent(prefill.value)),

    // Actions
    open,
    close,
    findOrCreateInbox,
    captureToInbox,

    // Pure helpers (re-exported for convenience)
    hasContent,
  }
}
