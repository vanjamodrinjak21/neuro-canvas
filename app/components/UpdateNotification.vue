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

// Progress width consumed by v-bind() in the scoped CSS — the sanctioned
// escape hatch for dynamic values (no inline :style bindings).
const progressWidth = computed(() => `${Math.min(updates.progress.value, 100)}%`)
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
            <div class="update-progress-bar" />
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
/* Toast-adjacent grammar: flat surface-2 + hairline, calm shadow only. */
.update-banner {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  width: 20rem;
  max-width: calc(100vw - 2rem);
  border-radius: var(--nc-radius-md);
  border: 1px solid var(--nc-border);
  background-color: var(--nc-surface-2);
  box-shadow: var(--nc-shadow-md);
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

/* Title — mono micro-label (REDESIGN.md §4). */
.update-title {
  font-family: var(--nc-font-mono);
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--nc-text);
  margin: 0;
}

.update-message {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--nc-text-secondary);
}

/* Icon button — transparent, hover brightens on surface-3. */
.update-dismiss {
  flex-shrink: 0;
  padding: 0.125rem;
  border-radius: 0.35rem;
  color: var(--nc-text-muted);
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.update-dismiss:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .update-dismiss:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

.update-dismiss-icon {
  width: 1rem;
  height: 1rem;
}

/* Error — coral, the attention accent. */
.update-error {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--nc-coral);
}

.update-progress-wrap {
  margin-top: 0.75rem;
}

.update-progress-track {
  height: 0.375rem;
  width: 100%;
  overflow: hidden;
  border-radius: 3px;
  background-color: var(--nc-surface-3);
}

/* Progress fill — accent; width driven via v-bind (no inline styles). */
.update-progress-bar {
  height: 100%;
  border-radius: 3px;
  background-color: var(--nc-accent);
  width: v-bind(progressWidth);
  transition: width var(--nc-duration-slow) var(--nc-ease);
}

/* Status readout — mono micro-label. */
.update-progress-label {
  margin-top: 0.375rem;
  font-family: var(--nc-font-mono);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

.update-actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

/* Action — accent chip (accent = interactive/hot, REDESIGN.md §1). */
.update-cta {
  border-radius: 0.4rem;
  border: 1px solid rgba(var(--nc-accent-rgb), 0.4);
  background-color: rgba(var(--nc-accent-rgb), 0.08);
  padding: 0.375rem 0.75rem;
  font-family: var(--nc-font-mono);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-accent);
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.update-cta:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .update-cta:hover {
    background-color: rgba(var(--nc-accent-rgb), 0.14);
    border-color: var(--nc-accent);
  }
}

/* Secondary — mono uppercase ghost chip. */
.update-secondary {
  border-radius: 0.4rem;
  border: 1px solid var(--nc-border);
  background: transparent;
  padding: 0.375rem 0.75rem;
  font-family: var(--nc-font-mono);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.update-secondary:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .update-secondary:hover {
    color: var(--nc-text);
    border-color: var(--nc-border-active);
  }
}

.update-cta:focus-visible,
.update-secondary:focus-visible,
.update-dismiss:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Enter/leave — transform/opacity only, single ease; exit faster. */
.slide-down-enter-active {
  transition: opacity var(--nc-duration-slow) var(--nc-ease),
              transform var(--nc-duration-slow) var(--nc-ease);
}

.slide-down-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-fast) var(--nc-ease);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
