<script setup lang="ts">
/**
 * Global command palette (Cmd/Ctrl+K) — a NeuroCanvas-branded Spotlight/Raycast
 * window for "elastic" search across the whole app: maps (by title, node content
 * and tags), documents, templates, plus quick actions and navigation.
 *
 * Mounted ONCE in app.vue so it floats over every route. It owns the global
 * Cmd+K listener and all search/render logic; useCommandPalette() is just the
 * shared open-state. Search is instant client-side fuzzy ranking (the ranker
 * lives in utils/commandPaletteSearch.ts) over data already in IndexedDB / the
 * docs+templates caches — no per-keystroke server round-trip.
 */
import type { DBMapDocument } from '~/composables/useDatabase'
import type { DocumentSummary } from '~/composables/useDocuments'
import type { Template } from '~/types'
import { useCommandPalette } from '~/composables/useCommandPalette'
import { useDatabase } from '~/composables/useDatabase'
import { useDocuments } from '~/composables/useDocuments'
import { useTemplates } from '~/composables/useTemplates'
import { useMapStore } from '~/stores/mapStore'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { useGenerationQueue } from '~/composables/useGenerationQueue'
import { scoreFields, highlightSegments, type HighlightSegment } from '~/utils/commandPaletteSearch'

type PaletteGroupKey = 'generate' | 'actions' | 'maps' | 'documents' | 'templates' | 'navigation'

interface PaletteItem {
  id: string
  group: PaletteGroupKey
  label: string
  sublabel?: string
  icon: string
  /** Extra searchable text not shown in the row (node content, filename, tags). */
  keywords?: string
  run: () => void | Promise<void>
}

interface ScoredItem {
  item: PaletteItem
  segments: HighlightSegment[]
  flatIndex: number
}

interface MapIndexEntry {
  map: DBMapDocument
  title: string
  nodeText: string
  tags: string
}

const GROUP_ORDER: PaletteGroupKey[] = ['generate', 'actions', 'maps', 'documents', 'templates', 'navigation']
const GROUP_CAP: Record<PaletteGroupKey, number> = {
  generate: 1, actions: 8, maps: 6, documents: 5, templates: 4, navigation: 8,
}
const RECENT_MAPS = 5
const NODE_TEXT_CAP = 4000 // bound per-map haystack so keystroke ranking stays fast

const { isOpen, open, close, toggle } = useCommandPalette()
const { t, locale } = useI18n()
const toast = useToast()
const db = useDatabase()
const docsApi = useDocuments()
const templatesApi = useTemplates()
const mapStore = useMapStore()
const syncEngine = useSyncEngine()
const genQueue = useGenerationQueue()

const query = ref('')
const selectedIndex = ref(0)
const loading = ref(false)
const creatingMap = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
// Focus to restore when the palette closes (a11y — don't strand the caret).
let previousFocus: HTMLElement | null = null

const mapIndex = ref<MapIndexEntry[]>([])
const documentList = ref<DocumentSummary[]>([])
const templateList = ref<Template[]>([])
let templatesLoaded = false

// ── Global Cmd/Ctrl+K toggle (works on every page; opens even from inputs, the
// Spotlight convention). Internal keys (Arrow/Enter/Escape) are scoped to the
// palette overlay, so this only governs open/close. Shift is excluded so the
// map editor can keep its in-map node search on Cmd+Shift+K. ──
onKeyStroke(['k', 'K'], (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
    e.preventDefault()
    toggle()
  }
})

watch(isOpen, async (openNow) => {
  if (!openNow) {
    // Restore focus to whatever was focused before the palette opened.
    previousFocus?.focus?.()
    previousFocus = null
    return
  }
  previousFocus = (document.activeElement as HTMLElement | null) ?? null
  query.value = ''
  selectedIndex.value = 0
  await nextTick()
  inputRef.value?.focus()
  void loadData()
})

watch(query, () => { selectedIndex.value = 0 })

