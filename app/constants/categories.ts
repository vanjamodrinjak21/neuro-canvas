import type { NodeShape } from '~/types/canvas'

export interface CategoryDefinition {
  label: string
  color: string
  icon: string
  defaultShape: NodeShape
}

export const NODE_CATEGORIES = {
  root:       { label: 'Root',       color: '#00D2BE', icon: 'i-lucide-star',         defaultShape: 'pill'      as NodeShape },
  concept:    { label: 'Concept',    color: '#60A5FA', icon: 'i-lucide-lightbulb',    defaultShape: 'rounded'   as NodeShape },
  fact:       { label: 'Fact',       color: '#4ADE80', icon: 'i-lucide-check-circle', defaultShape: 'rectangle' as NodeShape },
  question:   { label: 'Question',   color: '#FACC15', icon: 'i-lucide-help-circle',  defaultShape: 'diamond'   as NodeShape },
  example:    { label: 'Example',    color: '#FB923C', icon: 'i-lucide-box',          defaultShape: 'circle'    as NodeShape },
  definition: { label: 'Definition', color: '#A78BFA', icon: 'i-lucide-book-open',    defaultShape: 'rounded'   as NodeShape },
  process:    { label: 'Process',    color: '#F472B6', icon: 'i-lucide-workflow',      defaultShape: 'hexagon'   as NodeShape },
  note:       { label: 'Note',       color: '#71717A', icon: 'i-lucide-sticky-note',  defaultShape: 'dot'       as NodeShape },
} as const satisfies Record<string, CategoryDefinition>

export type CategoryId = keyof typeof NODE_CATEGORIES

export const LEGACY_CATEGORY_MAP: Record<string, CategoryId> = {
  'main-fact':   'root',
  'description': 'concept',
  'evidence':    'fact',
  'idea':        'example',
  'reference':   'definition',
}

export const CATEGORY_IDS = Object.keys(NODE_CATEGORIES) as CategoryId[]

export function getCategoryColor(category: string): string {
  return NODE_CATEGORIES[category as CategoryId]?.color ?? '#00D2BE'
}

export function getCategoryInfo(categoryId: string): CategoryDefinition & { id: string } {
  const cat = NODE_CATEGORIES[categoryId as CategoryId]
  if (cat) return { id: categoryId, ...cat }
  return {
    id: 'uncategorized',
    label: 'Uncategorized',
    color: '#555558',
    icon: 'i-lucide-circle',
    defaultShape: 'rounded' as NodeShape,
  }
}

export function resolveCategoryId(id: string): CategoryId {
  if (id in NODE_CATEGORIES) return id as CategoryId
  if (id in LEGACY_CATEGORY_MAP) return LEGACY_CATEGORY_MAP[id]!
  return 'note'
}
