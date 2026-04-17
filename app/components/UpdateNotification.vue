<script setup lang="ts">
const { updateAvailable, updateVersion, updateBody, isDownloading, downloadProgress, error, checkForUpdates, downloadAndInstall } = useTauriUpdater()

const dismissed = ref(false)

const visible = computed(() => updateAvailable.value && !dismissed.value)

function dismiss() {
  dismissed.value = true
}

onMounted(() => {
  checkForUpdates()
})
</script>

<template>
  <Transition name="slide-down">
    <div
      v-if="visible"
      class="fixed top-4 right-4 z-[9999] w-80 rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] shadow-lg shadow-black/40"
    >
      <div class="p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <h4 class="text-sm font-semibold text-[#e8e4d9]">
              Update available
            </h4>
            <p class="mt-1 text-xs text-[#e8e4d9]/60">
              Version {{ updateVersion }} is ready to install.
            </p>
            <p
              v-if="updateBody"
              class="mt-1.5 line-clamp-2 text-xs text-[#e8e4d9]/40"
            >
              {{ updateBody }}
            </p>
          </div>
          <button
            class="shrink-0 p-0.5 text-[#e8e4d9]/40 transition-colors hover:text-[#e8e4d9]/70"
            aria-label="Dismiss"
            @click="dismiss"
          >
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div v-if="error" class="mt-2 text-xs text-red-400">
          {{ error }}
        </div>

        <div v-if="isDownloading" class="mt-3">
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-[#1a1a2e]">
            <div
              class="h-full rounded-full bg-[#e8e4d9]/60 transition-all duration-300"
              :style="{ width: `${Math.min(downloadProgress, 100)}%` }"
            />
          </div>
          <p class="mt-1 text-xs text-[#e8e4d9]/40">
            Downloading update...
          </p>
        </div>

        <div v-else class="mt-3 flex gap-2">
          <button
            class="rounded-md bg-[#e8e4d9] px-3 py-1.5 text-xs font-medium text-[#0a0a0f] transition-opacity hover:opacity-90"
            @click="downloadAndInstall"
          >
            Update now
          </button>
          <button
            class="rounded-md border border-[#1a1a2e] px-3 py-1.5 text-xs font-medium text-[#e8e4d9]/60 transition-colors hover:border-[#e8e4d9]/20 hover:text-[#e8e4d9]/80"
            @click="dismiss"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
