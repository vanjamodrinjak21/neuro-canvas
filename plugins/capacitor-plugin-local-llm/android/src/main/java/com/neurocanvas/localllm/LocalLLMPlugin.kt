package com.neurocanvas.localllm

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.*

@CapacitorPlugin(name = "LocalLLM")
class LocalLLMPlugin : Plugin() {
    private val engine = LlamaEngine()
    private lateinit var manager: ModelManager
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun load() {
        manager = ModelManager(context)
    }

    @PluginMethod
    fun downloadModel(call: PluginCall) {
        val modelName = call.getString("modelName") ?: return call.reject("modelName is required")

        scope.launch {
            try {
                manager.downloadModel(modelName) { progress, downloaded, total ->
                    val data = JSObject().apply {
                        put("progress", progress)
                        put("bytesDownloaded", downloaded)
                        put("totalBytes", total)
                    }
                    notifyListeners("downloadProgress", data)
                }
                call.resolve(JSObject().apply { put("success", true) })
            } catch (e: Exception) {
                call.reject("Download failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun deleteModel(call: PluginCall) {
        val modelName = call.getString("modelName") ?: return call.reject("modelName is required")
        engine.unload()
        manager.deleteModel(modelName)
        call.resolve()
    }

    @PluginMethod
    fun getModelStatus(call: PluginCall) {
        val modelName = call.getString("modelName") ?: return call.reject("modelName is required")
        call.resolve(JSObject().apply {
            put("downloaded", manager.isDownloaded(modelName))
            put("sizeBytes", manager.modelSize(modelName))
            put("path", manager.modelPath(modelName).absolutePath)
        })
    }

    @PluginMethod
    fun getAvailableDiskSpace(call: PluginCall) {
        call.resolve(JSObject().apply { put("bytes", manager.availableDiskSpace()) })
    }

    @PluginMethod
    fun loadModel(call: PluginCall) {
        val modelName = call.getString("modelName") ?: return call.reject("modelName is required")
        val contextSize = call.getInt("contextSize") ?: 4096
        val gpuLayers = call.getInt("gpuLayers") ?: 0

        scope.launch(Dispatchers.IO) {
            val path = manager.modelPath(modelName).absolutePath
            val loaded = engine.load(path, contextSize, gpuLayers)
            withContext(Dispatchers.Main) {
                call.resolve(JSObject().apply { put("loaded", loaded) })
            }
        }
    }

    @PluginMethod
    fun unloadModel(call: PluginCall) {
        engine.unload()
        call.resolve()
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val prompt = call.getString("prompt") ?: return call.reject("prompt is required")
        val systemPrompt = call.getString("systemPrompt")
        val maxTokens = call.getInt("maxTokens") ?: 2048
        val stopSequences = call.getArray("stopSequences")?.toList<String>() ?: emptyList()

        scope.launch(Dispatchers.IO) {
            try {
                val (content, tokensUsed) = engine.generate(prompt, systemPrompt, maxTokens, stopSequences)
                withContext(Dispatchers.Main) {
                    call.resolve(JSObject().apply {
                        put("content", content)
                        put("tokensUsed", tokensUsed)
                    })
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    call.reject("Generation failed: ${e.message}")
                }
            }
        }
    }

    override fun handleOnDestroy() {
        engine.unload()
        scope.cancel()
    }
}
