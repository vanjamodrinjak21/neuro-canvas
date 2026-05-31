<script setup lang="ts">
/**
 * Cross-platform update banner — one component, three platforms.
 *
 *   Tauri   → "Update now" downloads + installs + relaunches
 *   Web     → "Refresh"   reloads to pick up the new SPA bundle
 *   Mobile  → "Open store" deep-links to App Store / Play Store
 *
 * Powered by `useAppUpdates` (AER-14). All platform branching lives in the
 * composable; this file only renders the unified surface.
 */
const updates = useAppUpdates()
const { t } = useI18n()
</script>

<template>
  <Transition name="slide-down">
    <div
      v-if="updates.updateAvailable.value"
      role="status"
      aria-live="polite"
      class="update-banner"
    >
      <div class="update-banner-inner">
        <div class="update-banner-head">
          <div class="update-banner-text">
            <h4 class="update-title">
              {{ t('common.update.available') }}
            </h4>
            <p class="update-message">
              {{ updates.message.value }}
            </p>
          </div>
          <button
            class="update-dismiss"
            :aria-label="t('common.update.dismiss')"
            @click="updates.dismiss()"
          >
            <svg
              class="update-dismiss-icon"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <p
          v-if="updates.error.value"
          class="update-error"
          role="alert"
        >
          {{ updates.error.value }}
        </p>

        <div
          v-if="updates.isWorking.value"
          class="update-progress-wrap"
        >
          <div class="update-progress-track">
            <div
              class="update-progress-bar"
              :style="{ width: `${Math.min(updates.progress.value, 100)}%` }"
            />
          </div>
          <p class="update-progress-label">
            {{ t('common.update.downloading') }}
          </p>
        </div>

        <div
          v-else
          class="update-actions"
        >
          <button
            class="update-cta"
            type="button"
            @click="updates.action()"
          >
            {{ updates.ctaLabel.value }}
          </button>
          <button
            class="update-secondary"
            type="button"
            @click="updates.dismiss()"
          >
            {{ t('common.update.later') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.update-banner {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  width: 20rem;
  max-width: calc(100vw - 2rem);
  border-radius: 0.5rem;
  border: 1px solid #1a1a2e;
  background-color: #0a0a0f;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.update-banner-inner {
  padding: 1rem;
}

.update-banner-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.update-banner-text {
  min-width: 0;
  flex: 1;
}

.update-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e8e4d9;
  margin: 0;
}

.update-message {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: rgba(232, 228, 217, 0.6);
}

.update-dismiss {
  flex-shrink: 0;
  padding: 0.125rem;
  color: rgba(232, 228, 217, 0.4);
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: color 0.15s ease;
}

.update-dismiss:hover {
  color: rgba(232, 228, 217, 0.7);
}

.update-dismiss-icon {
  width: 1rem;
  height: 1rem;
}

.update-error {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #f87171;
}

.update-progress-wrap {
  margin-top: 0.75rem;
}

.update-progress-track {
  height: 0.375rem;
  width: 100%;
  overflow: hidden;
  border-radius: 9999px;
  background-color: #1a1a2e;
}

.update-progress-bar {
  height: 100%;
  border-radius: 9999px;
  background-color: rgba(232, 228, 217, 0.6);
  transition: width 0.3s ease;
}

.update-progress-label {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: rgba(232, 228, 217, 0.4);
}

.update-actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.update-cta {
  border-radius: 0.375rem;
  background-color: #e8e4d9;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #0a0a0f;
  border: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.update-cta:hover {
  opacity: 0.9;
}

.update-secondary {
  border-radius: 0.375rem;
  border: 1px solid #1a1a2e;
  background: transparent;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(232, 228, 217, 0.6);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.update-secondary:hover {
  color: rgba(232, 228, 217, 0.8);
  border-color: rgba(232, 228, 217, 0.2);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
