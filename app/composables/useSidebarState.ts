import type { Node } from '~/types'
import {
  NODE_CATEGORIES,
  getCategoryColor,
  getCategoryInfo,
  type CategoryId,
  type CategoryDefinition
} from '~/constants/categories'

// Re-export for backward compatibility — consumers that import from here
export const nodeCategories = Object.entries(NODE_CATEGORIES).map(
  ([id, cat]) => ({ id, ...cat })
)

export type NodeCategory = typeof nodeCategories[number]

export { getCategoryColor, getCategoryInfo }

export const nodeColors = [
  '#00D2BE', '#A78BFA', '#F472B6', '#60A5FA', '#4ADE80', '#FB923C', '#FACC15'
] as const

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

export function getRelationshipBgColor(relationship: string): string {
  return relationshipBgColors[relationship] || 'rgba(136, 136, 144, 0.15)'
}

export type SidebarTab = 'explorer' | 'properties' | 'ai'

export function useSidebarState() {
  // Active tab (replaces section collapse for main layout)
  const activeTab = ref<SidebarTab>('explorer')

  function setActiveTab(tab: SidebarTab) {
    activeTab.value = tab
  }

  // Section collapse states (kept for backward compat)
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
    activeTab,
    setActiveTab,
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
