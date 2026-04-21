const MODEL_NAME = 'gemma4:2b'

const _isDownloaded = ref(false)
const _isLoaded = ref(false)
const _isDownloading = ref(false)
const _downloadProgress = ref(0)
const _downloadedBytes = ref(0)
const _totalBytes = ref(0)
const _error = ref<string | null>(null)
const _initialized = ref(false)

function _isCapacitor(): boolean {
  return typeof window !== 'undefined' && 'Capacitor' in window
    && !!(window as any).Capacitor?.isNativePlatform?.()
}

export function useLocalLLM() {
  async function getPlugin() {
    const { LocalLLM } = await import('capacitor-plugin-local-llm')
    return LocalLLM
  }

  async function initialize() {
    if (_initialized.value || !_isCapacitor()) return
    _initialized.value = true
    try {
      const plugin = await getPlugin()
      const status = await plugin.getModelStatus({ modelName: MODEL_NAME })
      _isDownloaded.value = status.downloaded
    } catch (e) {
      console.error('[LocalLLM] init check failed:', e)
    }
  }

  async function downloadModel() {
    if (_isDownloading.value) return
    _isDownloading.value = true
    _downloadProgress.value = 0
    _error.value = null

    try {
      const plugin = await getPlugin()

      const { bytes } = await plugin.getAvailableDiskSpace()
      if (bytes < 2_000_000_000) {
        throw new Error('Not enough disk space. At least 2GB free space is required.')
      }

      const listener = await (plugin as any).addListener(
        'downloadProgress',
        (data: { progress: number; bytesDownloaded: number; totalBytes: number }) => {
          _downloadProgress.value = data.progress
          _downloadedBytes.value = data.bytesDownloaded
          _totalBytes.value = data.totalBytes
        }
      )

      await plugin.downloadModel({ modelName: MODEL_NAME })
      listener.remove()

      _isDownloaded.value = true
      _downloadProgress.value = 1
    } catch (e) {
      _error.value = e instanceof Error ? e.message : 'Download failed'
      throw e
    } finally {
      _isDownloading.value = false
    }
  }

  async function deleteModel() {
    try {
      const plugin = await getPlugin()
      await plugin.unloadModel()
      await plugin.deleteModel({ modelName: MODEL_NAME })
      _isDownloaded.value = false
      _isLoaded.value = false
    } catch (e) {
      _error.value = e instanceof Error ? e.message : 'Delete failed'
    }
  }

  async function loadModel() {
    if (_isLoaded.value) return
    if (!_isDownloaded.value) throw new Error('Model not downloaded')

    try {
      const plugin = await getPlugin()
      const { loaded } = await plugin.loadModel({
        modelName: MODEL_NAME,
        contextSize: 4096,
        gpuLayers: 99,
      })
      _isLoaded.value = loaded
      if (!loaded) throw new Error('Failed to load model into memory')
    } catch (e) {
      _error.value = e instanceof Error ? e.message : 'Load failed'
      throw e
    }
  }

  async function generate(options: {
    prompt: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    stopSequences?: string[]
  }): Promise<{ content: string; tokensUsed: number }> {
    if (!_isDownloaded.value) {
      throw new Error('Local AI model not downloaded. Go to Settings to download it.')
    }

    if (!_isLoaded.value) {
      await loadModel()
    }

    const plugin = await getPlugin()
    return plugin.generate({
      prompt: options.prompt,
      systemPrompt: options.systemPrompt,
      maxTokens: Math.min(options.maxTokens || 2048, 2048),
      temperature: options.temperature ?? 0.3,
      stopSequences: options.stopSequences,
    })
  }

  async function getAvailableDiskSpace(): Promise<number> {
    if (!_isCapacitor()) return 0
    const plugin = await getPlugin()
    const { bytes } = await plugin.getAvailableDiskSpace()
    return bytes
  }

  return {
    isAvailable: computed(() => _isCapacitor()),
    isDownloaded: readonly(_isDownloaded),
    isLoaded: readonly(_isLoaded),
    isDownloading: readonly(_isDownloading),
    downloadProgress: readonly(_downloadProgress),
    downloadedBytes: readonly(_downloadedBytes),
    totalBytes: readonly(_totalBytes),
    error: readonly(_error),
    modelName: MODEL_NAME,
    initialize,
    downloadModel,
    deleteModel,
    loadModel,
    generate,
    getAvailableDiskSpace,
  }
}
