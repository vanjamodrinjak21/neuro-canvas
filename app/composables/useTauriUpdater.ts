/**
 * Tauri auto-updater composable
 * Checks for updates on app launch and provides UI state
 */
export function useTauriUpdater() {
  const updateAvailable = ref(false)
  const updateVersion = ref('')
  const updateBody = ref('')
  const isDownloading = ref(false)
  const downloadProgress = ref(0)
  const error = ref<string | null>(null)

  async function checkForUpdates(): Promise<void> {
    if (typeof window === 'undefined' || !('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) return

    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update) {
        updateAvailable.value = true
        updateVersion.value = update.version
        updateBody.value = update.body ?? ''
      }
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function downloadAndInstall(): Promise<void> {
    if (typeof window === 'undefined' || !('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) return

    try {
      isDownloading.value = true
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update) {
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started' && event.data.contentLength) {
            downloadProgress.value = 0
          } else if (event.event === 'Progress') {
            downloadProgress.value += event.data.chunkLength
          } else if (event.event === 'Finished') {
            downloadProgress.value = 100
          }
        })
        // Restart the app after update
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isDownloading.value = false
    }
  }

  return {
    updateAvailable: readonly(updateAvailable),
    updateVersion: readonly(updateVersion),
    updateBody: readonly(updateBody),
    isDownloading: readonly(isDownloading),
    downloadProgress: readonly(downloadProgress),
    error: readonly(error),
    checkForUpdates,
    downloadAndInstall
  }
}
