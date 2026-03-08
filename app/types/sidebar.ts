import type { InjectionKey } from 'vue'
import type { AISuggestion, RichNodeSuggestion } from '~/types'
import type { Insight } from '~/types/semantic'
import type { AgentAction } from '~/ai/types/agent'
import type { NodeCategory } from '~/composables/useSidebarState'

export type SidebarAction =
  | { type: 'nav:navigate-to-node'; nodeId: string }
  | { type: 'nav:toggle-sidebar' }
  | { type: 'node:add' }
  | { type: 'node:add-categorized'; category: NodeCategory }
  | { type: 'node:duplicate' }
  | { type: 'node:delete' }
  | { type: 'ai:smart-expand' }
  | { type: 'ai:deep-expand' }
  | { type: 'ai:add-suggestion'; suggestion: AISuggestion }
  | { type: 'ai:add-rich-suggestion'; suggestion: RichNodeSuggestion }
  | { type: 'ai:generate-map' }
  | { type: 'ai:generate-description' }
  | { type: 'insight:add-node'; insight: Insight }
  | { type: 'insight:highlight-nodes'; nodeIds: string[] }
  | { type: 'insight:clear-highlights' }
  | { type: 'agent:apply-action'; action: AgentAction }
  | { type: 'drag:start-category'; category: NodeCategory }
  | { type: 'drag:start-node'; nodeId: string }

export const SIDEBAR_DISPATCH_KEY = Symbol('sidebarDispatch') as InjectionKey<
  (action: SidebarAction) => void
>
