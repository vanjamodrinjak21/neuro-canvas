package com.neurocanvas.localllm

class LlamaEngine {
    companion object {
        init {
            System.loadLibrary("localllm")
        }
    }

    external fun nativeLoad(modelPath: String, contextSize: Int, gpuLayers: Int): Boolean
    external fun nativeUnload()
    external fun nativeGenerate(prompt: String, maxTokens: Int): String

    var isLoaded = false
        private set

    fun load(modelPath: String, contextSize: Int = 4096, gpuLayers: Int = 0): Boolean {
        isLoaded = nativeLoad(modelPath, contextSize, gpuLayers)
        return isLoaded
    }

    fun unload() {
        if (isLoaded) {
            nativeUnload()
            isLoaded = false
        }
    }

    fun generate(
        prompt: String,
        systemPrompt: String?,
        maxTokens: Int = 2048,
        stopSequences: List<String> = emptyList()
    ): Pair<String, Int> {
        val fullPrompt = buildString {
            if (!systemPrompt.isNullOrBlank()) {
                append("<start_of_turn>system\n$systemPrompt<end_of_turn>\n")
            }
            append("<start_of_turn>user\n$prompt<end_of_turn>\n<start_of_turn>model\n")
        }

        var output = nativeGenerate(fullPrompt, maxTokens)

        for (stop in stopSequences) {
            val idx = output.indexOf(stop)
            if (idx >= 0) output = output.substring(0, idx)
        }

        return Pair(output, output.split(" ").size)
    }
}
