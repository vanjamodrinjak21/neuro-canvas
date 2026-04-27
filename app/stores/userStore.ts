import type { UserPreferences } from '~/types'
import { useDatabase } from '~/composables/useDatabase'

/**
 * Default user preferences
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  reducedMotion: false,
  fontSize: 'medium',
  autoSave: true,
  autoSaveInterval: 30000, // 30 seconds
  showMinimap: true,
  showGrid: true,
  language: 'en',
  emailNotifications: true,
  usageAnalytics: false
}

/**
 * User preferences store
 */
const state = reactive({
  preferences: { ...DEFAULT_PREFERENCES },
  isLoaded: false
})

/**
 * Actions for user store
 */
const actions = {
  /**
   * Load preferences from IndexedDB (with localStorage fallback)
   */
  async loadPreferences(): Promise<void> {
    if (typeof window === 'undefined') return

    try {
      const db = useDatabase()

      // Try to load from IndexedDB first
      const storedPrefs = await db.getPreferences(
        'user-preferences',
        DEFAULT_PREFERENCES as unknown as Record<string, unknown>
      ) as unknown as UserPreferences

      if (storedPrefs) {
        Object.assign(state.preferences, storedPrefs)
      } else {
        // Fallback to localStorage for migration
        const stored = localStorage.getItem('neurocanvas-preferences')
        if (stored) {
          const parsed = JSON.parse(stored)
          Object.assign(state.preferences, parsed)
          // Migrate to IndexedDB (plain object to avoid DataCloneError)
          await db.savePreferences('user-preferences', JSON.parse(JSON.stringify(state.preferences)))
          // Clean up localStorage
          localStorage.removeItem('neurocanvas-preferences')
        }
      }

      // Apply theme and cache for instant load on next visit
      actions.applyTheme(state.preferences.theme)
      localStorage.setItem('nc-theme-cache', state.preferences.theme)

      // Listen for OS preference changes so "system" mode updates in real-time
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (state.preferences.theme === 'system') {
          actions.applyTheme('system')
        }
      })

      // Apply reduced motion
      if (state.preferences.reducedMotion) {
        document.documentElement.classList.add('reduce-motion')
      }

      // Apply font size
      actions.applyFontSize(state.preferences.fontSize)

      state.isLoaded = true
    } catch (error) {
      console.error('Failed to load preferences:', error)
      // Use defaults on error
      state.isLoaded = true
    }
  },

  /**
   * Save preferences to IndexedDB
   */
  async savePreferences(): Promise<void> {
    if (typeof window === 'undefined') return

    try {
      const db = useDatabase()
      // Convert reactive proxy to plain object for IndexedDB's structured clone
      const plain = JSON.parse(JSON.stringify(state.preferences))
      await db.savePreferences('user-preferences', plain)
    } catch (error) {
      console.error('Failed to save preferences:', error)
    }
  },

  /**
   * Update a single preference
   */
  async setPreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<void> {
    state.preferences[key] = value
    await actions.savePreferences()

    // Apply side effects
    if (key === 'theme') {
      actions.applyTheme(value as UserPreferences['theme'])
      localStorage.setItem('nc-theme-cache', value as string)
    }
    if (key === 'reducedMotion') {
      if (value) {
        document.documentElement.classList.add('reduce-motion')
      } else {
        document.documentElement.classList.remove('reduce-motion')
      }
    }
    if (key === 'fontSize') {
      actions.applyFontSize(value as UserPreferences['fontSize'])
    }
  },

  applyFontSize(size: UserPreferences['fontSize']): void {
    if (typeof window === 'undefined') return
    document.documentElement.dataset.fontSize = size
  },

  /**
   * Apply theme to document
   */
  applyTheme(theme: UserPreferences['theme']): void {
    if (typeof window === 'undefined') return

    const root = document.documentElement

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('light', !prefersDark)
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('light', theme === 'light')
      root.classList.toggle('dark', theme === 'dark')
    }
  },

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(): Promise<void> {
    Object.assign(state.preferences, DEFAULT_PREFERENCES)
    await actions.savePreferences()
    actions.applyTheme(DEFAULT_PREFERENCES.theme)
    localStorage.setItem('nc-theme-cache', DEFAULT_PREFERENCES.theme)
  }
}

/**
 * Composable for using the user store
 */
export function useUserStore() {
  // Load preferences on first use
  if (!state.isLoaded && typeof window !== 'undefined') {
    actions.loadPreferences()
  }

  return {
    preferences: toRefs(state).preferences,
    isLoaded: toRefs(state).isLoaded,
    ...actions
  }
}

export { state as userState, actions as userActions }
