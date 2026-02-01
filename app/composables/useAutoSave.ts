import { useMapStore } from '~/stores/mapStore'
import { useUserStore } from '~/stores/userStore'
import { useDatabase } from '~/composables/useDatabase'

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
}

export type AutoSave = AutoSaveState & AutoSaveActions

export function useAutoSave(): AutoSave {
  const mapStore = useMapStore()
  const userStore = useUserStore()
  const db = useDatabase()

  // State
  const isSaving = ref(false)
  const lastSavedAt = ref<number | null>(null)
  const lastError = ref<Error | null>(null)
  const isEnabled = ref(true)

  // Internal state
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let isRunning = false

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

    const interval = userStore.preferences.value?.autoSaveInterval ?? 30000

    saveTimer = setTimeout(() => {
      if (mapStore.isDirty && isEnabled.value) {
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
    if (userStore.preferences.value?.autoSave !== false) {
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
    () => userStore.preferences.value?.autoSave,
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
    disable
  }
}