async function loadData() {
  loading.value = true
  // Maps — IndexedDB, fast; rebuild the index each open so new maps appear.
  // SECURITY: getAllMaps() falls back to EVERY map in the shared IndexedDB when
  // no user is established. Never surface another account's maps — when there's
  // no current user, keep only untagged (guest-owned) rows.
  try {
    const uid = db.getCurrentUserId()
    const all = await db.getAllMaps()
    const own = uid ? all : all.filter(m => !m.userId)
    mapIndex.value = own.map(m => ({
      map: m,
      title: m.title || t('command_palette.untitled'),
      nodeText: m.nodes.map(n => n.content).join(' ').slice(0, NODE_TEXT_CAP),
      tags: (m.tags || []).join(' '),
    }))
  } catch { mapIndex.value = [] }
  // Documents — server-backed but write-through cached, works offline.
  try { documentList.value = await docsApi.getDocuments() } catch { documentList.value = [] }
  // Templates — server only, no offline cache; fetch once per session.
  if (!templatesLoaded) {
    try {
      await templatesApi.fetchTemplates()
      templateList.value = [...templatesApi.templates.value]
      templatesLoaded = true
    } catch { templateList.value = [] }
  }
  loading.value = false
}

// ── Item factories ──
function go(path: string) {
  close()
  void navigateTo(path)
}

async function createNewMap() {
  if (creatingMap.value) return // re-entrancy guard (Enter held → stray blank maps)
  creatingMap.value = true
  close()
  try {
    // The palette can be invoked from INSIDE the map editor, where edits may sit
    // un-debounced in the singleton. Flush them before newDocument() resets it,
    // or those edits are silently lost.
    if (mapStore.isDirty) {
      await db.saveMap(mapStore.toSerializable())
    }
    mapStore.newDocument()
    const doc = mapStore.toSerializable()
    await db.saveMap(doc)
    if (syncEngine.isSyncEnabled.value) syncEngine.debouncedPush(doc.id)
    await navigateTo(`/map/${doc.id}`)
  } catch {
    toast.error(t('command_palette.errors.action_failed'))
  } finally {
    creatingMap.value = false
  }
}

function generateFromQuery() {
  const topic = query.value.trim()
  if (!topic) return
  close()
  genQueue.enqueueMapGeneration(topic, {
    branchCount: 5,
    maxDepth: 2,
    nodeCount: 24,
    style: 'detailed',
    tone: 'neutral',
    includeCrossConnections: true,
    locale: locale.value,
  })
  toast.success(t('generation.toast_started', { topic }))
}

const navItems = computed<PaletteItem[]>(() => [
  { id: 'nav-dashboard', group: 'navigation', label: t('command_palette.nav.dashboard'), icon: 'i-lucide-house', keywords: 'home', run: () => go('/dashboard') },
  { id: 'nav-maps', group: 'navigation', label: t('command_palette.nav.maps'), icon: 'i-lucide-layout-grid', run: () => go('/maps') },
  { id: 'nav-documents', group: 'navigation', label: t('command_palette.nav.documents'), icon: 'i-lucide-file-text', run: () => go('/documents') },
  { id: 'nav-templates', group: 'navigation', label: t('command_palette.nav.templates'), icon: 'i-lucide-layers', run: () => go('/templates') },
  { id: 'nav-settings', group: 'navigation', label: t('command_palette.nav.settings'), icon: 'i-lucide-settings', run: () => go('/settings') },
  { id: 'nav-roadmap', group: 'navigation', label: t('command_palette.nav.roadmap'), icon: 'i-lucide-route', run: () => go('/roadmap') },
])

const actionItems = computed<PaletteItem[]>(() => [
  { id: 'act-new-map', group: 'actions', label: t('command_palette.actions.new_map'), icon: 'i-lucide-plus', keywords: 'create blank new map', run: createNewMap },
  { id: 'act-generate', group: 'actions', label: t('command_palette.actions.generate_map'), icon: 'i-lucide-waypoints', keywords: 'ai generate create', run: () => go('/dashboard') },
  { id: 'act-upload', group: 'actions', label: t('command_palette.actions.upload_document'), icon: 'i-lucide-upload', keywords: 'document pdf upload import file', run: () => go('/documents') },
])

