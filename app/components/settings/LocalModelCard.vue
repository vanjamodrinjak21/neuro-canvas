<script setup lang="ts">
const localLLM = useLocalLLM()

const diskSpace = ref<number>(0)
const formattedDiskSpace = computed(() => formatBytes(diskSpace.value))
const formattedProgress = computed(() => {
  if (!localLLM.isDownloading.value) return ''
  return `${formatBytes(localLLM.downloadedBytes.value)} / ${formatBytes(localLLM.totalBytes.value)}`
})

// Drives the progress-fill width via v-bind() in scoped CSS — no inline
// :style (REDESIGN.md §9).
const progressWidth = computed(() => `${localLLM.downloadProgress.value * 100}%`)

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
        <div class="lmc-progress-fill" />
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
/* Flat surface + THE hairline (REDESIGN.md §5) — tokens only, no local
   palette; tokens.css rebases everything under :root.light. */
.local-model-card {
  padding: 16px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
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
  border-radius: var(--nc-radius-md);
  background: rgba(var(--nc-accent-rgb), 0.1);
  color: var(--nc-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(18px * var(--nc-text-scale, 1));
  flex-shrink: 0;
}

.lmc-info { flex: 1; min-width: 0; }

.lmc-title {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
  margin: 0 0 2px;
}

.lmc-desc {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  margin: 0;
}

/* Status badge — mono chip grammar (REDESIGN.md §5) */
.lmc-badge {
  font-family: var(--nc-font-mono);
  font-size: calc(0.72rem * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  border-radius: 0.4rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  color: var(--nc-text-muted);
  flex-shrink: 0;
}

.lmc-badge.ready {
  background: rgba(var(--nc-accent-rgb), 0.08);
  border-color: rgba(var(--nc-accent-rgb), 0.25);
  color: var(--nc-accent);
}

/* Errors are coral (REDESIGN.md §1) */
.lmc-error {
  padding: 8px 12px;
  margin-bottom: 12px;
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.2);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-coral);
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
  color: var(--nc-text-secondary);
}

.lmc-loaded {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--nc-accent);
}

.lmc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-accent);
}

/* Primary — ink pill grammar (REDESIGN.md §5) */
.lmc-download-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--nc-text);
  border: none;
  border-radius: 2.4rem;
  color: var(--nc-bg);
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.lmc-download-btn:active { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .lmc-download-btn:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

/* Danger — calm coral text + hairline, never solid red (REDESIGN.md §1) */
.lmc-delete-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid rgba(var(--nc-coral-rgb), 0.45);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-coral);
  font-size: calc(12px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.lmc-delete-btn:active { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .lmc-delete-btn:hover {
    background: rgba(var(--nc-coral-rgb), 0.08);
    border-color: var(--nc-coral);
  }
}

.lmc-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lmc-progress-bar {
  height: 4px;
  background: var(--nc-surface-3);
  border-radius: 2px;
  overflow: hidden;
}

.lmc-progress-fill {
  height: 100%;
  width: v-bind(progressWidth);
  background: var(--nc-accent);
  border-radius: 2px;
  transition: width var(--nc-duration-slow) var(--nc-ease);
}

.lmc-progress-info {
  display: flex;
  justify-content: space-between;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}
</style>
