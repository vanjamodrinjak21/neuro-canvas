<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

// On Tauri: auto-recover from startup errors (e.g. auth module failing)
if (typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) {
  // Don't show error page on Tauri — just go to dashboard
  clearError({ redirect: '/dashboard' })
}

const handleClearError = () => clearError({ redirect: '/dashboard' })
</script>

<template>
  <div class="error-page">
    <div class="error-container">
      <!-- Logo & brand -->
      <a href="/" class="brand">
        <NcLogo :size="18" :container-size="36" :radius="8" />
        <span class="brand-name">NeuroCanvas</span>
      </a>

      <!-- Star pattern illustration -->
      <div class="illustration" aria-hidden="true">
        <svg width="360" height="280" viewBox="0 0 360 280" fill="none">
          <!-- Dashed lines from center to endpoints -->
          <line x1="180" y1="110" x2="60" y2="40" class="dash-line" />
          <line x1="180" y1="110" x2="300" y2="40" class="dash-line" />
          <line x1="180" y1="150" x2="70" y2="230" class="dash-line" />
          <line x1="180" y1="150" x2="290" y2="230" class="dash-line" />
          <line x1="180" y1="130" x2="330" y2="130" class="dash-line" />
          <line x1="180" y1="130" x2="30" y2="130" class="dash-line" />

          <!-- Endpoint dots -->
          <circle cx="60" cy="40" r="4" class="end-dot" />
          <circle cx="300" cy="40" r="4" class="end-dot" />
          <circle cx="70" cy="230" r="4" class="end-dot" />
          <circle cx="290" cy="230" r="4" class="end-dot" />
          <circle cx="330" cy="130" r="4" class="end-dot" />
          <circle cx="30" cy="130" r="4" class="end-dot" />

          <!-- X marks at endpoints -->
          <line x1="56" y1="36" x2="64" y2="44" class="x-mark" />
          <line x1="64" y1="36" x2="56" y2="44" class="x-mark" />
          <line x1="296" y1="36" x2="304" y2="44" class="x-mark" />
          <line x1="304" y1="36" x2="296" y2="44" class="x-mark" />
          <line x1="66" y1="226" x2="74" y2="234" class="x-mark" />
          <line x1="74" y1="226" x2="66" y2="234" class="x-mark" />
          <line x1="286" y1="226" x2="294" y2="234" class="x-mark" />
          <line x1="294" y1="226" x2="286" y2="234" class="x-mark" />
          <line x1="326" y1="126" x2="334" y2="134" class="x-mark" />
          <line x1="334" y1="126" x2="326" y2="134" class="x-mark" />
          <line x1="26" y1="126" x2="34" y2="134" class="x-mark" />
          <line x1="34" y1="126" x2="26" y2="134" class="x-mark" />

          <!-- Central 404 badge -->
          <rect x="138" y="100" width="84" height="60" rx="8" class="badge-rect" />
          <text x="180" y="138" text-anchor="middle" fill="#00D2BE" font-family="Inter" font-weight="700" font-size="24">
            {{ error.statusCode || 404 }}
          </text>
        </svg>
      </div>

      <!-- Copy -->
      <h1 class="heading">This thought wandered off the map</h1>
      <p class="desc">
        We checked every node, followed every branch, and even asked the AI.<br>
        This page simply doesn't exist — or maybe it's still brainstorming.
      </p>

      <!-- Actions -->
      <div class="actions">
        <button class="btn-primary" @click="handleClearError">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          Back to Dashboard
        </button>
        <a
          href="https://github.com/anthropics/claude-code/issues"
          target="_blank"
          rel="noopener"
          class="btn-ghost"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          Report Issue
        </a>
      </div>

      <!-- Footer debug text -->
      <p class="footer-debug">error_code: {{ error.statusCode || 404 }} · node_id: undefined · branch: /dev/null</p>
    </div>
  </div>
</template>

<style scoped>
.error-page {
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
  text-decoration: none;
  margin-bottom: 32px;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  color: #FAFAFA;
  letter-spacing: -0.03em;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 500px;
}

/* Illustration */
.illustration {
  margin-bottom: 12px;
}

.dash-line {
  stroke: #27272A;
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
}

.end-dot {
  fill: #27272A;
  opacity: 0.4;
}

.x-mark {
  stroke: #EF4444;
  stroke-width: 1.5;
  opacity: 0.5;
}

.badge-rect {
  fill: #111113;
  stroke: #00D2BE;
  stroke-width: 2;
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

/* Actions */
.actions {
  display: flex;
  gap: 10px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: #00D2BE;
  color: #09090B;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s;
  font-family: inherit;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: transparent;
  border: 1px solid #27272A;
  color: #A1A1AA;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s;
  font-family: inherit;
}

.btn-ghost:hover {
  border-color: #3F3F46;
  color: #FAFAFA;
}

/* Footer debug */
.footer-debug {
  position: fixed;
  bottom: 32px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  line-height: 16px;
  color: #3F3F46;
  margin: 0;
}

/* Light theme */
:root.light .brand-name {
  color: #111111;
}

:root.light .error-page {
  background: #FAFAF9;
}

:root.light .dash-line {
  stroke: #D4D4D8;
}

:root.light .end-dot {
  fill: #D4D4D8;
}

:root.light .x-mark {
  stroke: #EF4444;
  opacity: 0.4;
}

:root.light .badge-rect {
  fill: #FFFFFF;
  stroke: #00D2BE;
}

:root.light .heading {
  color: #111111;
}

:root.light .desc {
  color: #71717A;
}

:root.light .btn-primary {
  color: #FFFFFF;
}

:root.light .btn-ghost {
  border-color: #E8E8E6;
  color: #52525B;
}

:root.light .btn-ghost:hover {
  border-color: #D4D4D8;
  color: #111111;
}

:root.light .footer-debug {
  color: #D4D4D8;
}

/* Responsive */
@media (max-width: 480px) {
  .actions {
    flex-direction: column;
    width: 100%;
  }

  .btn-primary,
  .btn-ghost {
    justify-content: center;
    width: 100%;
  }
}
</style>
