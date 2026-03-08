// Schema validation for all AI response types

import type { RichNodeSuggestion, MapStructure, BranchStructure, TypedConnectionSuggestion, CrossConnection, NodeCategory, RelationshipType } from '~/types/ai-generation'
import type { NodeDescription } from '~/types/canvas'

interface ValidationResult<T> {
  valid: boolean
  data?: T
  errors?: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const VALID_CATEGORIES: Set<string> = new Set(['concept', 'fact', 'question', 'example', 'definition', 'process'])
const VALID_RELATIONSHIPS: Set<string> = new Set([
  'is-a', 'has-a', 'related-to', 'causes', 'enables', 'opposes', 'example-of', 'part-of', 'leads-to',
  'extends', 'implements', 'prerequisite-for', 'alternative-to', 'evidence-for', 'evidence-against',
  'depends-on', 'influences', 'precedes', 'follows', 'co-occurs', 'trade-off', 'stronger-than', 'complements'
])

function parseCategory(val: unknown): NodeCategory {
  if (typeof val === 'string' && VALID_CATEGORIES.has(val)) return val as NodeCategory
  return 'concept'
}

function parseRelationship(val: unknown): RelationshipType {
  if (typeof val === 'string' && VALID_RELATIONSHIPS.has(val)) return val as RelationshipType
  return 'related-to'
}

function parseNodeDescription(val: unknown): NodeDescription {
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>
    if (typeof obj.summary === 'string') {
      return {
        summary: obj.summary,
        details: typeof obj.details === 'string' ? obj.details : undefined,
        keywords: Array.isArray(obj.keywords) ? (obj.keywords as unknown[]).filter((k): k is string => typeof k === 'string') : undefined,
        generatedAt: Date.now()
      }
    }
  }
  // If it's a plain string, treat as summary
  if (typeof val === 'string') {
    return { summary: val, generatedAt: Date.now() }
  }
  return { summary: '', generatedAt: Date.now() }
}

/**
 * Validate an array of RichNodeSuggestion objects.
 */
export function validateRichNodeSuggestions(raw: unknown): ValidationResult<RichNodeSuggestion[]> {
  const errors: string[] = []

  if (!Array.isArray(raw)) {
    return { valid: false, errors: ['Expected an array of suggestions'] }
  }

  const suggestions: RichNodeSuggestion[] = []

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item || typeof item !== 'object') {
      errors.push(`Item ${i}: not an object`)
      continue
    }

    const obj = item as Record<string, unknown>

    if (!obj.title || typeof obj.title !== 'string') {
      errors.push(`Item ${i}: missing or invalid title`)
      continue
    }

    const suggestion: RichNodeSuggestion = {
      title: obj.title.trim(),
      description: parseNodeDescription(obj.description),
      category: parseCategory(obj.category),
      relationshipToParent: obj.relationshipToParent ? parseRelationship(obj.relationshipToParent) : undefined,
      confidence: typeof obj.confidence === 'number' ? clamp(obj.confidence, 0, 1) : 0.5
    }

    suggestions.push(suggestion)
  }

  if (suggestions.length === 0 && errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, data: suggestions, errors: errors.length > 0 ? errors : undefined }
}

function parseBranch(obj: Record<string, unknown>, depth: number): BranchStructure | null {
  if (!obj.title || typeof obj.title !== 'string') return null

  return {
    title: (obj.title as string).trim(),
    description: parseNodeDescription(obj.description),
    category: parseCategory(obj.category),
    depth,
    children: Array.isArray(obj.children)
      ? (obj.children as Array<Record<string, unknown>>)
          .map(c => (c && typeof c === 'object') ? parseBranch(c, depth + 1) : null)
          .filter((b): b is BranchStructure => b !== null)
      : []
  }
}

/**
 * Validate a MapStructure object.
 */
