<script setup lang="ts">
interface Props {
  status?: string
  progress?: number
}

const props = withDefaults(defineProps<Props>(), {
  status: 'Loading...',
  progress: -1,
})

const mounted = ref(false)
const leaving = ref(false)

onMounted(() => {
  requestAnimationFrame(() => {
    mounted.value = true
  })
})

function leave(): Promise<void> {
  return new Promise((resolve) => {
    leaving.value = true
    setTimeout(resolve, 300)
  })
}

defineExpose({ leave })
</script>

<template>
  <div
    class="app-loading"
    :class="{ 'is-mounted': mounted, 'is-leaving': leaving }"
  >
    <!-- Logo -->
    <div class="app-loading__logo">
      <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="72" height="72" rx="16" fill="#00D2BE" />
        <line x1="36" y1="28" x2="36" y2="19" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
        <line x1="43" y1="32" x2="50" y2="27" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
        <line x1="43" y1="40" x2="50" y2="45" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
        <line x1="36" y1="44" x2="36" y2="53" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
        <line x1="29" y1="40" x2="22" y2="45" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
        <line x1="29" y1="32" x2="22" y2="27" stroke="#09090B" stroke-width="2.5" opacity="0.5" />
        <circle cx="36" cy="16" r="5" fill="#09090B" opacity="0.7" />
        <circle cx="52" cy="26" r="5" fill="#09090B" opacity="0.7" />
        <circle cx="52" cy="46" r="5" fill="#09090B" opacity="0.7" />
        <circle cx="36" cy="56" r="5" fill="#09090B" opacity="0.7" />
        <circle cx="20" cy="46" r="5" fill="#09090B" opacity="0.7" />
        <circle cx="20" cy="26" r="5" fill="#09090B" opacity="0.7" />
        <circle cx="36" cy="36" r="8" fill="#09090B" />
      </svg>
    </div>

    <!-- Wordmark -->
    <div class="app-loading__wordmark">
      NeuroCanvas
    </div>

    <!-- Status text -->
    <div class="app-loading__status">
      {{ props.status }}
    </div>

    <!-- Progress bar -->
    <div class="app-loading__progress">
      <div
        class="app-loading__progress-fill"
        :class="{ 'is-indeterminate': props.progress < 0 }"
        :style="props.progress >= 0 ? { width: `${props.progress}%` } : undefined"
      />
    </div>

    <!-- Version -->
    <div class="app-loading__version">
      v1.0.0
    </div>
  </div>
</template>

<style scoped>
/* Custom easing curves (Emil Kowalski philosophy) */
:root {
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
}

.app-loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--nc-bg, #09090B);
  transition: opacity 300ms var(--ease-out-strong), transform 300ms var(--ease-out-strong);
}

.app-loading.is-leaving {
  opacity: 0;
  transform: scale(1.02);
  pointer-events: none;
}

/* --- Logo --- */
.app-loading__logo {
  width: 80px;
  height: 80px;
  opacity: 0;
  transform: scale(0.92);
  transition: opacity 600ms var(--ease-out-strong), transform 600ms var(--ease-out-strong);
}

.is-mounted .app-loading__logo {
  opacity: 1;
  transform: scale(1);
  animation: logoPulse 2.4s ease-in-out 800ms infinite;
}

.app-loading__logo svg {
  width: 100%;
  height: 100%;
}

/* --- Wordmark --- */
.app-loading__wordmark {
  margin-top: 20px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: #FAFAFA;
  letter-spacing: -0.02em;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 500ms var(--ease-out-strong) 150ms, transform 500ms var(--ease-out-strong) 150ms;
}

.is-mounted .app-loading__wordmark {
  opacity: 1;
  transform: translateY(0);
}

/* --- Status --- */
.app-loading__status {
  margin-top: 8px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: rgba(250, 250, 250, 0.35);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 500ms var(--ease-out-strong) 250ms, transform 500ms var(--ease-out-strong) 250ms;
}

.is-mounted .app-loading__status {
  opacity: 1;
  transform: translateY(0);
}

/* --- Progress bar --- */
.app-loading__progress {
  width: 200px;
  height: 3px;
  margin-top: 32px;
  border-radius: 2px;
  background: rgba(250, 250, 250, 0.06);
  overflow: hidden;
  opacity: 0;
  transition: opacity 400ms ease 350ms;
}

.is-mounted .app-loading__progress {
  opacity: 1;
}

.app-loading__progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(0, 210, 190, 0.4), rgba(0, 210, 190, 0.85));
  transition: width 400ms var(--ease-out-strong);
}

.app-loading__progress-fill.is-indeterminate {
  width: 40%;
  animation: progressSweep 1.6s var(--ease-in-out-strong) infinite;
}

/* --- Version --- */
.app-loading__version {
  position: absolute;
  bottom: 28px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: rgba(250, 250, 250, 0.12);
  letter-spacing: 0.04em;
  opacity: 0;
  transition: opacity 400ms ease 500ms;
}

.is-mounted .app-loading__version {
  opacity: 1;
}

/* --- Keyframes --- */
@keyframes logoPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(0.975); }
}

@keyframes progressSweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* --- Reduced motion --- */
@media (prefers-reduced-motion: reduce) {
  .app-loading__logo,
  .app-loading__wordmark,
  .app-loading__status,
  .app-loading__progress,
  .app-loading__version {
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }

  .is-mounted .app-loading__logo {
    animation: none;
  }

  .app-loading__progress-fill.is-indeterminate {
    animation: none;
    width: 60%;
  }

  .app-loading.is-leaving {
    transition-duration: 0.01ms !important;
  }
}
</style>
