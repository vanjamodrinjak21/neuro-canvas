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

/* Toast-adjacent card grammar: flat surface-2 + hairline, calm shadow only. */
.nc-gen-card {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  box-shadow: var(--nc-shadow-md);
}

/* Accent discipline (REDESIGN.md §1): cyan for ready, coral for error. */
.nc-gen-card--ready {
  border-color: rgba(var(--nc-accent-rgb), 0.4);
}

.nc-gen-card--error {
  border-color: rgba(var(--nc-coral-rgb), 0.4);
}

.nc-gen-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--nc-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(18px * var(--nc-text-scale, 1));
  background: rgba(var(--nc-accent-rgb), 0.08);
  color: var(--nc-accent);
}

.nc-gen-card--error .nc-gen-icon {
  background: rgba(var(--nc-coral-rgb), 0.08);
  color: var(--nc-coral);
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
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Status readout — mono micro-label grammar (REDESIGN.md §4). */
.nc-gen-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--nc-font-mono);
  font-size: calc(0.68rem * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

.nc-gen-status--ok {
  color: var(--nc-accent);
}

/* Errors carry dynamic prose — keep mono + coral, but drop the micro-label
   casing so long server messages stay readable and wrap cleanly. */
.nc-gen-status--err {
  color: var(--nc-coral);
  text-transform: none;
  letter-spacing: 0.01em;
  white-space: normal;
  line-height: 1.5;
}

.nc-gen-pct {
  font-family: var(--nc-font-mono);
  color: var(--nc-text-secondary);
}

.nc-gen-track {
  position: relative;
  height: 4px;
  border-radius: 2px;
  background: var(--nc-surface-3);
  overflow: hidden;
}

/* Indeterminate fill — solid accent (no gradients in chrome). */
.nc-gen-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 40%;
  border-radius: 2px;
  background: var(--nc-accent);
  animation: nc-gen-slide 1.3s var(--nc-ease) infinite;
}

.nc-gen-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

/* Secondary — mono uppercase chip (matches ui/NcToast action grammar). */
.nc-gen-btn {
  flex: 1;
  padding: 7px 10px;
  border-radius: 0.4rem;
  font-family: var(--nc-font-mono);
  font-size: calc(0.72rem * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  color: var(--nc-text-secondary);
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.nc-gen-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .nc-gen-btn:hover {
    border-color: var(--nc-border-active);
    color: var(--nc-text);
  }
}

/* Primary — ink pill grammar (REDESIGN.md §5). */
.nc-gen-btn--primary {
  background: var(--nc-text);
  border-color: transparent;
  border-radius: 2.4rem;
  color: var(--nc-bg);
  font-family: var(--nc-font-display);
  font-weight: 700;
  font-size: calc(12px * var(--nc-text-scale, 1));
  letter-spacing: -0.015em;
  text-transform: none;
}

@media (hover: hover) and (pointer: fine) {
  .nc-gen-btn--primary:hover {
    background: var(--nc-accent);
    border-color: transparent;
    color: var(--nc-bg);
    transform: translateY(-1px);
  }
}

/* Icon button — transparent, hover brightens on surface-3. */
.nc-gen-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--nc-text-muted);
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.nc-gen-close:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .nc-gen-close:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

.nc-gen-btn:focus-visible,
.nc-gen-close:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Enter/leave — transform/opacity only, single ease; exit faster. */
.nc-gen-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease),
              transform var(--nc-duration-normal) var(--nc-ease);
}

.nc-gen-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-fast) var(--nc-ease);
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
