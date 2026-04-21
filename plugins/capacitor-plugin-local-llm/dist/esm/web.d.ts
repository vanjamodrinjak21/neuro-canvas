import { WebPlugin } from '@capacitor/core';
import type { LocalLLMPlugin, ModelStatus, GenerateResult } from './definitions';
export declare class LocalLLMWeb extends WebPlugin implements LocalLLMPlugin {
    downloadModel(): Promise<{
        success: boolean;
    }>;
    deleteModel(): Promise<void>;
    getModelStatus(): Promise<ModelStatus>;
    getAvailableDiskSpace(): Promise<{
        bytes: number;
    }>;
    loadModel(): Promise<{
        loaded: boolean;
    }>;
    unloadModel(): Promise<void>;
    generate(): Promise<GenerateResult>;
}
