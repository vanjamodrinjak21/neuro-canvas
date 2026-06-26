<script setup lang="ts">
/**
 * Global corner dock for background map generations.
 *
 * Mounted once in app.vue so it floats over every page. It reads the shared
 * generation queue, shows each job's live progress, and — because it is always
 * mounted — owns the "your map is ready" side-effects (in-app toast + OS
 * notification), firing each exactly once per job via the job's `notified`
 * guard. Presentation lives here; the queue stays UI-agnostic.
 */
import type { GenJob } from '~/composables/useGenerationQueue'
import { useGenerationQueue } from '~/composables/useGenerationQueue'

const { jobs, openJob, retry, dismiss } = useGenerationQueue()
const toast = useToast()
const { t } = useI18n()

function pct(job: GenJob): number {
  return Math.round(job.progress * 100)
}

function onOpen(job: GenJob) {
  void openJob(job.id)
}

// Fire the OS notification (best-effort) and focus the map on click.
function fireOsNotification(job: GenJob) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(t('generation.notify_title'), {
      body: t('generation.notify_body', { topic: job.topic }),
      tag: job.id,
    })
    n.onclick = () => {
      window.focus()
      void openJob(job.id)
      n.close()
    }
  } catch {
    /* Notification construction can throw on some platforms — non-fatal */
  }
}

// Watch for jobs settling (running → ready/error) and announce once.
watch(
  jobs,
  (list) => {
    for (const job of list) {
      if (job.status === 'running' || job.notified) continue
      job.notified = true
      if (job.status === 'ready') {
        toast.success(t('generation.ready_title', { topic: job.topic }))
        fireOsNotification(job)
      } else if (job.status === 'error') {
        toast.error(t('generation.failed'))
      }
    }
  },
  { deep: true },
)
</script>

<template>
  <div v-if="jobs.length" class="nc-gen-dock">
    <TransitionGroup name="nc-gen">
      <div
        v-for="job in jobs"
        :key="job.id"
        :class="['nc-gen-card', `nc-gen-card--${job.status}`]"
      >
        <!-- Icon -->
        <div class="nc-gen-icon">
          <span v-if="job.status === 'running'" class="i-lucide-loader-circle nc-gen-spin" />
          <span v-else-if="job.status === 'ready'" class="i-lucide-circle-check" />
          <span v-else class="i-lucide-circle-alert" />
        </div>

        <!-- Body -->
        <div class="nc-gen-body">
          <div class="nc-gen-topic">{{ job.title || job.topic }}</div>

          <div v-if="job.status === 'running'" class="nc-gen-status">
            <span>{{
              job.nodeProgress
                ? $t('generation.expanding', { count: job.nodeProgress.count, target: job.nodeProgress.target })
                : $t('generation.in_progress')
            }}</span>
            <span class="nc-gen-pct">{{ pct(job) }}%</span>
          </div>
          <div v-else-if="job.status === 'ready'" class="nc-gen-status nc-gen-status--ok">
            {{ $t('generation.ready') }}
          </div>
          <div v-else class="nc-gen-status nc-gen-status--err">
            {{ job.error || $t('generation.failed') }}
          </div>

          <!-- Indeterminate shimmer (pure CSS — no bound styles) -->
          <div v-if="job.status === 'running'" class="nc-gen-track">
            <div class="nc-gen-shimmer" />
          </div>

          <!-- Actions for settled jobs -->
          <div v-if="job.status === 'ready'" class="nc-gen-actions">
            <button class="nc-gen-btn nc-gen-btn--primary" @click="onOpen(job)">
              {{ $t('generation.open') }}
            </button>
            <button class="nc-gen-btn" @click="dismiss(job.id)">
              {{ $t('generation.dismiss') }}
            </button>
          </div>
          <div v-else-if="job.status === 'error'" class="nc-gen-actions">
            <button class="nc-gen-btn nc-gen-btn--primary" @click="retry(job.id)">
              {{ $t('generation.retry') }}
            </button>
            <button class="nc-gen-btn" @click="dismiss(job.id)">
              {{ $t('generation.dismiss') }}
            </button>
          </div>
        </div>

        <!-- Dismiss (running jobs can be cleared too) -->
        <button
          v-if="job.status === 'running'"
          class="nc-gen-close"
          :aria-label="$t('generation.dismiss')"
          @click="dismiss(job.id)"
        >
          <span class="i-lucide-x" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.nc-gen-dock {
  position: fixed;
  right: 20px;
  bottom: 20px;
  /* Above the modal/command-palette scrim (300) so progress stays visible, but
     below toasts (400). */
  z-index: var(--nc-z-dock, 350);
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 320px;
  max-width: calc(100vw - 40px);
  pointer-events: none;
}

.nc-gen-card {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: var(--nc-surface, #111114);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 14px;
  box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.6);
}

.nc-gen-card--ready {
  border-color: rgba(0, 210, 190, 0.4);
}

.nc-gen-card--error {
  border-color: rgba(248, 113, 113, 0.4);
}

.nc-gen-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: rgba(0, 210, 190, 0.1);
  color: #00D2BE;
}

.nc-gen-card--error .nc-gen-icon {
  background: rgba(248, 113, 113, 0.12);
  color: #F87171;
}

.nc-gen-spin {
  animation: nc-gen-rotate 0.9s linear infinite;
}

.nc-gen-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nc-gen-topic {
  font-size: 13px;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nc-gen-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--nc-ink-muted);
}

.nc-gen-status--ok {
  color: #00D2BE;
}

.nc-gen-status--err {
  color: #F87171;
  white-space: normal;
  line-height: 1.35;
}

.nc-gen-pct {
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  color: var(--nc-ink-soft);
}

.nc-gen-track {
  position: relative;
  height: 4px;
  border-radius: 999px;
  background: var(--nc-surface-3, #0D0D10);
  overflow: hidden;
}

.nc-gen-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #00D2BE, transparent);
  animation: nc-gen-slide 1.3s ease-in-out infinite;
}

.nc-gen-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.nc-gen-btn {
  flex: 1;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  border: 1px solid #2A2A30;
  color: var(--nc-ink-soft);
  transition: all 0.15s ease;
}

.nc-gen-btn:hover {
  border-color: #3A3A40;
  color: var(--nc-ink, #FAFAFA);
}

.nc-gen-btn--primary {
  background: var(--nc-accent, #00D2BE);
  border-color: transparent;
  color: #0A0A0C;
}

.nc-gen-btn--primary:hover {
  background: #00E5CF;
  color: #0A0A0C;
}

.nc-gen-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--nc-ink-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-gen-close:hover {
  color: var(--nc-ink, #FAFAFA);
  background: var(--nc-surface-3, #1A1A1E);
}

/* Enter/leave + reorder animation */
.nc-gen-enter-active,
.nc-gen-leave-active {
  transition: all 0.25s ease;
}

.nc-gen-enter-from,
.nc-gen-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

@keyframes nc-gen-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes nc-gen-slide {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nc-gen-spin,
  .nc-gen-shimmer {
    animation: none;
  }
  .nc-gen-shimmer {
    left: 0;
    width: 100%;
    opacity: 0.5;
  }
}
</style>
