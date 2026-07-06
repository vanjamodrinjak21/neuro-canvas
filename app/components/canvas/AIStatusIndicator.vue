<script setup lang="ts">
import { useSemanticStore } from '~/stores/semanticStore'
import type { AIStatus } from '~/types/semantic'

const semanticStore = useSemanticStore()
const { t } = useI18n()

// Status grammar (REDESIGN.md §1): accent = active/ok/ready,
// coral = attention/error, text-muted = idle — never a rainbow of hues.
const statusConfig = computed<Record<AIStatus, {
  color: string
  bgColor: string
  icon: string
  label: string
}>>(() => ({
  idle: {
    color: 'var(--nc-text-muted)',
    bgColor: 'var(--nc-chip-bg)',
    icon: 'i-nc-ai-mark',
    label: t('canvas.ai_status.idle')
  },
  'loading-model': {
    color: 'var(--nc-accent-text)',
    bgColor: 'rgba(var(--nc-accent-rgb), 0.08)',
    icon: 'i-lucide-loader-2',
    label: t('canvas.ai_status.loading_model')
  },
  computing: {
    color: 'var(--nc-accent-text)',
    bgColor: 'rgba(var(--nc-accent-rgb), 0.08)',
    icon: 'i-lucide-loader-2',
    label: t('canvas.ai_status.computing')
  },
  ready: {
    color: 'var(--nc-accent-text)',
    bgColor: 'rgba(var(--nc-accent-rgb), 0.08)',
    icon: 'i-nc-ai-mark',
    label: t('canvas.ai_status.ready')
  },
  error: {
    color: 'var(--nc-coral)',
    bgColor: 'rgba(var(--nc-coral-rgb), 0.1)',
    icon: 'i-lucide-alert-circle',
    label: t('canvas.ai_status.error')
  }
}))

const currentConfig = computed(() => statusConfig.value[semanticStore.aiState.status as AIStatus])

// Dynamic values delivered to scoped CSS via v-bind (REDESIGN.md §9)
const statusColor = computed(() => currentConfig.value.color)
const statusBg = computed(() => currentConfig.value.bgColor)
const progressWidth = computed(() => `${semanticStore.aiState.modelProgress}%`)

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
    :title="tooltipText"
  >
    <span
      :class="[
        currentConfig.icon,
        'nc-ai-status-icon',
        isAnimating && 'animate-pulse'
      ]"
    />

    <span class="nc-ai-status-label">
      {{ currentConfig.label }}
    </span>

    <!-- Progress bar for model loading -->
    <div v-if="showProgress" class="nc-ai-progress">
      <div class="nc-ai-progress-fill" />
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  background: v-bind(statusBg);
  border: 1px solid transparent;
  border-radius: 0.4rem;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: v-bind(statusColor);
  white-space: nowrap;
  flex-shrink: 0;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
  cursor: default;
}

@media (hover: hover) and (pointer: fine) {
  .nc-ai-status:hover {
    border-color: v-bind(statusColor);
  }
}

.nc-ai-status-icon {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: v-bind(statusColor);
}

.nc-ai-status-label {
  font-weight: 500;
  white-space: nowrap;
}

.nc-ai-progress {
  width: 40px;
  height: 4px;
  background: var(--nc-surface-3);
  border-radius: 2px;
  overflow: hidden;
}

.nc-ai-progress-fill {
  width: v-bind(progressWidth);
  height: 100%;
  background: v-bind(statusColor);
  border-radius: 2px;
  transition: width 300ms var(--nc-ease);
}

/* GPU/CPU badge — mono micro chip; accent = ok, neutral = fallback */
.nc-ai-gpu-badge {
  font-family: var(--nc-font-mono);
  font-size: calc(9px * var(--nc-text-scale, 1));
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nc-ai-gpu-badge.gpu {
  background: rgba(var(--nc-accent-rgb), 0.15);
  color: var(--nc-accent-text);
}

.nc-ai-gpu-badge.wasm {
  background: var(--nc-chip-bg);
  color: var(--nc-text-secondary);
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

@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    animation: none;
  }
}
</style>
