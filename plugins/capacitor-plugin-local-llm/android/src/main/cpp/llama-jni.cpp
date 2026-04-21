#include <jni.h>
#include <string>
#include <vector>
#include <android/log.h>
#include "llama.h"

#define LOG_TAG "LocalLLM"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static llama_model * g_model = nullptr;
static llama_context * g_ctx = nullptr;
static llama_sampler * g_sampler = nullptr;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_neurocanvas_localllm_LlamaEngine_nativeLoad(
    JNIEnv *env, jobject, jstring modelPath, jint contextSize, jint gpuLayers
) {
    if (g_sampler) { llama_sampler_free(g_sampler); g_sampler = nullptr; }
    if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }

    llama_backend_init();

    const char *path = env->GetStringUTFChars(modelPath, nullptr);
    LOGI("Loading model: %s", path);

    auto model_params = llama_model_default_params();
    model_params.n_gpu_layers = gpuLayers;

    g_model = llama_model_load_from_file(path, model_params);
    env->ReleaseStringUTFChars(modelPath, path);

    if (!g_model) {
        LOGE("Failed to load model");
        return JNI_FALSE;
    }

    auto ctx_params = llama_context_default_params();
    ctx_params.n_ctx = contextSize;
    ctx_params.n_threads = 4;
    ctx_params.n_threads_batch = 4;

    g_ctx = llama_init_from_model(g_model, ctx_params);
    if (!g_ctx) {
        LOGE("Failed to create context");
        llama_model_free(g_model);
        g_model = nullptr;
        return JNI_FALSE;
    }

    auto sparams = llama_sampler_chain_default_params();
    g_sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(g_sampler, llama_sampler_init_greedy());

    LOGI("Model loaded successfully");
    return JNI_TRUE;
}

JNIEXPORT void JNICALL
Java_com_neurocanvas_localllm_LlamaEngine_nativeUnload(JNIEnv *, jobject) {
    if (g_sampler) { llama_sampler_free(g_sampler); g_sampler = nullptr; }
    if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
    llama_backend_free();
}

JNIEXPORT jstring JNICALL
Java_com_neurocanvas_localllm_LlamaEngine_nativeGenerate(
    JNIEnv *env, jobject, jstring jPrompt, jint maxTokens
) {
    if (!g_model || !g_ctx || !g_sampler) {
        return env->NewStringUTF("");
    }

    const char *prompt = env->GetStringUTFChars(jPrompt, nullptr);

    int n_prompt = -llama_tokenize(g_model, prompt, strlen(prompt), nullptr, 0, true, true);
    std::vector<llama_token> tokens(n_prompt);
    llama_tokenize(g_model, prompt, strlen(prompt), tokens.data(), n_prompt, true, true);
    env->ReleaseStringUTFChars(jPrompt, prompt);

    llama_kv_cache_clear(g_ctx);

    llama_batch batch = llama_batch_init(tokens.size(), 0, 1);
    for (size_t i = 0; i < tokens.size(); i++) {
        llama_batch_add(&batch, tokens[i], i, {0}, i == tokens.size() - 1);
    }
    llama_decode(g_ctx, batch);
    llama_batch_free(batch);

    std::string output;
    int n_decoded = tokens.size();
    llama_token eos = llama_token_eos(g_model);

    for (int i = 0; i < maxTokens; i++) {
        llama_token new_token = llama_sampler_sample(g_sampler, g_ctx, n_decoded - 1);
        if (new_token == eos) break;

        char buf[256];
        int n = llama_token_to_piece(g_model, new_token, buf, sizeof(buf), 0, true);
        if (n > 0) output.append(buf, n);

        llama_batch next = llama_batch_init(1, 0, 1);
        llama_batch_add(&next, new_token, n_decoded, {0}, true);
        llama_decode(g_ctx, next);
        llama_batch_free(next);
        n_decoded++;
    }

    return env->NewStringUTF(output.c_str());
}

}
