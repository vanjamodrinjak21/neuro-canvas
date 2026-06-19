#include <jni.h>
#include <android/log.h>

#define LOG_TAG "LocalLLM"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

// ── On-device LLM temporarily stubbed (ship-now, fix-later) ──────────────────
// The real llama.cpp JNI bridge was written against an older llama.cpp API and
// the CMake build pinned GIT_TAG=master, which has since diverged:
//   * llama_tokenize / llama_token_eos / llama_token_to_piece now take a vocab
//   * llama_kv_cache_clear was renamed (llama_memory_clear)
//   * llama_batch_add was never in the public header (it's a common helper)
// Rather than block the signed Android release, this stub keeps the JNI symbols
// so liblocalllm.so still loads and com.neurocanvas.localllm.LlamaEngine
// resolves — but every native call reports "unavailable", so useLocalLLM()
// falls back to cloud providers. Cloud AI is unaffected.
//
// To restore on-device inference: recover the real implementation from git
// history (commit 4b14e4e and earlier), pin llama.cpp to a FIXED release tag
// (never `master`), and migrate the calls to the current API.
extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_neurocanvas_localllm_LlamaEngine_nativeLoad(
    JNIEnv *, jobject, jstring, jint, jint) {
    LOGI("local-llm native build is stubbed; on-device inference unavailable");
    return JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_neurocanvas_localllm_LlamaEngine_nativeUnload(JNIEnv *, jobject) {}

JNIEXPORT jstring JNICALL
Java_com_neurocanvas_localllm_LlamaEngine_nativeGenerate(
    JNIEnv *env, jobject, jstring, jint) {
    return env->NewStringUTF("");
}

}
