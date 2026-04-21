import Foundation
import llama

class LlamaEngine {
    private var model: OpaquePointer?
    private var context: OpaquePointer?
    private var sampler: OpaquePointer?

    var isLoaded: Bool { model != nil && context != nil }

    func load(modelPath: String, contextSize: Int32 = 4096, gpuLayers: Int32 = 99) throws {
        unload()

        llama_backend_init()

        var modelParams = llama_model_default_params()
        modelParams.n_gpu_layers = gpuLayers

        guard let m = llama_model_load_from_file(modelPath, modelParams) else {
            throw NSError(domain: "LlamaEngine", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Failed to load model from \(modelPath)"])
        }
        model = m

        var ctxParams = llama_context_default_params()
        ctxParams.n_ctx = UInt32(contextSize)
        ctxParams.n_threads = UInt32(ProcessInfo.processInfo.activeProcessorCount)
        ctxParams.n_threads_batch = UInt32(ProcessInfo.processInfo.activeProcessorCount)

        guard let c = llama_init_from_model(m, ctxParams) else {
            llama_model_free(m)
            model = nil
            throw NSError(domain: "LlamaEngine", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "Failed to create context"])
        }
        context = c

        let sparams = llama_sampler_chain_default_params()
        sampler = llama_sampler_chain_init(sparams)
        llama_sampler_chain_add(sampler, llama_sampler_init_greedy())
    }

    func unload() {
        if let s = sampler { llama_sampler_free(s); sampler = nil }
        if let c = context { llama_free(c); context = nil }
        if let m = model { llama_model_free(m); model = nil }
        llama_backend_free()
    }

    func generate(
        prompt: String,
        systemPrompt: String?,
        maxTokens: Int = 2048,
        temperature: Float = 0.3,
        stopSequences: [String] = []
    ) throws -> (content: String, tokensUsed: Int) {
        guard let model = model, let context = context, let sampler = sampler else {
            throw NSError(domain: "LlamaEngine", code: 3,
                          userInfo: [NSLocalizedDescriptionKey: "Model not loaded"])
        }

        let fullPrompt: String
        if let sys = systemPrompt, !sys.isEmpty {
            fullPrompt = "<start_of_turn>system\n\(sys)<end_of_turn>\n<start_of_turn>user\n\(prompt)<end_of_turn>\n<start_of_turn>model\n"
        } else {
            fullPrompt = "<start_of_turn>user\n\(prompt)<end_of_turn>\n<start_of_turn>model\n"
        }

        let promptCStr = fullPrompt.cString(using: .utf8)!
        let nPromptTokens = -llama_tokenize(model, promptCStr, Int32(promptCStr.count), nil, 0, true, true)
        var tokens = [llama_token](repeating: 0, count: Int(nPromptTokens))
        llama_tokenize(model, promptCStr, Int32(promptCStr.count), &tokens, nPromptTokens, true, true)

        llama_kv_cache_clear(context)

        var batch = llama_batch_init(Int32(tokens.count), 0, 1)
        for (i, token) in tokens.enumerated() {
            llama_batch_add(&batch, token, Int32(i), [0], i == tokens.count - 1)
        }
        llama_decode(context, batch)
        llama_batch_free(batch)

        var outputTokens: [llama_token] = []
        var nDecoded = tokens.count
        let eosToken = llama_token_eos(model)

        for _ in 0..<maxTokens {
            let newToken = llama_sampler_sample(sampler, context, Int32(nDecoded - 1))

            if newToken == eosToken { break }
            outputTokens.append(newToken)

            let currentText = detokenize(model: model, tokens: outputTokens)
            if stopSequences.contains(where: { currentText.hasSuffix($0) }) { break }

            var nextBatch = llama_batch_init(1, 0, 1)
            llama_batch_add(&nextBatch, newToken, Int32(nDecoded), [0], true)
            llama_decode(context, nextBatch)
            llama_batch_free(nextBatch)
            nDecoded += 1
        }

        let output = detokenize(model: model, tokens: outputTokens)
        return (content: output, tokensUsed: outputTokens.count)
    }

    private func detokenize(model: OpaquePointer, tokens: [llama_token]) -> String {
        var result = ""
        for token in tokens {
            var buf = [CChar](repeating: 0, count: 256)
            let n = llama_token_to_piece(model, token, &buf, Int32(buf.count), 0, true)
            if n > 0 {
                result += String(cString: Array(buf.prefix(Int(n))) + [0])
            }
        }
        return result
    }

    deinit { unload() }
}
