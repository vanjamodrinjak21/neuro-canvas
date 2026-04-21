package com.neurocanvas.localllm

import android.content.Context
import android.os.StatFs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class ModelManager(private val context: Context) {
    private val modelsDir: File
        get() = File(context.filesDir, "models").also { it.mkdirs() }

    fun modelPath(modelName: String): File =
        File(modelsDir, "${modelName.replace(":", "-")}.gguf")

    fun isDownloaded(modelName: String): Boolean = modelPath(modelName).exists()

    fun modelSize(modelName: String): Long = modelPath(modelName).let { if (it.exists()) it.length() else 0 }

    fun availableDiskSpace(): Long {
        val stat = StatFs(context.filesDir.path)
        return stat.availableBlocksLong * stat.blockSizeLong
    }

    fun deleteModel(modelName: String) {
        modelPath(modelName).delete()
    }

    suspend fun downloadModel(
        modelName: String,
        onProgress: (progress: Double, downloaded: Long, total: Long) -> Unit
    ) = withContext(Dispatchers.IO) {
        val parts = modelName.split(":")
        val library = parts[0]
        val tag = if (parts.size > 1) parts[1] else "latest"
        val registryBase = "https://registry.ollama.ai"

        val manifestUrl = URL("$registryBase/v2/library/$library/manifests/$tag")
        val manifestConn = manifestUrl.openConnection() as HttpURLConnection
        manifestConn.setRequestProperty("Accept", "application/vnd.docker.distribution.manifest.v2+json")
        val manifestJson = manifestConn.inputStream.bufferedReader().readText()
        manifestConn.disconnect()

        val manifest = JSONObject(manifestJson)
        val layers = manifest.getJSONArray("layers")

        var digest = ""
        var totalSize = 0L
        for (i in 0 until layers.length()) {
            val layer = layers.getJSONObject(i)
            val size = layer.getLong("size")
            if (size > totalSize) {
                totalSize = size
                digest = layer.getString("digest")
            }
        }

        if (digest.isEmpty()) throw Exception("No model layer found in manifest")

        val blobUrl = URL("$registryBase/v2/library/$library/blobs/$digest")
        val conn = blobUrl.openConnection() as HttpURLConnection
        val dest = modelPath(modelName)
        val tempFile = File(dest.parent, "${dest.name}.tmp")

        conn.inputStream.use { input ->
            tempFile.outputStream().use { output ->
                val buffer = ByteArray(8192)
                var downloaded = 0L
                var bytesRead: Int
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                    downloaded += bytesRead
                    val progress = if (totalSize > 0) downloaded.toDouble() / totalSize else 0.0
                    onProgress(progress, downloaded, totalSize)
                }
            }
        }
        conn.disconnect()

        if (dest.exists()) dest.delete()
        tempFile.renameTo(dest)
    }
}
