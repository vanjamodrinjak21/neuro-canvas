import Foundation

class ModelManager {
    static let shared = ModelManager()

    private let modelsDir: URL = {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = docs.appendingPathComponent("models", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private let registryBase = "https://registry.ollama.ai"

    func modelPath(_ modelName: String) -> URL {
        modelsDir.appendingPathComponent("\(modelName.replacingOccurrences(of: ":", with: "-")).gguf")
    }

    func isDownloaded(_ modelName: String) -> Bool {
        FileManager.default.fileExists(atPath: modelPath(modelName).path)
    }

    func modelSize(_ modelName: String) -> Int64 {
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: modelPath(modelName).path),
              let size = attrs[.size] as? Int64 else { return 0 }
        return size
    }

    func availableDiskSpace() -> Int64 {
        guard let attrs = try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory()),
              let space = attrs[.systemFreeSize] as? Int64 else { return 0 }
        return space
    }

    func deleteModel(_ modelName: String) throws {
        let path = modelPath(modelName)
        if FileManager.default.fileExists(atPath: path.path) {
            try FileManager.default.removeItem(at: path)
        }
    }

    func downloadModel(
        _ modelName: String,
        onProgress: @escaping (Double, Int64, Int64) -> Void
    ) async throws {
        let parts = modelName.split(separator: ":")
        let library = String(parts[0])
        let tag = parts.count > 1 ? String(parts[1]) : "latest"

        let manifestURL = URL(string: "\(registryBase)/v2/library/\(library)/manifests/\(tag)")!
        var manifestReq = URLRequest(url: manifestURL)
        manifestReq.setValue("application/vnd.docker.distribution.manifest.v2+json", forHTTPHeaderField: "Accept")

        let (manifestData, _) = try await URLSession.shared.data(for: manifestReq)
        let manifest = try JSONSerialization.jsonObject(with: manifestData) as? [String: Any]

        guard let layers = manifest?["layers"] as? [[String: Any]] else {
            throw NSError(domain: "LocalLLM", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid manifest: no layers"])
        }

        let modelLayer = layers
            .sorted { ($0["size"] as? Int64 ?? 0) > ($1["size"] as? Int64 ?? 0) }
            .first { layer in
                let mediaType = layer["mediaType"] as? String ?? ""
                let size = layer["size"] as? Int64 ?? 0
                return mediaType.contains("model") || size > 100_000_000
            }

        guard let digest = modelLayer?["digest"] as? String,
              let totalSize = modelLayer?["size"] as? Int64 else {
            throw NSError(domain: "LocalLLM", code: 2, userInfo: [NSLocalizedDescriptionKey: "No model layer found in manifest"])
        }

        let blobURL = URL(string: "\(registryBase)/v2/library/\(library)/blobs/\(digest)")!
        let dest = modelPath(modelName)

        let delegate = DownloadDelegate(totalSize: totalSize, onProgress: onProgress)
        let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
        let (tempURL, _) = try await session.download(from: blobURL)

        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.moveItem(at: tempURL, to: dest)
    }
}

private class DownloadDelegate: NSObject, URLSessionDownloadDelegate {
    let totalSize: Int64
    let onProgress: (Double, Int64, Int64) -> Void

    init(totalSize: Int64, onProgress: @escaping (Double, Int64, Int64) -> Void) {
        self.totalSize = totalSize
        self.onProgress = onProgress
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didWriteData bytesWritten: Int64, totalBytesWritten: Int64,
                    totalBytesExpectedToWrite: Int64) {
        let total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : totalSize
        let progress = total > 0 ? Double(totalBytesWritten) / Double(total) : 0
        onProgress(progress, totalBytesWritten, total)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didFinishDownloadingTo location: URL) {}
}
