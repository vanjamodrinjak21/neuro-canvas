import { WebPlugin } from '@capacitor/core';
export class LocalLLMWeb extends WebPlugin {
    async downloadModel() {
        throw this.unavailable('Local LLM is only available on iOS and Android.');
    }
    async deleteModel() {
        throw this.unavailable('Local LLM is only available on iOS and Android.');
    }
    async getModelStatus() {
        return { downloaded: false, sizeBytes: 0, path: '' };
    }
    async getAvailableDiskSpace() {
        return { bytes: 0 };
    }
    async loadModel() {
        throw this.unavailable('Local LLM is only available on iOS and Android.');
    }
    async unloadModel() {
        throw this.unavailable('Local LLM is only available on iOS and Android.');
    }
    async generate() {
        throw this.unavailable('Local LLM is only available on iOS and Android.');
    }
}
//# sourceMappingURL=web.js.map