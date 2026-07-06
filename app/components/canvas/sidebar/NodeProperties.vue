<script setup lang="ts">
import type { Node } from '~/types'
import type { NodeShape } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'
import { nodeCategories, nodeColors, getCategoryInfo } from '~/composables/useSidebarState'
import { SIDEBAR_DISPATCH_KEY } from '~/types/sidebar'

/**
 * NodeProperties — Property editor for the selected node
 * Redesigned with structured form fields, character count, and footer actions
 */
const props = defineProps<{
  selectedNode: Node | null
}>()

const emit = defineEmits<{
  deleteNode: []
}>()

const dispatch = inject(SIDEBAR_DISPATCH_KEY)!
const mapStore = useMapStore()
const { t } = useI18n()
const toast = useToast()

// Cross-map link (AER-69): a node can point to another of the user's maps.
const crossMapLink = useCrossMapLink()

// Local editing state
const localContent = ref('')
const localNotes = ref('')
const localBorderColor = ref('#2A2A30')
const localCategory = ref<string | null>(null)
const localShape = ref<NodeShape>('rounded')
const localLinkedMapId = ref('')

const labelMaxLength = 50

// Shape definitions with SVG path data for mini previews
const shapeOptions = computed<{ id: NodeShape; label: string; icon: string }[]>(() => [
  { id: 'rounded', label: t('canvas.node_props_form.shape_rounded'), icon: 'i-lucide-square' },
  { id: 'rectangle', label: t('canvas.node_props_form.shape_rectangle'), icon: 'i-lucide-rectangle-horizontal' },
  { id: 'circle', label: t('canvas.node_props_form.shape_circle'), icon: 'i-lucide-circle' },
  { id: 'diamond', label: t('canvas.node_props_form.shape_diamond'), icon: 'i-lucide-diamond' },
  { id: 'hexagon', label: t('canvas.node_props_form.shape_hexagon'), icon: 'i-lucide-hexagon' },
  { id: 'star', label: t('canvas.node_props_form.shape_star'), icon: 'i-lucide-star' },
  { id: 'pill', label: t('canvas.node_props_form.shape_pill'), icon: 'i-lucide-tablet' },
  { id: 'dot', label: t('canvas.node_props_form.shape_dot'), icon: 'i-lucide-circle-dot' },
])

// Sync from prop
watch(() => props.selectedNode, (node) => {
  if (node) {
    localContent.value = node.content
    localNotes.value = (node.metadata?.notes as string) || ''
    localBorderColor.value = node.style.borderColor
    localCategory.value = (node.metadata?.category as string) || null
    localShape.value = node.style.shape || 'rounded'
    localLinkedMapId.value = (node.metadata?.linkedMapId as string) || ''
  }
}, { immediate: true })

// Lazily load the user's other maps the first time a node is selected, so the
// picker has targets. Cheap (IndexedDB) and works in the native SPA build.
watch(() => props.selectedNode?.id, (id) => {
  if (id && crossMapLink.options.value.length === 0 && !crossMapLink.isLoading.value) {
    void crossMapLink.loadOptions()
  }
})

function updateContent() {
  if (props.selectedNode && localContent.value !== props.selectedNode.content) {
    mapStore.updateNode(props.selectedNode.id, { content: localContent.value })
  }
}

function updateNotes() {
  if (props.selectedNode) {
    mapStore.updateNode(props.selectedNode.id, {
      metadata: { ...props.selectedNode.metadata, notes: localNotes.value },
    })
  }
}

function updateBorderColor(color: string) {
  localBorderColor.value = color
  if (props.selectedNode) {
    mapStore.updateNode(props.selectedNode.id, {
      style: { ...props.selectedNode.style, borderColor: color },
    })
  }
}

function updateShape(shape: NodeShape) {
  localShape.value = shape
  if (props.selectedNode) {
    mapStore.updateNode(props.selectedNode.id, {
      style: { ...props.selectedNode.style, shape },
    })
  }
}

function updateCategory(categoryId: string) {
  localCategory.value = categoryId
  if (props.selectedNode) {
    const cat = getCategoryInfo(categoryId)
    mapStore.updateNode(props.selectedNode.id, {
      metadata: { ...props.selectedNode.metadata, category: categoryId },
      style: { ...props.selectedNode.style, borderColor: cat.color },
    })
  }
}

// ─── Cross-map link (AER-69) ─────────────────────────────────────
function updateLinkedMap(mapId: string) {
  localLinkedMapId.value = mapId
  if (props.selectedNode) {
    crossMapLink.setLink(props.selectedNode.id, mapId || null)
  }
}

