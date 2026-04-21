import { WebPlugin } from '@capacitor/core'
import type { LocalLLMPlugin, ModelStatus, GenerateResult } from './definitions'

export class LocalLLMWeb extends WebPlugin implements LocalLLMPlugin {
  async downloadModel(): Promise<{ success: boolean }> {
    throw this.unavailable('Local LLM is only available on iOS and Android.')
  }
  async deleteModel(): Promise<void> {
    throw this.unavailable('Local LLM is only available on iOS and Android.')
  }
  async getModelStatus(): Promise<ModelStatus> {
    return { downloaded: false, sizeBytes: 0, path: '' }
  }
  async getAvailableDiskSpace(): Promise<{ bytes: number }> {
    return { bytes: 0 }
  }
  async loadModel(): Promise<{ loaded: boolean }> {
    throw this.unavailable('Local LLM is only available on iOS and Android.')
  }
  async unloadModel(): Promise<void> {
    throw this.unavailable('Local LLM is only available on iOS and Android.')
  }
  async generate(): Promise<GenerateResult> {
    throw this.unavailable('Local LLM is only available on iOS and Android.')
  }
}
