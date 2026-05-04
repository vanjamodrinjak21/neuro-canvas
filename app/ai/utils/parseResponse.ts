// Centralized JSON response parsing with schema validation

import type { RichNodeSuggestion, MapStructure, TypedConnectionSuggestion, NodeDescription } from '~/types/ai-generation'
import { parseRelationshipType, parseNodeCategory } from '~/utils/ai-prompts'

/**
 * Parse JSON from LLM response (handles markdown code blocks and various formats)
 */
export function parseJsonResponse<T>(content: string): T {
  if (!content || !content.trim()) {
    throw new Error('AI returned an empty response. Try again — the model may have timed out.')
  }

  // Build the candidate list of JSON substrings, in priority order.
  const candidates: string[] = []

  // 1. Markdown ```json fenced blocks (Claude often wraps even when told not to)
  const fenceMatches = [...content.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)]
  for (const m of fenceMatches) {
    if (m[1]) candidates.push(m[1])
  }

  // 2. Largest brace-balanced object substring
  const braced = extractBalanced(content, '{', '}')
  if (braced) candidates.push(braced)

  // 3. Largest bracket-balanced array substring
  const bracketed = extractBalanced(content, '[', ']')
  if (bracketed) candidates.push(bracketed)

  // 4. Greedy fallbacks (first { … last }, first [ … last ])
  const objectGreedy = content.match(/\{[\s\S]*\}/)?.[0]
  const arrayGreedy = content.match(/\[[\s\S]*\]/)?.[0]
  if (objectGreedy) candidates.push(objectGreedy)
  if (arrayGreedy) candidates.push(arrayGreedy)

  // 5. Raw content as last resort
  candidates.push(content)

  // Try each candidate through the repair pipeline.
  for (const raw of candidates) {
    const result = tryParse<T>(raw)
    if (result !== undefined) return result
  }

  // Final salvage attempt
  const partial = extractPartialJson<T>(content)
  if (partial !== null) return partial

  if (typeof console !== 'undefined') {
    console.error('[parseJsonResponse] could not parse AI output:', content.slice(0, 500))
  }
  const preview = content.length > 120 ? content.slice(0, 120) + '…' : content
  throw new Error(`Failed to parse AI response. The model returned malformed output — try again or use a larger model. Got: "${preview.replace(/\s+/g, ' ').trim()}"`)
}

function tryParse<T>(jsonStr: string): T | undefined {
  const trimmed = jsonStr.trim()
  if (!trimmed) return undefined

  // Attempt 1: parse as-is
  try { return JSON.parse(trimmed) } catch { /* keep trying */ }

  // Attempt 2: fix common LLM JSON issues
  let cleaned = trimmed
    .replace(/,\s*\}/g, '}')
    .replace(/,\s*\]/g, ']')
    .replace(/(?<=[[{,:])\s*'/g, ' "')
    .replace(/'\s*(?=[,\]}])/g, '"')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
      return match.replace(/(?<!\\)\n/g, '\\n').replace(/(?<!\\)\r/g, '\\r').replace(/(?<!\\)\t/g, '\\t')
    })
  try { return JSON.parse(cleaned) } catch { /* keep trying */ }

  // Attempt 3: repair truncated JSON (LLM hit token limit)
  cleaned = repairTruncatedJson(cleaned)
  try { return JSON.parse(cleaned) } catch { /* keep trying */ }

  return undefined
}

/**
 * Find the longest balanced substring between the given open/close characters.
 * Skips characters inside strings.
 */
function extractBalanced(source: string, open: string, close: string): string | null {
  let best: string | null = null
  let bestLen = 0
  for (let start = 0; start < source.length; start++) {
    if (source[start] !== open) continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < source.length; i++) {
      const ch = source[i]
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) {
          const len = i - start + 1
          if (len > bestLen) {
            best = source.slice(start, i + 1)
            bestLen = len
          }
          break
        }
      }
    }
  }
  return best
}

/**
 * Attempt to repair JSON that was truncated mid-output by closing
 * unclosed arrays, objects and strings.
 */
function repairTruncatedJson(json: string): string {
  let result = json.trim()

  // If it ends mid-string, close the string
  let inString = false
  let escaped = false
  for (let i = 0; i < result.length; i++) {
    const ch = result[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') inString = !inString
  }
  if (inString) {
    result += '"'
  }

  // Remove trailing comma, incomplete key-value pairs like `"key":` or `"key"`
  result = result.replace(/,\s*$/, '')
  // Remove dangling key without value: `"someKey":` at end
  result = result.replace(/,?\s*"[^"]*"\s*:\s*$/, '')
  // Remove dangling key without colon: `"someKey"` at end of object (not a value)
  result = result.replace(/,?\s*"[^"]*"\s*$/, (match) => {
    // Only strip if we're inside an object context (last open bracket was {)
    const lastBrace = result.lastIndexOf('{')
    const lastBracket = result.lastIndexOf('[')
    if (lastBrace > lastBracket) return '' // inside object — strip dangling key
    return match // inside array — keep as array element
  })

  // Remove trailing commas again after cleanup
  result = result.replace(/,\s*$/, '')

  // Count unclosed brackets and close them
  const stack: string[] = []
  inString = false
  escaped = false
  for (let i = 0; i < result.length; i++) {
    const ch = result[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') stack.push(ch)
    if (ch === '}' || ch === ']') stack.pop()
  }

  // Close unclosed brackets in reverse order
  while (stack.length > 0) {
    const open = stack.pop()
    result += open === '{' ? '}' : ']'
  }

  return result
}

/**
 * Attempt progressive JSON extraction — try parsing increasingly
 * truncated versions of the response to salvage as much as possible.
 */