async function openLinkedMap() {
  const ok = await crossMapLink.navigateToLink(localLinkedMapId.value || null)
  if (!ok && localLinkedMapId.value) {
    // Target map was deleted or is no longer owned — clear the dangling link.
    toast.warning(t('canvas.cross_map_link.target_missing'))
    updateLinkedMap('')
  }
}

const connectionCount = computed(() => {
  if (!props.selectedNode) return 0
  return Array.from(mapStore.edges.values()).filter(
    e => e.sourceId === props.selectedNode!.id || e.targetId === props.selectedNode!.id
  ).length
})

// Category chips for display — colors live in scoped CSS as per-category
// modifier classes bound to the --nc-* node tokens
const categoryChips = computed(() => [
  { id: 'main-fact', label: t('canvas.node_props_form.cat_concept') },
  { id: 'description', label: t('canvas.node_props_form.cat_desc') },
  { id: 'evidence', label: t('canvas.node_props_form.cat_evidence') },
  { id: 'question', label: t('canvas.node_props_form.cat_question') },
  { id: 'idea', label: t('canvas.node_props_form.cat_idea') },
  { id: 'reference', label: t('canvas.node_props_form.cat_ref') },
])

// Selected-node avatar follows the user-chosen node color (data) via v-bind
const avatarColor = computed(() => props.selectedNode?.style?.borderColor || 'var(--nc-accent)')
</script>

<template>
  <div class="properties">
    <template v-if="selectedNode">
      <!-- Node header -->
      <div class="properties__header">
        <div class="properties__avatar">
          <span class="properties__avatar-letter">
            {{ selectedNode.content.charAt(0).toUpperCase() }}
          </span>
        </div>
        <div class="properties__header-info">
          <span class="properties__header-name">{{ selectedNode.content }}</span>
          <span class="properties__header-meta">Root node · {{ connectionCount }} connections</span>
        </div>
        <button class="properties__edit-btn">
          <span class="i-lucide-pencil" />
        </button>
      </div>

      <!-- Form fields -->
      <div class="properties__fields">
        <!-- Category -->
        <div class="properties__field">
          <label class="properties__label">{{ $t('canvas.node_props_form.category') }}</label>
          <div class="properties__categories">
            <button
              v-for="chip in categoryChips"
              :key="chip.id"
              :class="[
                'properties__cat-chip',
                `properties__cat-chip--${chip.id}`,
                localCategory === chip.id && 'properties__cat-chip--active',
              ]"
              @click="updateCategory(chip.id)"
            >
              <span class="properties__cat-dot" />
              <span>{{ chip.label }}</span>
            </button>
          </div>
        </div>

        <!-- Color -->
        <div class="properties__field">
          <label class="properties__label">{{ $t('canvas.node_props_form.color') }}</label>
          <div class="properties__colors">
            <!-- Node palette colors are user data; single custom-property
                 pattern (--swatch) — no arbitrary inline styles -->
            <button
              v-for="color in nodeColors"
              :key="color"
              :class="['properties__color-dot', localBorderColor === color && 'properties__color-dot--active']"
              :style="{ '--swatch': color }"
              @click="updateBorderColor(color)"
            >
              <span
                v-if="localBorderColor === color"
                class="i-lucide-check properties__color-check"
              />
            </button>
          </div>
        </div>

        <!-- Shape -->
        <div class="properties__field">
          <label class="properties__label">{{ $t('canvas.node_props_form.shape') }}</label>
          <div class="properties__shapes">
            <button
              v-for="shape in shapeOptions"
              :key="shape.id"
              :class="['properties__shape-btn', localShape === shape.id && 'properties__shape-btn--active']"
              :title="shape.label"
              @click="updateShape(shape.id)"
            >
              <span :class="[shape.icon, 'properties__shape-icon']" />
              <span class="properties__shape-label">{{ shape.label }}</span>
            </button>
          </div>
        </div>

        <!-- Label -->
        <div class="properties__field">
          <div class="properties__label-row">
            <label class="properties__label">{{ $t('canvas.node_props_form.label') }}</label>
            <span class="properties__char-count">{{ localContent.length }}/{{ labelMaxLength }}</span>
          </div>
          <input
            v-model="localContent"
            type="text"
            :placeholder="$t('canvas.node_panel.label_full_placeholder')"
            class="properties__input"
            :maxlength="labelMaxLength"
            @blur="updateContent"
            @keydown.enter="updateContent"
          >
        </div>

        <!-- Notes -->
        <div class="properties__field">
          <label class="properties__label">{{ $t('canvas.node_props_form.notes') }}</label>
          <textarea
            v-model="localNotes"
            :placeholder="$t('canvas.node_panel.notes_full_placeholder')"
            class="properties__textarea"
            rows="3"
            @blur="updateNotes"
          />
        </div>

        <!-- Cross-map link (AER-69) -->
        <div class="properties__field">
          <div class="properties__label-row">
            <label class="properties__label">{{ $t('canvas.cross_map_link.label') }}</label>
            <span
              v-if="localLinkedMapId"
              class="properties__link-badge"
              :title="$t('canvas.cross_map_link.indicator_tooltip')"
            >
              <span class="i-lucide-link" />
              {{ $t('canvas.cross_map_link.linked') }}
            </span>
          </div>
          <div class="properties__link-row">
            <select
              :value="localLinkedMapId"
              class="properties__input properties__link-select"
              :aria-label="$t('canvas.cross_map_link.label')"
              @change="updateLinkedMap(($event.target as HTMLSelectElement).value)"
            >
              <option value="">{{ $t('canvas.cross_map_link.none') }}</option>
              <option
                v-for="opt in crossMapLink.options.value"
                :key="opt.id"
                :value="opt.id"
              >
                {{ opt.title }}
              </option>
            </select>
            <button
              class="properties__link-open"
              :disabled="!localLinkedMapId"
              :title="$t('canvas.cross_map_link.open')"
              :aria-label="$t('canvas.cross_map_link.open')"
              @click="openLinkedMap"
            >
              <span class="i-lucide-arrow-up-right" />
            </button>
          </div>
        </div>
      </div>

      <!-- Footer actions -->
      <div class="properties__footer">
        <button
          class="properties__footer-btn"
          @click="dispatch({ type: 'node:duplicate' })"
        >
          <span class="i-lucide-copy" />
          {{ $t('canvas.node_props_form.duplicate') }}
        </button>
        <button
          class="properties__footer-btn properties__footer-btn--danger"
          @click="emit('deleteNode')"
        >
          <span class="i-lucide-trash-2" />
          {{ $t('common.buttons.delete') }}
        </button>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else class="properties__empty">
      <span class="i-lucide-mouse-pointer-click properties__empty-icon" />
      <p>{{ $t('canvas.node_props_form.empty_state') }}</p>
    </div>
  </div>
