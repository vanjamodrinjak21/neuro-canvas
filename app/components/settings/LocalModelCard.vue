<script setup lang="ts">
const localLLM = useLocalLLM()

const diskSpace = ref<number>(0)
const formattedDiskSpace = computed(() => formatBytes(diskSpace.value))
const formattedProgress = computed(() => {
  if (!localLLM.isDownloading.value) return ''
  return `${formatBytes(localLLM.downloadedBytes.value)} / ${formatBytes(localLLM.totalBytes.value)}`
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

onMounted(async () => {
  await localLLM.initialize()
  diskSpace.value = await localLLM.getAvailableDiskSpace()
})

async function handleDownload() {
  try {
    await localLLM.downloadModel()
  } catch {
    // Error shown via localLLM.error
  }
}
</script>

<template>
  <div class="local-model-card">
    <div class="lmc-header">
      <div class="lmc-icon">
        <span class="i-lucide-cpu" />
      </div>
      <div class="lmc-info">
        <h3 class="lmc-title">Gemma 4 — On-Device AI</h3>
        <p class="lmc-desc">Run AI locally on your device. No internet or API key required.</p>
      </div>
      <span v-if="localLLM.isDownloaded.value" class="lmc-badge ready">Ready</span>
      <span v-else class="lmc-badge">Not installed</span>
    </div>

    <div v-if="localLLM.error.value" class="lmc-error">
      {{ localLLM.error.value }}
    </div>

    <div v-if="!localLLM.isDownloaded.value && !localLLM.isDownloading.value" class="lmc-actions">
      <div class="lmc-meta">
        <span>Model size: ~1.5 GB</span>
        <span>Free space: {{ formattedDiskSpace }}</span>
      </div>
      <button class="lmc-download-btn" @click="handleDownload">
        <span class="i-lucide-download" />
        Download Model
      </button>
    </div>

    <div v-if="localLLM.isDownloading.value" class="lmc-progress">
      <div class="lmc-progress-bar">
        <div class="lmc-progress-fill" :style="{ width: `${localLLM.downloadProgress.value * 100}%` }" />
      </div>
      <div class="lmc-progress-info">
        <span>{{ Math.round(localLLM.downloadProgress.value * 100) }}%</span>
        <span>{{ formattedProgress }}</span>
      </div>
    </div>

    <div v-if="localLLM.isDownloaded.value && !localLLM.isDownloading.value" class="lmc-actions">
      <div class="lmc-meta">
        <span v-if="localLLM.isLoaded.value" class="lmc-loaded">
          <span class="lmc-dot" /> Loaded in memory
        </span>
        <span v-else>Ready to use</span>
      </div>
      <button class="lmc-delete-btn" @click="localLLM.deleteModel()">
        <span class="i-lucide-trash-2" />
        Delete Model
      </button>
    </div>
  </div>
</template>

<style scoped>
.local-model-card {
  padding: 16px;
  background: var(--nc-surface-1, #111113);
  border: 1px solid var(--nc-border, #1A1A1E);
  border-radius: 10px;
}

.lmc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.lmc-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(0, 210, 190, 0.1);
  color: #00D2BE;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.lmc-info { flex: 1; min-width: 0; }

.lmc-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
  margin: 0 0 2px;
}

.lmc-desc {
  font-size: 12px;
  color: var(--nc-ink-muted, #71717A);
  margin: 0;
}

.lmc-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--nc-surface-2, #18181B);
  color: var(--nc-ink-muted, #71717A);
  flex-shrink: 0;
}

.lmc-badge.ready {
  background: rgba(0, 210, 190, 0.1);
  color: #00D2BE;
}

.lmc-error {
  padding: 8px 12px;
  margin-bottom: 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  color: #f87171;
  font-size: 12px;
}

.lmc-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lmc-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--nc-ink-muted, #71717A);
}

.lmc-loaded {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #00D2BE;
}

.lmc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00D2BE;
}

.lmc-download-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #00D2BE;
  border: none;
  border-radius: 8px;
  color: #09090B;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.lmc-delete-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #EF4444;
  font-size: 12px;
  cursor: pointer;
}

.lmc-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lmc-progress-bar {
  height: 4px;
  background: var(--nc-surface-2, #18181B);
  border-radius: 2px;
  overflow: hidden;
}

.lmc-progress-fill {
  height: 100%;
  background: #00D2BE;
  border-radius: 2px;
  transition: width 300ms ease;
}

.lmc-progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--nc-ink-muted, #71717A);
}
</style>