function mapToItem(e: MapIndexEntry): PaletteItem {
  return {
    id: `map-${e.map.id}`,
    group: 'maps',
    label: e.title,
    sublabel: t('command_palette.nodes_count', { n: e.map.nodes.length }),
    icon: 'i-lucide-git-fork',
    keywords: `${e.nodeText} ${e.tags}`,
    run: () => go(`/map/${e.map.id}`),
  }
}

function docToItem(d: DocumentSummary): PaletteItem {
  return {
    id: `doc-${d.id}`,
    group: 'documents',
    label: d.title || d.filename,
    sublabel: d.status === 'READY' ? undefined : t(`command_palette.doc_status.${d.status.toLowerCase()}`),
    icon: 'i-lucide-file-text',
    keywords: d.filename,
    run: () => go(`/documents/${d.id}`),
  }
}

function tplToItem(tp: Template): PaletteItem {
  return {
    id: `tpl-${tp.id}`,
    group: 'templates',
    label: tp.title,
    sublabel: tp.description ?? undefined,
    icon: 'i-lucide-layout-template',
    keywords: (tp.tags || []).join(' '),
    run: () => go(`/templates/${tp.slug}`),
  }
}

// ── Ranking ──
// Each ranked entry carries the PRIMARY-field (label) match ranges so the view
// can highlight without re-scoring (scoreFields already returns label ranges).
interface RankedItem { item: PaletteItem; ranges: Array<[number, number]> }

function plain(items: PaletteItem[]): RankedItem[] {
  return items.map(item => ({ item, ranges: [] }))
}

function rank(q: string, items: PaletteItem[], cap: number): RankedItem[] {
  return items
    .map(item => ({ item, r: scoreFields(q, [
      { text: item.label, weight: 1 },
      { text: item.keywords ?? '', weight: 0.5 },
      { text: item.sublabel ?? '', weight: 0.35 },
    ]) }))
    .filter(x => x.r.score > 0)
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, cap)
    .map(x => ({ item: x.item, ranges: x.r.ranges }))
}

function rankMaps(q: string): RankedItem[] {
  return mapIndex.value
    .map(e => ({ e, r: scoreFields(q, [
      { text: e.title, weight: 1 },
      { text: e.nodeText, weight: 0.5 },
      { text: e.tags, weight: 0.45 },
    ]) }))
    .filter(x => x.r.score > 0)
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, GROUP_CAP.maps)
    .map(x => ({ item: mapToItem(x.e), ranges: x.r.ranges }))
}

interface ResultGroup { key: PaletteGroupKey; label: string; items: ScoredItem[] }

/** Build the grouped + flattened view for the current query. */
const view = computed<{ groups: ResultGroup[]; flat: ScoredItem[] }>(() => {
  const q = query.value.trim()
  const byGroup: Partial<Record<PaletteGroupKey, RankedItem[]>> = {}

  if (!q) {
    // Idle state: primary actions, recent maps, navigation (no highlight).
    byGroup.actions = plain(actionItems.value)
    byGroup.maps = plain(mapIndex.value.slice(0, RECENT_MAPS).map(mapToItem))
    byGroup.navigation = plain(navItems.value)
  } else {
    byGroup.generate = [{
      item: {
        id: 'act-generate-query',
        group: 'generate',
        label: t('command_palette.actions.generate_query', { query: q }),
        icon: 'i-lucide-waypoints',
        run: generateFromQuery,
      },
      ranges: [],
    }]
    byGroup.actions = rank(q, actionItems.value, GROUP_CAP.actions)
    byGroup.maps = rankMaps(q)
    byGroup.documents = rank(q, documentList.value.map(docToItem), GROUP_CAP.documents)
    byGroup.templates = rank(q, templateList.value.map(tplToItem), GROUP_CAP.templates)
    byGroup.navigation = rank(q, navItems.value, GROUP_CAP.navigation)
  }

  const groups: ResultGroup[] = []
  const flat: ScoredItem[] = []
  for (const key of GROUP_ORDER) {
    const items = byGroup[key]
    if (!items || items.length === 0) continue
    const scored: ScoredItem[] = items.map((ri) => {
      const entry: ScoredItem = {
        item: ri.item,
        segments: highlightSegments(ri.item.label, ri.ranges),
        flatIndex: flat.length,
      }
      flat.push(entry)
      return entry
    })
    groups.push({ key, label: t(`command_palette.groups.${key}`), items: scored })
  }
  return { groups, flat }
})

