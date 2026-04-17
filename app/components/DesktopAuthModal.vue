<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  url: string
}>()

const emit = defineEmits<{
  close: []
  authenticated: []
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const loading = ref(true)

function onIframeLoad() {
  loading.value = false
  // Check if the iframe navigated to dashboard (auth complete)
  try {
    const iframeUrl = iframeRef.value?.contentWindow?.location.href
    if (iframeUrl && (iframeUrl.includes('/dashboard') || iframeUrl.includes('/maps'))) {
      emit('authenticated')
    }
  } catch {
    // Cross-origin — can't read URL, that's expected
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="visible" class="auth-overlay" @click.self="emit('close')">
        <div class="auth-container">
          <!-- Header -->
          <div class="auth-header">
            <span class="auth-title">Sign In to NeuroCanvas</span>
            <div class="auth-header-actions">
              <button class="auth-done-btn" @click="emit('authenticated')">
                Done
              </button>
              <button class="auth-close-btn" @click="emit('close')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <!-- Loading spinner -->
          <div v-if="loading" class="auth-loading">
            <div class="auth-spinner" />
            <span>Loading sign-in page...</span>
          </div>

          <!-- Iframe -->
          <iframe
            ref="iframeRef"
            :src="url"
            class="auth-iframe"
            :class="{ hidden: loading }"
            allow="forms"
            @load="onIframeLoad"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.auth-container {
  width: 460px;
  height: 640px;
  background: #0a0a0f;
  border-radius: 12px;
  border: 1px solid #1a1a2e;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
}

.auth-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #1a1a2e;
  background: #0d0d14;
  flex-shrink: 0;
}

.auth-title {
  font-size: 13px;
  font-weight: 600;
  color: #e8e4d9;
}

.auth-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auth-done-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: #00D2BE;
  color: #0a0a0f;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.auth-done-btn:hover {
  opacity: 0.85;
}

.auth-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8a8a9a;
  cursor: pointer;
  transition: background 0.15s;
}

.auth-close-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.auth-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #8a8a9a;
  font-size: 13px;
}

.auth-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #1a1a2e;
  border-top-color: #00D2BE;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.auth-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #0a0a0f;
}

.auth-iframe.hidden {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
</style>