function extractPartialJson<T>(content: string): T | null {
  // Find the outermost { or [
  const objStart = content.indexOf('{')
  const arrStart = content.indexOf('[')
  if (objStart === -1 && arrStart === -1) return null

  const start = (objStart === -1) ? arrStart
    : (arrStart === -1) ? objStart
    : Math.min(objStart, arrStart)
  let json = content.slice(start)

  // Try progressively shorter versions (trim from the end)
  for (let trim = 0; trim < 5; trim++) {
    if (trim > 0) {
      // Remove the last incomplete element (after last complete comma)
      const lastComma = json.lastIndexOf(',')
      if (lastComma === -1) break
      json = json.slice(0, lastComma)
    }

    const repaired = repairTruncatedJson(json)
    try {
      return JSON.parse(repaired)
    } catch {
      continue
    }
  }

  return null
}

/**
 * Validate and normalize RichNodeSuggestion array from LLM response
 */
export function validateRichNodeSuggestions(
  raw: unknown[],
  maxCount?: number
): RichNodeSuggestion[] {
  if (!Array.isArray(raw)) return []

  const result = raw.map((s: unknown) => {
    const suggestion = s as Record<string, unknown>
    return {
      title: String(suggestion.title || '').slice(0, 100),
      description: {
        summary: String((suggestion.description as Record<string, unknown>)?.summary || ''),
        details: (suggestion.description as Record<string, unknown>)?.details
          ? String((suggestion.description as Record<string, unknown>).details)
          : undefined,
        keywords: Array.isArray((suggestion.description as Record<string, unknown>)?.keywords)
          ? ((suggestion.description as Record<string, unknown>).keywords as unknown[]).map(String)
          : [],
        generatedAt: Date.now()
      },
      category: parseNodeCategory(String(suggestion.category || 'concept')),
      relationshipToParent: suggestion.relationshipToParent
        ? parseRelationshipType(String(suggestion.relationshipToParent))
        : undefined,
      suggestedChildren: suggestion.suggestedChildren
        ? validateRichNodeSuggestions(suggestion.suggestedChildren as unknown[])
        : undefined,
      confidence: typeof suggestion.confidence === 'number'
        ? Math.max(0, Math.min(1, suggestion.confidence))
        : 0.8
    }
  })

  return maxCount ? result.slice(0, maxCount) : result
}

/**
 * Validate and normalize MapStructure from LLM response
 */
export function validateMapStructure(
  raw: Record<string, unknown>,
  fallbackTopic?: string
): MapStructure {
  // Some models truncate or omit the top-level rootTopic. As long as we can
  // recover at least one branch, fall back to the user's prompt as the root.
  const branchesRaw = Array.isArray(raw.branches)
    ? raw.branches
    : (Array.isArray((raw as { children?: unknown[] }).children)
        ? (raw as { children: unknown[] }).children
        : [])
  if (branchesRaw.length === 0 && !raw.rootTopic && !fallbackTopic) {
    throw new Error('Invalid map structure response')
  }

  return {
    rootTopic: String(raw.rootTopic || fallbackTopic || 'Untitled Map'),
    rootDescription: {
      summary: String((raw.rootDescription as Record<string, unknown>)?.summary || ''),
      keywords: Array.isArray((raw.rootDescription as Record<string, unknown>)?.keywords)
        ? ((raw.rootDescription as Record<string, unknown>).keywords as unknown[]).map(String)
        : [],
      generatedAt: Date.now()
    },
    branches: normalizeBranches(branchesRaw),
    crossConnections: raw.crossConnections as MapStructure['crossConnections']
  }
}

function normalizeBranches(branches: unknown[]): MapStructure['branches'] {
  if (!Array.isArray(branches)) return []

  return branches.map((branch: unknown) => {
    const b = branch as Record<string, unknown>
    return {
      title: String(b.title || ''),
      description: {
        summary: String((b.description as Record<string, unknown>)?.summary || ''),
        keywords: Array.isArray((b.description as Record<string, unknown>)?.keywords)
          ? ((b.description as Record<string, unknown>).keywords as unknown[]).map(String)
          : [],
        generatedAt: Date.now()
      },
      category: parseNodeCategory(String(b.category || 'concept')),
      children: normalizeBranches((b.children as unknown[]) || []),
      depth: typeof b.depth === 'number' ? b.depth : 0
    }
  })
}

/**
 * Validate and normalize TypedConnectionSuggestion array
 */
export function validateTypedConnections(
  raw: unknown[],
  validNodeIds: Set<string>,
  existingEdges: Set<string>,
  maxCount?: number
): TypedConnectionSuggestion[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((s: unknown) => {
      const conn = s as Record<string, unknown>
      if (!validNodeIds.has(String(conn.sourceId)) || !validNodeIds.has(String(conn.targetId))) return false
      if (existingEdges.has(`${conn.sourceId}-${conn.targetId}`)) return false
      if (existingEdges.has(`${conn.targetId}-${conn.sourceId}`)) return false
      return true
    })
    .slice(0, maxCount || 10)
    .map((s: unknown) => {
      const conn = s as Record<string, unknown>
      return {
        sourceId: String(conn.sourceId),
        targetId: String(conn.targetId),
        relationshipType: parseRelationshipType(String(conn.relationshipType || 'related-to')),
        reason: String(conn.reason || ''),
        confidence: typeof conn.confidence === 'number'
          ? Math.max(0, Math.min(1, conn.confidence))
          : 0.8
      }
    })
}

/**
 * Validate and normalize NodeDescription
 */
export function validateNodeDescription(raw: Record<string, unknown>): NodeDescription {
  return {
    summary: String(raw.summary || ''),
    details: raw.details ? String(raw.details) : undefined,
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
    generatedAt: Date.now()
  }
}
