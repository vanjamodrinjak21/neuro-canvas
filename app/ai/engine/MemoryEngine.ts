// User Memory Engine — learns from acceptance/rejection patterns
// Persists to IndexedDB (Tauri) or Redis via server API (web)

interface CategoryStats {
  accepted: number
  rejected: number
  total: number
}

interface RelationshipStats {
  accepted: number
  rejected: number
  total: number
}

interface StylePreferences {
  avgTitleLength: number
  titleLengthSamples: number
  terminologyLevel: 'basic' | 'intermediate' | 'advanced'
  prefersQuestions: boolean
  prefersExamples: boolean
}

interface DomainMemory {
  domain: string
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced'
  sessionCount: number
  lastAccessed: number
}

export interface UserMemoryData {
  categoryStats: Record<string, CategoryStats>
  relationshipStats: Record<string, RelationshipStats>
  stylePreferences: StylePreferences
  rejectedSuggestions: string[] // Last 50 rejected suggestion titles
  domainHistory: Record<string, DomainMemory>
  topCategories: string[]
  updatedAt: number
}

const DEFAULT_MEMORY: UserMemoryData = {
  categoryStats: {},
  relationshipStats: {},
  stylePreferences: {
    avgTitleLength: 3,
    titleLengthSamples: 0,
    terminologyLevel: 'intermediate',
    prefersQuestions: true,
    prefersExamples: true
  },
  rejectedSuggestions: [],
  domainHistory: {},
  topCategories: [],
  updatedAt: Date.now()
}

const MAX_REJECTED_LIST = 50

export class MemoryEngine {
  private data: UserMemoryData = { ...DEFAULT_MEMORY }
  private dirty = false
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Load memory from storage.
   */
  async load(): Promise<void> {
    if (typeof window === 'undefined') return

    try {
      // Try server (Redis) first for web mode
      if (!this.isTauri()) {
        const result = await $fetch<{ data: UserMemoryData | null }>('/api/ai/memory', {
          method: 'GET'
        }).catch(() => null)

        if (result?.data) {
          this.data = { ...DEFAULT_MEMORY, ...result.data }
          return
        }
      }

      // Fallback: IndexedDB via Dexie
      const stored = localStorage.getItem('neurocanvas_user_memory')
      if (stored) {
        this.data = { ...DEFAULT_MEMORY, ...JSON.parse(stored) }
      }
    } catch {
      // Start fresh if loading fails
    }
  }