</template>

<style scoped>
.properties {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Header */
.properties__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--nc-border);
  flex-shrink: 0;
}

/* Avatar — user node color (data) via v-bind */
.properties__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  flex-shrink: 0;
  background: color-mix(in srgb, v-bind(avatarColor) 12%, transparent);
  font-family: var(--nc-font-body);
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 700;
}

.properties__avatar-letter {
  color: v-bind(avatarColor);
}

.properties__header-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.properties__header-name {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.properties__header-meta {
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.properties__edit-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  color: var(--nc-text-muted);
  font-size: calc(13px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: color 150ms var(--nc-ease), border-color 150ms var(--nc-ease);
  flex-shrink: 0;
}

.properties__edit-btn:hover {
  color: var(--nc-text-secondary);
  border-color: var(--nc-border-active);
}

/* Fields */
.properties__fields {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

.properties__field {
  margin-bottom: 16px;
}

/* Field label — mono uppercase micro-label (REDESIGN.md §5 inputs) */
.properties__label {
  display: block;
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
  letter-spacing: 0.14em;
  margin-bottom: 6px;
}

.properties__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.properties__label-row .properties__label {
  margin-bottom: 0;
}

.properties__char-count {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

/* Category chips — per-category colors from the --nc-* node tokens */
.properties__categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.properties__cat-chip {
  --chip-color: var(--nc-accent);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: transparent;
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  color: var(--nc-text-muted);
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition: color 150ms var(--nc-ease),
              background 150ms var(--nc-ease),
              border-color 150ms var(--nc-ease);
}

.properties__cat-chip--main-fact { --chip-color: var(--nc-accent); }
.properties__cat-chip--description { --chip-color: var(--nc-node-blue); }
.properties__cat-chip--evidence { --chip-color: var(--nc-node-green); }
.properties__cat-chip--question { --chip-color: var(--nc-node-yellow); }
.properties__cat-chip--idea { --chip-color: var(--nc-node-orange); }
.properties__cat-chip--reference { --chip-color: var(--nc-node-purple); }

.properties__cat-chip:hover {
  border-color: var(--nc-border-active);
  color: var(--nc-text-secondary);
}

.properties__cat-chip--active {
  font-weight: 600;
  background: color-mix(in srgb, var(--chip-color) 10%, transparent);
  border-color: color-mix(in srgb, var(--chip-color) 25%, transparent);
  color: var(--chip-color);
}

.properties__cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chip-color);
  flex-shrink: 0;
}

/* Colors — swatch value is user data via --swatch custom property */
.properties__colors {
  display: flex;
  gap: 8px;
}

.properties__color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background-color: var(--swatch);
  cursor: pointer;
  transition: transform 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.properties__color-dot:hover {
  transform: scale(1.15);
}

.properties__color-dot--active {
  box-shadow: 0 0 0 2px var(--nc-bg), 0 0 0 4px currentColor;
  transform: scale(1.05);
}

.properties__color-check {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-bg);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
}

/* Shapes grid */
.properties__shapes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.properties__shape-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 150ms var(--nc-ease), border-color 150ms var(--nc-ease);
}

