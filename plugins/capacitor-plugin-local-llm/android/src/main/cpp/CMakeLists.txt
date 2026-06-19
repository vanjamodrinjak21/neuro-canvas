cmake_minimum_required(VERSION 3.22.1)
project(localllm)

# On-device LLM (llama.cpp) is temporarily stubbed — see llama-jni.cpp for why.
# We no longer FetchContent llama.cpp `master` (it broke the JNI build); the lib
# now compiles a tiny stub that keeps the JNI symbols so the Kotlin LlamaEngine
# loads and the JS layer degrades gracefully to cloud providers.
#
# To restore: recover the FetchContent block + real llama-jni.cpp from git
# history (commit 4b14e4e), and pin GIT_TAG to a FIXED llama.cpp release tag.
add_library(localllm SHARED llama-jni.cpp)

find_library(log-lib log)
target_link_libraries(localllm ${log-lib})