// ── Keyboard ──
function handleKeyDown(e: KeyboardEvent) {
  // Keys the palette consumes must NOT leak to window-level shortcuts — the map
  // editor binds Escape/Arrows on window with no input guard, so without
  // stopPropagation, closing the palette with Escape would also reset its tool
  // and close its panels. (Plain Cmd+K is intentionally left to bubble so it can
  // toggle the palette closed.)
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    close()
    return
  }
  if (e.key === 'Tab') {
    // Pin focus to the input (Arrow keys drive selection) so Tab can't walk into
    // the page behind the modal.
    e.preventDefault()
    e.stopPropagation()
    return
  }
  const flat = view.value.flat
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    e.stopPropagation()
    selectedIndex.value = Math.min(selectedIndex.value + 1, flat.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    const entry = flat[selectedIndex.value]
    if (entry) void entry.item.run()
  }
}

function runItem(item: PaletteItem) {
  void item.run()
}

// Keep keyboard selection in range as results shrink/grow.
watch(view, (v) => {
  if (selectedIndex.value > v.flat.length - 1) {
    selectedIndex.value = Math.max(0, v.flat.length - 1)
  }
})

defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="nc-cmdk-enter"
      leave-active-class="nc-cmdk-leave"
      enter-from-class="opacity-0 nc-cmdk-scaled"
      leave-to-class="opacity-0 nc-cmdk-scaled"
    >
      <div
        v-if="isOpen"
        class="nc-cmdk-overlay"
        @click.self="close"
        @keydown="handleKeyDown"
      >
        <div
          class="nc-cmdk-palette"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('command_palette.placeholder')"
        >
          <!-- Input -->
          <div class="nc-cmdk-input-row">
            <span class="i-lucide-search nc-cmdk-search-icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="nc-cmdk-input"
              role="combobox"
              aria-expanded="true"
              aria-controls="nc-cmdk-list"
              :aria-activedescendant="view.flat[selectedIndex] ? `nc-cmdk-opt-${selectedIndex}` : undefined"
              :aria-label="$t('command_palette.placeholder')"
              :placeholder="$t('command_palette.placeholder')"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            >
            <span v-if="loading" class="nc-cmdk-spinner" />
            <kbd class="nc-cmdk-kbd">{{ $t('command_palette.escape_key') }}</kbd>
          </div>

          <!-- Results -->
          <div v-if="view.flat.length" id="nc-cmdk-list" class="nc-cmdk-results" role="listbox">
            <template v-for="group in view.groups" :key="group.key">
              <div class="nc-cmdk-group-heading" role="presentation">{{ group.label }}</div>
              <button
                v-for="entry in group.items"
                :id="`nc-cmdk-opt-${entry.flatIndex}`"
                :key="entry.item.id"
                type="button"
                role="option"
                tabindex="-1"
                :aria-selected="entry.flatIndex === selectedIndex"
                :class="['nc-cmdk-item', entry.flatIndex === selectedIndex && 'selected']"
                @click="runItem(entry.item)"
                @mouseenter="selectedIndex = entry.flatIndex"
              >
                <span :class="['nc-cmdk-item-icon', `g-${entry.item.group}`, entry.item.icon]" />
                <span class="nc-cmdk-item-body">
                  <span class="nc-cmdk-item-label">
                    <template v-for="(seg, i) in entry.segments" :key="i">
                      <mark v-if="seg.match" class="nc-cmdk-mark">{{ seg.text }}</mark>
                      <template v-else>{{ seg.text }}</template>
                    </template>
                  </span>
                  <span v-if="entry.item.sublabel" class="nc-cmdk-item-sub">{{ entry.item.sublabel }}</span>
                </span>
                <span class="i-lucide-corner-down-left nc-cmdk-item-enter" />
              </button>
            </template>
          </div>

          <!-- States -->
          <div v-else-if="loading" class="nc-cmdk-state">
            <span class="nc-cmdk-spinner" />
            <span>{{ $t('command_palette.searching') }}</span>
          </div>
          <div v-else-if="query.trim()" class="nc-cmdk-state nc-cmdk-state--empty">
            <span class="i-lucide-search-x nc-cmdk-state-icon" />
            <span>{{ $t('command_palette.no_results', { query: query.trim() }) }}</span>
          </div>
          <div v-else class="nc-cmdk-state nc-cmdk-state--empty">
            <span class="i-lucide-command nc-cmdk-state-icon" />
            <span>{{ $t('command_palette.empty.subtitle') }}</span>
          </div>

          <!-- Branded footer -->
          <div class="nc-cmdk-footer">
            <span class="nc-cmdk-brand">
              <NcLogo :size="13" :radius="5" :container-size="22" />
              <span class="nc-cmdk-brand-name">NeuroCanvas</span>
            </span>
            <span class="nc-cmdk-hints">
              <kbd>↑</kbd><kbd>↓</kbd><span>{{ $t('command_palette.footer.navigate') }}</span>
              <kbd>↵</kbd><span>{{ $t('command_palette.footer.select') }}</span>
              <kbd>esc</kbd><span>{{ $t('command_palette.footer.dismiss') }}</span>
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nc-cmdk-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--nc-z-modal, 300);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 14vh 16px 16px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
}

