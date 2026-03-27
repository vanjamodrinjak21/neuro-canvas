import { useMapStore } from '~/stores/mapStore'
import { useUserStore } from '~/stores/userStore'
import { useDatabase } from '~/composables/useDatabase'
import { useSyncEngine } from '~/composables/useSyncEngine'

export interface AutoSaveState {
  isSaving: Ref<boolean>
  lastSavedAt: Ref<number | null>
  lastError: Ref<Error | null>
  isEnabled: Ref<boolean>
}

export interface AutoSaveActions {
  save: () => Promise<void>
  start: () => void
  stop: () => void
  enable: () => void
  disable: () => void
  notifyInteraction: () => void
}

export type AutoSave = AutoSaveState & AutoSaveActions

export function useAutoSave(): AutoSave {
  const mapStore = useMapStore()
  const userStore = useUserStore()
  const db = useDatabase()
  const syncEngine = useSyncEngine()

  // State
  const isSaving = ref(false)
  const lastSavedAt = ref<number | null>(null)
  const lastError = ref<Error | null>(null)
  const isEnabled = ref(true)

  // Internal state
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let isRunning = false
  let lastInteractionTime = 0
  const INTERACTION_COOLDOWN_MS = 2000 // wait 2s after last interaction before saving

  /**
   * Notify auto-save that the user is actively interacting with the canvas
   * (e.g. dragging, resizing, typing). Saves are deferred until the
   * interaction cooldown expires.
   */
  function notifyInteraction() {
    lastInteractionTime = Date.now()
  }

  // Save function
  async function save(): Promise<void> {
    if (isSaving.value) return

    isSaving.value = true
    lastError.value = null

    try {
      const doc = mapStore.toSerializable()
      await db.saveMap(doc)
      mapStore.markClean()
      lastSavedAt.value = Date.now()
      // Trigger cloud sync (fire-and-forget, checks isSyncEnabled internally)
      syncEngine.debouncedPush(doc.id)
    } catch (error) {
      lastError.value = error as Error
      console.error('Auto-save failed:', error)
    } finally {
      isSaving.value = false
    }
  }

  // Schedule next save check
  function scheduleNextCheck() {
    if (!isRunning || !isEnabled.value) return

    const interval = userStore.preferences?.value?.autoSaveInterval ?? 30000

    saveTimer = setTimeout(() => {
      if (mapStore.isDirty && isEnabled.value) {
        // Defer save if user is actively interacting with the canvas
        const timeSinceInteraction = Date.now() - lastInteractionTime
        if (timeSinceInteraction < INTERACTION_COOLDOWN_MS) {
          // Re-check after the cooldown expires
          const remaining = INTERACTION_COOLDOWN_MS - timeSinceInteraction
          saveTimer = setTimeout(() => {
            if (mapStore.isDirty && isEnabled.value) {
              save().finally(scheduleNextCheck)
            } else {
              scheduleNextCheck()
            }
          }, remaining)
          return
        }
        save().finally(scheduleNextCheck)
      } else {
        scheduleNextCheck()
      }
    }, interval)
  }

  // Start auto-save
  function start() {
    if (isRunning) return
    isRunning = true

    // Only start if auto-save is enabled in preferences
    if (userStore.preferences?.value?.autoSave !== false) {
      scheduleNextCheck()
    }
  }

  // Stop auto-save
  function stop() {
    isRunning = false
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  // Enable auto-save
  function enable() {
    isEnabled.value = true
    if (isRunning && !saveTimer) {
      scheduleNextCheck()
    }
  }

  // Disable auto-save
  function disable() {
    isEnabled.value = false
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  // Watch for preference changes
  watch(
    () => userStore.preferences?.value?.autoSave,
    (autoSaveEnabled) => {
      if (autoSaveEnabled === false) {
        disable()
      } else if (isRunning) {
        enable()
      }
    }
  )

  // Cleanup on unmount
  onUnmounted(() => {
    stop()
  })

  return {
    isSaving: readonly(isSaving),
    lastSavedAt: readonly(lastSavedAt),
    lastError: readonly(lastError),
    isEnabled: readonly(isEnabled),
    save,
    start,
    stop,
    enable,
    disable,
    notifyInteraction
  }
}
