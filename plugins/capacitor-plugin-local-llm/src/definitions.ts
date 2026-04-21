export interface ModelStatus {
  downloaded: boolean
  sizeBytes: number
  path: string
}

export interface DownloadProgress {
  progress: number
  bytesDownloaded: number
  totalBytes: number
}

export interface GenerateResult {
  content: string
  tokensUsed: number
}

export interface LocalLLMPlugin {
  downloadModel(options: { modelName: string }): Promise<{ success: boolean }>
  deleteModel(options: { modelName: string }): Promise<void>
  getModelStatus(options: { modelName: string }): Promise<ModelStatus>
  getAvailableDiskSpace(): Promise<{ bytes: number }>
  loadModel(options: {
    modelName: string
    contextSize?: number
    gpuLayers?: number
  }): Promise<{ loaded: boolean }>
  unloadModel(): Promise<void>
  generate(options: {
    prompt: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    stopSequences?: string[]
  }): Promise<GenerateResult>
}