export function validateMapStructure(raw: unknown): ValidationResult<MapStructure> {
  const errors: string[] = []

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Expected an object'] }
  }

  const obj = raw as Record<string, unknown>

  // Validate rootTopic — accept 'title' as alias
  const rootTopic = typeof obj.rootTopic === 'string' ? obj.rootTopic.trim()
    : typeof obj.title === 'string' ? (obj.title as string).trim()
    : 'Untitled Map'
  if (!obj.rootTopic && !obj.title) errors.push('Missing rootTopic, using default')

  const rootDescription = parseNodeDescription(obj.rootDescription || obj.description)

  // Validate branches
  if (!Array.isArray(obj.branches)) {
    return { valid: false, errors: ['Missing or invalid branches array'] }
  }

  const branches: BranchStructure[] = []
  for (let i = 0; i < obj.branches.length; i++) {
    const branch = obj.branches[i] as Record<string, unknown>
    if (!branch || typeof branch !== 'object') {
      errors.push(`Branch ${i}: not an object`)
      continue
    }
    const parsed = parseBranch(branch, 0)
    if (parsed) branches.push(parsed)
    else errors.push(`Branch ${i}: missing title`)
  }

  if (branches.length === 0) {
    return { valid: false, errors: ['No valid branches found'] }
  }

  // Validate optional cross-connections
  const crossConnections: CrossConnection[] | undefined = Array.isArray(obj.crossConnections)
    ? (obj.crossConnections as Array<Record<string, unknown>>)
        .filter(c => c && typeof c === 'object')
        .map(c => ({
          sourceRef: (typeof c.sourceRef === 'string' ? c.sourceRef : typeof c.from === 'string' ? c.from : '') as string,
          targetRef: (typeof c.targetRef === 'string' ? c.targetRef : typeof c.to === 'string' ? c.to : '') as string,
          relationshipType: parseRelationship(c.relationshipType || c.relationship),
          reason: typeof c.reason === 'string' ? c.reason : typeof c.description === 'string' ? c.description : undefined
        }))
        .filter(c => c.sourceRef && c.targetRef)
    : undefined

  const result: MapStructure = {
    rootTopic,
    rootDescription,
    branches,
    crossConnections
  }

  return { valid: true, data: result, errors: errors.length > 0 ? errors : undefined }
}

/**
 * Validate an array of TypedConnectionSuggestion objects.
 */
export function validateTypedConnections(raw: unknown): ValidationResult<TypedConnectionSuggestion[]> {
  const errors: string[] = []

  if (!Array.isArray(raw)) {
    return { valid: false, errors: ['Expected an array of connections'] }
  }

  const connections: TypedConnectionSuggestion[] = []

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item || typeof item !== 'object') {
      errors.push(`Item ${i}: not an object`)
      continue
    }

    const obj = item as Record<string, unknown>

    const sourceId = typeof obj.sourceId === 'string' ? obj.sourceId : typeof obj.sourceTitle === 'string' ? obj.sourceTitle : ''
    const targetId = typeof obj.targetId === 'string' ? obj.targetId : typeof obj.targetTitle === 'string' ? obj.targetTitle : ''

    if (!sourceId || !targetId) {
      errors.push(`Item ${i}: missing sourceId or targetId`)
      continue
    }

    connections.push({
      sourceId,
      targetId,
      relationshipType: parseRelationship(obj.relationshipType || obj.relationship),
      reason: typeof obj.reason === 'string' ? obj.reason : typeof obj.description === 'string' ? obj.description : '',
      confidence: typeof obj.confidence === 'number' ? clamp(obj.confidence, 0, 1) : 0.5
    })
  }

  if (connections.length === 0 && errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, data: connections, errors: errors.length > 0 ? errors : undefined }
}

/**
 * Validate a node description response.
 */
export function validateNodeDescription(raw: unknown): ValidationResult<NodeDescription> {
  if (typeof raw === 'string') {
    return { valid: true, data: { summary: raw, generatedAt: Date.now() } }
  }

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Expected an object or string'] }
  }

  const desc = parseNodeDescription(raw)
  if (!desc.summary) {
    return { valid: false, errors: ['Missing summary'] }
  }

  return { valid: true, data: desc }
}
