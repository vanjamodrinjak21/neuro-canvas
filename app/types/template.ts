// Template System Types
import type { Node, Edge, MapSettings, GenerationDepth, GenerationStyle } from '.'

/** Template categories matching the Paper MCP design */
export type TemplateCategory = 'education' | 'business' | 'creative' | 'planning' | 'research'

/** Sort options for template gallery */
export type TemplateSortBy = 'popular' | 'newest' | 'alphabetical'

/** Shape info for CSS-based template preview */
export interface PreviewShape {
  x: number
  y: number
  width: number
  height: number
  color: string
  borderColor?: string
  borderRadius?: number
  label?: string
  fontSize?: number
}

/** Preview data stored with each template for CSS card rendering */
export interface TemplatePreviewData {
  shapes: PreviewShape[]
  width: number
  height: number
}

/** Template as returned from the API */
export interface Template {
  id: string
  slug: string
  title: string
  description: string | null
  category: TemplateCategory
  tags: string[]
  nodeCount: number
  levelCount: number
  previewData: TemplatePreviewData | null
  aiEnhanced: boolean
  isSystem: boolean
  isPublic: boolean
  usageCount: number
  author: {
    id: string
    name: string | null
    image: string | null
  } | null
  createdAt: string
  updatedAt: string
}

/** Full template with node/edge data (for detail view + using) */
export interface TemplateWithData extends Template {
  nodes: Record<string, Node>
  edges: Record<string, Edge>
  settings: Partial<MapSettings> | null
}

/** Payload for publishing a template */
export interface PublishTemplatePayload {
  sourceMapId?: string
  title: string
  description: string
  category: TemplateCategory
  tags: string[]
  aiEnhanced: boolean
  nodes?: Record<string, any>
  edges?: Record<string, any>
  settings?: any
}

/** Payload for AI adapting a template */
export interface AIAdaptPayload {
  templateId: string
  topic: string
  depth: GenerationDepth
  style: GenerationStyle
  domain?: string
}

/** Template gallery filter state */
export interface TemplateFilters {
  category: TemplateCategory | 'all'
  search: string
  sortBy: TemplateSortBy
  myTemplates: boolean
}