.properties__shape-btn:hover {
  border-color: var(--nc-border-active);
  background: var(--nc-surface-3);
}

/* Active shape = accent border + tint marker (never color alone) */
.properties__shape-btn--active {
  border-color: var(--nc-accent);
  background: rgba(var(--nc-accent-rgb), 0.06);
}

.properties__shape-btn--active:hover {
  border-color: var(--nc-accent);
  background: rgba(var(--nc-accent-rgb), 0.1);
}

.properties__shape-icon {
  font-size: calc(16px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  transition: color 150ms var(--nc-ease);
}

.properties__shape-btn:hover .properties__shape-icon {
  color: var(--nc-text-secondary);
}

.properties__shape-btn--active .properties__shape-icon {
  color: var(--nc-accent-text);
}

.properties__shape-label {
  font-family: var(--nc-font-body);
  font-size: calc(9px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-muted);
  letter-spacing: 0.02em;
  transition: color 150ms var(--nc-ease);
}

.properties__shape-btn:hover .properties__shape-label {
  color: var(--nc-text-secondary);
}

.properties__shape-btn--active .properties__shape-label {
  color: var(--nc-accent-text);
  font-weight: 600;
}

/* Input — chip-bg fill, hairline, accent focus border only (no ring) */
.properties__input {
  width: 100%;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  padding: 8px 12px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-family: var(--nc-font-body);
  font-weight: 500;
  color: var(--nc-text);
  transition: border-color 200ms var(--nc-ease);
}

.properties__input::placeholder {
  color: var(--nc-text-dim);
}

.properties__input:focus {
  outline: none;
  border-color: var(--nc-accent);
}

/* Textarea */
.properties__textarea {
  width: 100%;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  padding: 10px 12px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-family: var(--nc-font-body);
  color: var(--nc-ink);
  resize: none;
  min-height: 80px;
  transition: border-color 200ms var(--nc-ease);
}

.properties__textarea::placeholder {
  color: var(--nc-text-dim);
}

.properties__textarea:focus {
  outline: none;
  border-color: var(--nc-accent);
}

/* Cross-map link (AER-69) */
.properties__link-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.properties__link-select {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  appearance: none;
}

.properties__link-open {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  flex-shrink: 0;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  color: var(--nc-accent-text);
  font-size: calc(14px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: border-color 150ms var(--nc-ease),
              background 150ms var(--nc-ease),
              color 150ms var(--nc-ease);
}

.properties__link-open:hover:not(:disabled) {
  border-color: var(--nc-accent);
  background: var(--nc-accent-glow);
}

.properties__link-open:disabled {
  color: var(--nc-text-dim);
  cursor: not-allowed;
}

.properties__link-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--nc-accent-text);
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Footer actions */
.properties__footer {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--nc-border);
  flex-shrink: 0;
}

.properties__footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  color: var(--nc-text-muted);
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition: color 150ms var(--nc-ease),
              background 150ms var(--nc-ease),
              border-color 150ms var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.properties__footer-btn:hover {
  border-color: var(--nc-border-active);
  color: var(--nc-text-secondary);
}

.properties__footer-btn:active {
  transform: scale(0.97);
}

/* Destructive action — coral accent (REDESIGN.md §1) */
.properties__footer-btn--danger {
  background: rgba(var(--nc-coral-rgb), 0.06);
  border-color: rgba(var(--nc-coral-rgb), 0.15);
  color: var(--nc-coral);
}

.properties__footer-btn--danger:hover {
  background: rgba(var(--nc-coral-rgb), 0.1);
  border-color: rgba(var(--nc-coral-rgb), 0.25);
  color: var(--nc-coral);
}

.properties__footer-btn span:first-child {
  font-size: calc(13px * var(--nc-text-scale, 1));
}

/* Empty */
.properties__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 40px 16px;
  color: var(--nc-ink-faint);
  font-size: calc(11px * var(--nc-text-scale, 1));
}

.properties__empty-icon {
  font-size: calc(18px * var(--nc-text-scale, 1));
  opacity: 0.4;
}
</style>
