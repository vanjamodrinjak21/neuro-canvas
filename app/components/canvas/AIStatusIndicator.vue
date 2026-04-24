<script setup lang="ts">
import { useSemanticStore } from '~/stores/semanticStore'
import type { AIStatus } from '~/types/semantic'

const semanticStore = useSemanticStore()
const { t } = useI18n()

// Status configurations
const statusConfig = computed<Record<AIStatus, {
  color: string
  bgColor: string
  icon: string
  label: string
}>>(() => ({
  idle: {
    color: '#555558',
    bgColor: 'rgba(85, 85, 88, 0.1)',
    icon: 'i-lucide-brain',
    label: t('canvas.ai_status.idle')
  },
  'loading-model': {
    color: '#60A5FA',
    bgColor: 'rgba(96, 165, 250, 0.1)',
    icon: 'i-lucide-loader-2',
    label: t('canvas.ai_status.loading_model')
  },
  computing: {
    color: '#FACC15',
    bgColor: 'rgba(250, 204, 21, 0.1)',
    icon: 'i-lucide-sparkles',
    label: t('canvas.ai_status.computing')
  },
  ready: {
    color: '#00D2BE',
    bgColor: 'rgba(0, 210, 190, 0.1)',
    icon: 'i-lucide-brain',
    label: t('canvas.ai_status.ready')
  },
  error: {
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    icon: 'i-lucide-alert-circle',
    label: t('canvas.ai_status.error')
  }
}))

const currentConfig = computed(() => statusConfig.value[semanticStore.aiState.status as AIStatus])

// Show progress during model loading
const showProgress = computed(() =>
  semanticStore.aiState.status === 'loading-model' &&
  semanticStore.aiState.modelProgress > 0 &&
  semanticStore.aiState.modelProgress < 100
)

// Is loading/computing
const isAnimating = computed(() =>
  semanticStore.aiState.status === 'loading-model' ||
  semanticStore.aiState.status === 'computing'
)

// Tooltip text
const tooltipText = computed(() => {
  const base = currentConfig.value.label
  if (semanticStore.aiState.hasWebGPU) {
    return `${base} (WebGPU)`
  }
  return `${base} (WASM)`
})
</script>

<template>
  <div
    class="nc-ai-status"
    :style="{
      '--status-color': currentConfig.color,
      '--status-bg': currentConfig.bgColor
    }"
    :title="tooltipText"
  >
    <span
      :class="[
        currentConfig.icon,
        'nc-ai-status-icon',
        isAnimating && 'animate-pulse'
      ]"
      :style="{ color: currentConfig.color }"
    />

    <span class="nc-ai-status-label">
      {{ currentConfig.label }}
    </span>

    <!-- Progress bar for model loading -->
    <div v-if="showProgress" class="nc-ai-progress">
      <div
        class="nc-ai-progress-fill"
        :style="{ width: `${semanticStore.aiState.modelProgress}%` }"
      />
    </div>

    <!-- GPU indicator -->
    <span
      v-if="semanticStore.aiState.modelLoaded"
      class="nc-ai-gpu-badge"
      :class="semanticStore.aiState.hasWebGPU ? 'gpu' : 'wasm'"
    >
      {{ semanticStore.aiState.hasWebGPU ? $t('canvas.ai_status.gpu_badge') : $t('canvas.ai_status.cpu_badge') }}
    </span>
  </div>
</template>

<style scoped>
.nc-ai-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  background: var(--status-bg);
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 11px;
  color: var(--status-color);
  transition: border-color var(--nc-duration-fast, 150ms) var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  cursor: default;
}

@media (hover: hover) and (pointer: fine) {
  .nc-ai-status:hover {
    border-color: var(--status-color);
  }
}

.nc-ai-status-icon {
  font-size: 14px;
}

.nc-ai-status-label {
  font-weight: 500;
  white-space: nowrap;
}

.nc-ai-progress {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.nc-ai-progress-fill {
  height: 100%;
  background: var(--status-color);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.nc-ai-gpu-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nc-ai-gpu-badge.gpu {
  background: rgba(0, 210, 190, 0.2);
  color: #00D2BE;
}

.nc-ai-gpu-badge.wasm {
  background: rgba(250, 204, 21, 0.2);
  color: #FACC15;
}

/* Pulse animation for loading/computing */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
</style>