.nc-cmdk-palette {
  width: 100%;
  max-width: 600px;
  max-height: 64vh;
  display: flex;
  flex-direction: column;
  background: var(--nc-glass-bg-elevated, rgba(9, 9, 11, 0.92));
  backdrop-filter: blur(var(--nc-glass-blur, 24px));
  border: 1px solid var(--nc-border, #1A1A1E);
  border-radius: var(--nc-radius-lg, 12px);
  box-shadow: var(--nc-shadow-xl, 0 16px 48px rgba(0, 0, 0, 0.6));
  overflow: hidden;
}

/* ── Input ── */
.nc-cmdk-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--nc-border, #1A1A1E);
}

.nc-cmdk-search-icon {
  font-size: calc(18px * var(--nc-text-scale, 1));
  color: var(--nc-ink-soft, #A1A1AA);
  flex-shrink: 0;
}

.nc-cmdk-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: calc(16px * var(--nc-text-scale, 1));
  color: var(--nc-ink, #FAFAFA);
}

.nc-cmdk-input::placeholder {
  color: var(--nc-ink-muted, #71717A);
}

.nc-cmdk-kbd {
  flex-shrink: 0;
  padding: 2px 7px;
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-soft, #A1A1AA);
  background: var(--nc-surface-3, #18181B);
  border: 1px solid var(--nc-border, #1A1A1E);
  border-radius: var(--nc-radius-sm, 6px);
}

/* ── Results ── */
.nc-cmdk-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.nc-cmdk-group-heading {
  padding: 10px 10px 4px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--nc-ink-muted, #71717A);
}

.nc-cmdk-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border: none;
  border-radius: var(--nc-radius-md, 8px);
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: var(--nc-ink, #FAFAFA);
}

.nc-cmdk-item.selected {
  /* Theme-aware: rgba(255,255,255,…) is invisible in light mode. */
  background: var(--nc-surface-hover, rgba(255, 255, 255, 0.07));
}

.nc-cmdk-item-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(16px * var(--nc-text-scale, 1));
  border-radius: var(--nc-radius-sm, 6px);
  background: var(--nc-surface-3, #18181B);
  color: var(--nc-ink-soft, #A1A1AA);
}

/* Per-group accent tint (predefined classes — no inline styles) */
.nc-cmdk-item-icon.g-generate,
.nc-cmdk-item-icon.g-actions {
  color: var(--nc-accent, #00D2BE);
  background: var(--nc-accent-glow, rgba(0, 210, 190, 0.1));
}
.nc-cmdk-item-icon.g-maps { color: var(--nc-node-blue, #60A5FA); }
.nc-cmdk-item-icon.g-documents { color: var(--nc-node-orange, #FB923C); }
.nc-cmdk-item-icon.g-templates { color: var(--nc-node-purple, #A78BFA); }

.nc-cmdk-item.selected .nc-cmdk-item-icon {
  background: var(--nc-accent-glow, rgba(0, 210, 190, 0.12));
  color: var(--nc-accent, #00D2BE);
}

.nc-cmdk-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nc-cmdk-item-label {
  font-size: calc(14px * var(--nc-text-scale, 1));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nc-cmdk-mark {
  background: transparent;
  color: var(--nc-accent, #00D2BE);
  font-weight: 600;
}

.nc-cmdk-item-sub {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #71717A);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nc-cmdk-item-enter {
  flex-shrink: 0;
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #71717A);
  opacity: 0;
}

.nc-cmdk-item.selected .nc-cmdk-item-enter {
  opacity: 1;
}

/* ── States ── */
.nc-cmdk-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #71717A);
}

.nc-cmdk-state-icon {
  font-size: calc(18px * var(--nc-text-scale, 1));
}

/* ── Spinner ── */
.nc-cmdk-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--nc-border-active, #27272A);
  border-top-color: var(--nc-accent, #00D2BE);
  border-radius: 50%;
  animation: nc-cmdk-spin 0.7s linear infinite;
}

/* ── Branded footer ── */
.nc-cmdk-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid var(--nc-border, #1A1A1E);
  background: var(--nc-surface-3, #131316);
}

.nc-cmdk-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nc-cmdk-brand-name {
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--nc-ink-soft, #A1A1AA);
}

.nc-cmdk-hints {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #71717A);
}

.nc-cmdk-hints kbd {
  padding: 1px 5px;
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-ink-soft, #A1A1AA);
  background: var(--nc-surface-4, #1C1C1F);
  border: 1px solid var(--nc-border, #1A1A1E);
  border-radius: 4px;
}

.nc-cmdk-hints span {
  margin-right: 4px;
}

/* ── Transitions ── */
.nc-cmdk-enter {
  transition: opacity 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}
.nc-cmdk-enter .nc-cmdk-palette {
  transition: transform 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}
.nc-cmdk-leave {
  transition: opacity 90ms cubic-bezier(0.4, 0, 1, 1);
}
.nc-cmdk-leave .nc-cmdk-palette {
  transition: transform 90ms cubic-bezier(0.4, 0, 1, 1);
}
.nc-cmdk-scaled .nc-cmdk-palette {
  transform: scale(0.975) translateY(-6px);
}

@keyframes nc-cmdk-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .nc-cmdk-enter,
  .nc-cmdk-enter .nc-cmdk-palette,
  .nc-cmdk-leave,
  .nc-cmdk-leave .nc-cmdk-palette {
    transition: none;
  }
  .nc-cmdk-scaled .nc-cmdk-palette {
    transform: none;
  }
  .nc-cmdk-spinner {
    animation: none;
  }
}

/* Short / landscape viewports (e.g. a phone with the keyboard up): reclaim the
   14vh top offset and give results more room. */
@media (max-height: 560px) {
  .nc-cmdk-overlay {
    padding-top: 6vh;
  }
  .nc-cmdk-palette {
    max-height: 86vh;
  }
}

@media (max-width: 480px) {
  .nc-cmdk-overlay {
    padding-left: 10px;
    padding-right: 10px;
  }
}
</style>