  /**
   * Persist memory to storage (debounced).
   */
  schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => this.persist(), 2000)
  }

  async persist(): Promise<void> {
    if (!this.dirty) return
    this.data.updatedAt = Date.now()

    try {
      if (!this.isTauri()) {
        await $fetch('/api/ai/memory', {
          method: 'POST',
          body: { data: this.data }
        }).catch(() => null)
      }

      // Always save to localStorage as fallback
      localStorage.setItem('neurocanvas_user_memory', JSON.stringify(this.data))
      this.dirty = false
    } catch {
      // Will retry on next persist
    }
  }

  /**
   * Record feedback on a suggestion.
   */
  recordFeedback(
    suggestion: { title: string; category?: string; relationship?: string },
    accepted: boolean
  ): void {
    // Update category stats
    if (suggestion.category) {
      if (!this.data.categoryStats[suggestion.category]) {
        this.data.categoryStats[suggestion.category] = { accepted: 0, rejected: 0, total: 0 }
      }
      const catStats = this.data.categoryStats[suggestion.category]!
      catStats.total++
      if (accepted) catStats.accepted++
      else catStats.rejected++
    }

    // Update relationship stats
    if (suggestion.relationship) {
      if (!this.data.relationshipStats[suggestion.relationship]) {
        this.data.relationshipStats[suggestion.relationship] = { accepted: 0, rejected: 0, total: 0 }
      }
      const relStats = this.data.relationshipStats[suggestion.relationship]!
      relStats.total++
      if (accepted) relStats.accepted++
      else relStats.rejected++
    }

    // Track title length preferences from accepted suggestions
    if (accepted && suggestion.title) {
      const wordCount = suggestion.title.split(/\s+/).length
      const prefs = this.data.stylePreferences
      prefs.avgTitleLength = (prefs.avgTitleLength * prefs.titleLengthSamples + wordCount) / (prefs.titleLengthSamples + 1)
      prefs.titleLengthSamples++
    }

    // Track rejected suggestions
    if (!accepted && suggestion.title) {
      this.data.rejectedSuggestions.push(suggestion.title)
      if (this.data.rejectedSuggestions.length > MAX_REJECTED_LIST) {
        this.data.rejectedSuggestions = this.data.rejectedSuggestions.slice(-MAX_REJECTED_LIST)
      }
    }

    // Recompute top categories
    this.recomputeTopCategories()

    this.dirty = true
    this.schedulePersist()
  }

  /**
   * Record a domain session.
   */
  recordDomain(domain: string, expertiseLevel: 'beginner' | 'intermediate' | 'advanced'): void {
    if (!this.data.domainHistory[domain]) {
      this.data.domainHistory[domain] = {
        domain,
        expertiseLevel,
        sessionCount: 0,
        lastAccessed: Date.now()
      }
    }

    const entry = this.data.domainHistory[domain]
    entry.sessionCount++
    entry.lastAccessed = Date.now()
    entry.expertiseLevel = expertiseLevel

    this.dirty = true
    this.schedulePersist()
  }

  /**
   * Get category acceptance rate (0-1).
   */
  computeAcceptanceRate(category: string): number {
    const stats = this.data.categoryStats[category]
    if (!stats || stats.total === 0) return 0.5
    return stats.accepted / stats.total
  }

  /**
   * Get category weights — higher weight for categories with higher acceptance.
   */
  computeCategoryWeights(): Record<string, number> {
    const weights: Record<string, number> = {}
    for (const [cat, stats] of Object.entries(this.data.categoryStats)) {
      if (stats.total >= 3) { // Need minimum samples
        weights[cat] = stats.accepted / stats.total
      }
    }
    return weights
  }

  /**
   * Get the top preferred categories.
   */
  getTopCategories(limit = 5): string[] {
    return this.data.topCategories.slice(0, limit)
  }

  /**
   * Get recently rejected suggestion titles (for de-duplication in prompts).
   */
  getRejectedSuggestions(limit = 20): string[] {
    return this.data.rejectedSuggestions.slice(-limit)
  }

  /**
   * Get style preferences for prompt injection.
   */
  getStylePreferences(): StylePreferences {
    return { ...this.data.stylePreferences }
  }

  /**
   * Get domain expertise level.
   */
  getDomainExpertise(domain: string): 'beginner' | 'intermediate' | 'advanced' {
    return this.data.domainHistory[domain]?.expertiseLevel || 'intermediate'
  }

  /**
   * Get full memory data (for prompt injection).
   */
  getData(): UserMemoryData {
    return { ...this.data }
  }

  private recomputeTopCategories(): void {
    const sorted = Object.entries(this.data.categoryStats)
      .filter(([_, stats]) => stats.total >= 3)
      .sort(([_, a], [__, b]) => (b.accepted / b.total) - (a.accepted / a.total))
      .map(([cat]) => cat)

    this.data.topCategories = sorted.slice(0, 10)
  }

  private isTauri(): boolean {
    if (typeof window === 'undefined') return false
    if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) return true
    // Capacitor mobile shells also have no server session — treat them
    // as native so we use localStorage instead of the /api/ai/memory route.
    return 'Capacitor' in window && !!(window as any).Capacitor?.isNativePlatform?.()
  }
}

// Singleton
let _instance: MemoryEngine | null = null

export function getMemoryEngine(): MemoryEngine {
  if (!_instance) {
    _instance = new MemoryEngine()
  }
  return _instance
}
