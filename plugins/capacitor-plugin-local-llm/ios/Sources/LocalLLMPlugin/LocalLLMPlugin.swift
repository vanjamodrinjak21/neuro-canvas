import Foundation
import Capacitor

@objc(LocalLLMPlugin)
public class LocalLLMPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocalLLMPlugin"
    public let jsName = "LocalLLM"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "downloadModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getModelStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAvailableDiskSpace", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unloadModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
    ]

    private let engine = LlamaEngine()
    private let manager = ModelManager.shared

    @objc func downloadModel(_ call: CAPPluginCall) {
        guard let modelName = call.getString("modelName") else {
            call.reject("modelName is required")
            return
        }
        Task {
            do {
                try await manager.downloadModel(modelName) { [weak self] progress, downloaded, total in
                    self?.notifyListeners("downloadProgress", data: [
                        "progress": progress,
                        "bytesDownloaded": downloaded,
                        "totalBytes": total
                    ])
                }
                call.resolve(["success": true])
            } catch {
                call.reject("Download failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func deleteModel(_ call: CAPPluginCall) {
        guard let modelName = call.getString("modelName") else {
            call.reject("modelName is required")
            return
        }
        do {
            engine.unload()
            try manager.deleteModel(modelName)
            call.resolve()
        } catch {
            call.reject("Delete failed: \(error.localizedDescription)")
        }
    }

    @objc func getModelStatus(_ call: CAPPluginCall) {
        guard let modelName = call.getString("modelName") else {
            call.reject("modelName is required")
            return
        }
        call.resolve([
            "downloaded": manager.isDownloaded(modelName),
            "sizeBytes": manager.modelSize(modelName),
            "path": manager.modelPath(modelName).path
        ])
    }

    @objc func getAvailableDiskSpace(_ call: CAPPluginCall) {
        call.resolve(["bytes": manager.availableDiskSpace()])
    }

    @objc func loadModel(_ call: CAPPluginCall) {
        guard let modelName = call.getString("modelName") else {
            call.reject("modelName is required")
            return
        }
        let contextSize = Int32(call.getInt("contextSize") ?? 4096)
        let gpuLayers = Int32(call.getInt("gpuLayers") ?? 99)
        let path = manager.modelPath(modelName).path

        Task.detached { [engine] in
            do {
                try engine.load(modelPath: path, contextSize: contextSize, gpuLayers: gpuLayers)
                call.resolve(["loaded": true])
            } catch {
                call.reject("Load failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func unloadModel(_ call: CAPPluginCall) {
        engine.unload()
        call.resolve()
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt") else {
            call.reject("prompt is required")
            return
        }
        let systemPrompt = call.getString("systemPrompt")
        let maxTokens = call.getInt("maxTokens") ?? 2048
        let temperature = call.getFloat("temperature") ?? 0.3
        let stopSequences = call.getArray("stopSequences", String.self) ?? []

        Task.detached { [engine] in
            do {
                let result = try engine.generate(
                    prompt: prompt,
                    systemPrompt: systemPrompt,
                    maxTokens: maxTokens,
                    temperature: temperature,
                    stopSequences: stopSequences
                )
                call.resolve([
                    "content": result.content,
                    "tokensUsed": result.tokensUsed
                ])
            } catch {
                call.reject("Generation failed: \(error.localizedDescription)")
            }
        }
    }
}
