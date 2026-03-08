import type { Node } from '~/types'

// Node category definitions — single source of truth
export const nodeCategories = [
  { id: 'main-fact', label: 'Main Fact', icon: 'i-lucide-star', color: '#00D2BE' },
  { id: 'description', label: 'Description', icon: 'i-lucide-file-text', color: '#60A5FA' },
  { id: 'evidence', label: 'Evidence', icon: 'i-lucide-check-circle', color: '#4ADE80' },
  { id: 'question', label: 'Question', icon: 'i-lucide-help-circle', color: '#FACC15' },
  { id: 'idea', label: 'Idea', icon: 'i-lucide-lightbulb', color: '#FB923C' },
  { id: 'reference', label: 'Reference', icon: 'i-lucide-link', color: '#A78BFA' },
] as const

export type NodeCategory = typeof nodeCategories[number]

export const nodeColors = [
  '#00D2BE', '#A78BFA', '#F472B6', '#60A5FA', '#4ADE80', '#FB923C', '#FACC15'
] as const

// Category color map for AI suggestions
export const categoryColorMap: Record<string, string> = {
  concept: '#60A5FA',
  fact: '#4ADE80',
  question: '#FACC15',
  example: '#FB923C',
  definition: '#A78BFA',
  process: '#F472B6',
  'main-fact': '#00D2BE',
  description: '#60A5FA',
  evidence: '#4ADE80',
  idea: '#FB923C',
  reference: '#A78BFA',
}

export const relationshipBgColors: Record<string, string> = {
  'is-a': 'rgba(96, 165, 250, 0.15)',
  'has-a': 'rgba(167, 139, 250, 0.15)',
  'related-to': 'rgba(136, 136, 144, 0.15)',
  'causes': 'rgba(244, 114, 182, 0.15)',
  'enables': 'rgba(74, 222, 128, 0.15)',
  'opposes': 'rgba(239, 68, 68, 0.15)',
  'example-of': 'rgba(251, 146, 60, 0.15)',
  'part-of': 'rgba(0, 210, 190, 0.15)',
  'leads-to': 'rgba(250, 204, 21, 0.15)',
}

export function getCategoryInfo(categoryId: string): NodeCategory & { id: string } {
  return nodeCategories.find(c => c.id === categoryId) || {
    id: 'uncategorized',
    label: 'Uncategorized',
    icon: 'i-lucide-circle',
    color: '#555558',
  }
}

export function getCategoryColor(category: string): string {
  return categoryColorMap[category] || '#00D2BE'
}

export function getRelationshipBgColor(relationship: string): string {
  return relationshipBgColors[relationship] || 'rgba(136, 136, 144, 0.15)'
}

export function useSidebarState() {
  // Section collapse states
  const collapsedSections = reactive<Record<string, boolean>>({
    explorer: false,
    properties: false,
    ai: false,
    insights: false,
  })

  // Node explorer
  const explorerHeight = ref(220)
  const isResizingExplorer = ref(false)
  const searchQuery = ref('')
  const filterCategory = ref<string | null>(null)
  const resizeStartY = ref(0)
  const resizeStartHeight = ref(0)

  // AI Agent
  const showAgentPanel = ref(false)

  function toggleSection(section: string) {
    collapsedSections[section] = !collapsedSections[section]
  }

  // Explorer resize
  function startExplorerResize(event: MouseEvent) {
    isResizingExplorer.value = true
    resizeStartY.value = event.clientY
    resizeStartHeight.value = explorerHeight.value
    document.addEventListener('mousemove', handleExplorerResize)
    document.addEventListener('mouseup', stopExplorerResize)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  function handleExplorerResize(event: MouseEvent) {
    if (!isResizingExplorer.value) return
    const delta = event.clientY - resizeStartY.value
    explorerHeight.value = Math.max(120, Math.min(450, resizeStartHeight.value + delta))
  }

  function stopExplorerResize() {
    isResizingExplorer.value = false
    document.removeEventListener('mousemove', handleExplorerResize)
    document.removeEventListener('mouseup', stopExplorerResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  return {
    collapsedSections,
    explorerHeight,
    isResizingExplorer,
    searchQuery,
    filterCategory,
    showAgentPanel,
    toggleSection,
    startExplorerResize,
  }
}
