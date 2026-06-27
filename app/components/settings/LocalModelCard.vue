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
        <h3 class="lmc-title">{{ $t('settings.local_model.title') }}</h3>
        <p class="lmc-desc">{{ $t('settings.local_model.description') }}</p>
      </div>
      <span v-if="localLLM.isDownloaded.value" class="lmc-badge ready">{{ $t('settings.local_model.ready') }}</span>
      <span v-else class="lmc-badge">{{ $t('settings.local_model.not_installed') }}</span>
    </div>

    <div v-if="localLLM.error.value" class="lmc-error">
      {{ localLLM.error.value }}
    </div>

    <div v-if="!localLLM.isDownloaded.value && !localLLM.isDownloading.value" class="lmc-actions">
      <div class="lmc-meta">
        <span>{{ $t('settings.local_model.model_size') }}</span>
        <span>{{ $t('settings.local_model.free_space', { space: formattedDiskSpace }) }}</span>
      </div>
      <button class="lmc-download-btn" @click="handleDownload">
        <span class="i-lucide-download" />
        {{ $t('settings.local_model.download_model') }}
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
          <span class="lmc-dot" /> {{ $t('settings.local_model.loaded_in_memory') }}
        </span>
        <span v-else>{{ $t('settings.local_model.ready_to_use') }}</span>
      </div>
      <button class="lmc-delete-btn" @click="localLLM.deleteModel()">
        <span class="i-lucide-trash-2" />
        {{ $t('settings.local_model.delete_model') }}
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
  font-size: calc(18px * var(--nc-text-scale, 1));
  flex-shrink: 0;
}

.lmc-info { flex: 1; min-width: 0; }

.lmc-title {
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
  margin: 0 0 2px;
}

.lmc-desc {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #71717A);
  margin: 0;
}

.lmc-badge {
  font-size: calc(11px * var(--nc-text-scale, 1));
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
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-muted, #71717A);
}
</style>
