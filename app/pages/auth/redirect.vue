<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const target = computed(() => (route.query.to as string) || '/dashboard')

const statusText = ref('Authenticating...')
const progressWidth = ref(0)

onMounted(() => {
  // Animate progress bar
  requestAnimationFrame(() => {
    progressWidth.value = 100
  })

  // Update status text
  setTimeout(() => {
    statusText.value = 'Verified'
  }, 1500)

  setTimeout(() => {
    statusText.value = 'Redirecting...'
  }, 2000)

  // Navigate
  setTimeout(() => {
    navigateTo(target.value)
  }, 2800)
})
</script>

<template>
  <div class="redirect-page">
    <div class="redirect-container">
      <!-- Logo & brand -->
      <div class="brand">
        <NcLogo :size="18" :container-size="36" :radius="8" />
        <span class="brand-name">NeuroCanvas</span>
      </div>

      <!-- Node graph illustration -->
      <div class="illustration" aria-hidden="true">
        <svg width="400" height="200" viewBox="0 0 400 200" fill="none">
          <!-- Curved dashed path -->
          <path d="M60 100 Q140 40 200 100 Q260 160 340 100" class="curve-path" />

          <!-- Source node (content) -->
          <rect x="30" y="82" width="60" height="36" rx="6" class="node-rect" />
          <circle cx="44" cy="100" r="4" fill="#27272A" />
          <line x1="52" y1="96" x2="76" y2="96" stroke="#3F3F46" stroke-width="1.5" stroke-linecap="round" />
          <line x1="52" y1="104" x2="68" y2="104" stroke="#3F3F46" stroke-width="1.5" stroke-linecap="round" />

          <!-- Glowing center dot -->
          <circle cx="200" cy="100" r="12" fill="#00D2BE" opacity="0.15" class="glow-outer" />
          <circle cx="200" cy="100" r="8" fill="#00D2BE" opacity="0.3" class="glow-mid" />
          <circle cx="200" cy="100" r="5" fill="#00D2BE" class="glow-core" />

          <!-- Trail particles -->
          <circle cx="175" cy="82" r="3" fill="#00D2BE" opacity="0.15" />
          <circle cx="155" cy="68" r="2" fill="#00D2BE" opacity="0.08" />

          <!-- Destination node (grid) -->
          <rect x="310" y="82" width="60" height="36" rx="6" class="dest-rect" />
          <rect x="328" y="92" width="7" height="7" rx="1" fill="#27272A" />
          <rect x="338" y="92" width="7" height="7" rx="1" fill="#27272A" />
          <rect x="328" y="102" width="7" height="7" rx="1" fill="#27272A" />
          <rect x="338" y="102" width="7" height="7" rx="1" fill="#27272A" />
        </svg>
      </div>

      <!-- Copy -->
      <h1 class="heading">Routing your thoughts...</h1>
      <p class="desc">
        Verifying your identity and connecting you to your maps. This<br>
        takes a moment — good ideas need a warm-up lap.
      </p>

      <!-- Progress bar -->
      <div class="progress-wrapper">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressWidth + '%' }" />
        </div>
        <span class="status-text">{{ statusText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.redirect-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  color: #FAFAFA;
  letter-spacing: -0.03em;
}

.redirect-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 460px;
}

/* Illustration */
.illustration {
  margin-bottom: 20px;
}

.curve-path {
  stroke: #1A1A1E;
  stroke-width: 2;
  stroke-dasharray: 6 4;
}

.node-rect {
  fill: #111113;
  stroke: #27272A;
  stroke-width: 1.5;
}

.dest-rect {
  fill: #111113;
  stroke: #00D2BE;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}

/* Glow animation */
.glow-outer {
  animation: glow-pulse 2s ease-in-out infinite;
}

.glow-mid {
  animation: glow-pulse 2s ease-in-out 0.2s infinite;
}

.glow-core {
  animation: glow-pulse-core 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.15; transform-origin: center; }
  50% { opacity: 0.08; }
}

@keyframes glow-pulse-core {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .glow-outer,
  .glow-mid,
  .glow-core {
    animation: none;
  }

  .progress-fill {
    transition: width 0.5s linear;
  }
}

/* Copy */
.heading {
  font-family: 'Instrument Serif', serif;
  font-size: 28px;
  font-weight: 400;
  font-style: italic;
  line-height: 36px;
  color: #FAFAFA;
  margin: 0 0 8px;
}

.desc {
  font-size: 14px;
  line-height: 22px;
  color: #71717A;
  margin: 0 0 28px;
}

/* Progress */
.progress-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 200px;
}

.progress-track {
  width: 100%;
  height: 3px;
  background: #1A1A1E;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #00D2BE;
  border-radius: 2px;
  width: 0%;
  transition: width 3s linear;
}

.status-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 16px;
  color: #A1A1AA;
  transition: opacity 0.3s ease;
}

/* Light theme */
:root.light .brand-name {
  color: #111111;
}

:root.light .redirect-page {
  background: #FAFAF9;
}

:root.light .curve-path {
  stroke: #D4D4D8;
}

:root.light .node-rect {
  fill: #FFFFFF;
  stroke: #D4D4D8;
}

:root.light .dest-rect {
  fill: #FFFFFF;
  stroke: #00D2BE;
}

:root.light .heading {
  color: #111111;
}

:root.light .desc {
  color: #71717A;
}

:root.light .progress-track {
  background: #E8E8E6;
}

:root.light .status-text {
  color: #52525B;
}
</style>
