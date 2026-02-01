// Re-export all types
export * from './canvas'

// Platform types
export type Platform = 'web' | 'tauri' | 'capacitor'

// AI Types
export type AIModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface AIModel {
  id: string
  name: string
  status: AIModelStatus
  progress: number
  error?: string
}

export interface AISuggestion {
  id: string
  type: 'expand' | 'connect' | 'layout'
  content: string
  confidence: number
  nodeId?: string
  targetNodeId?: string
}

// User preferences
export interface UserPreferences {
  theme: 'dark' | 'light' | 'system'
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large'
  autoSave: boolean
  autoSaveInterval: number
  showMinimap: boolean
  showGrid: boolean
}

// Storage
export interface StoredMap {
  id: string
  title: string
  data: string // JSON stringified MapDocument
  preview?: string // Base64 thumbnail
  createdAt: number
  updatedAt: number
  tags: string[]
}
