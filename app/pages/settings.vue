<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'

definePageMeta({
  layout: 'default'
})

useHead({
  title: 'Settings - NeuroCanvas'
})

const userStore = useUserStore()

const fontSizeOptions = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
]

const themeOptions = [
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' }
]

function handleResetPreferences() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    userStore.resetPreferences()
  }
}
</script>

<template>
  <div class="min-h-screen bg-nc-charcoal p-6 md:p-8 lg:p-12">
    <!-- Header -->
    <header class="nc-between mb-10 max-w-3xl mx-auto">
      <div class="nc-row items-center gap-3">
        <NuxtLink to="/dashboard" class="p-2 rounded-nc-md text-nc-ink-muted hover:text-nc-ink hover:bg-nc-graphite transition-colors">
          <span class="i-lucide-arrow-left text-xl" />
        </NuxtLink>
        <h1 class="text-2xl font-sans font-semibold text-nc-ink">Settings</h1>
      </div>
    </header>

    <main class="max-w-3xl mx-auto space-y-8">
      <!-- Appearance -->
      <NcCard elevated padding="lg">
        <h2 class="text-lg font-sans font-semibold text-nc-ink mb-6">Appearance</h2>

        <!-- Theme -->
        <div class="space-y-6">
          <div>
            <label class="text-sm font-medium text-nc-ink-muted mb-3 block font-sans">Theme</label>
            <div class="flex gap-3">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                :class="[
                  'flex-1 py-4 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 rounded-nc-xl border',
                  userStore.preferences.value.theme === option.value
                    ? 'border-nc-teal bg-nc-teal/5 shadow-nc-glow'
                    : 'border-nc-pencil bg-nc-graphite hover:border-nc-teal/30'
                ]"
                @click="userStore.setPreference('theme', option.value as any)"
              >
                <span :class="[option.icon, 'text-2xl', userStore.preferences.value.theme === option.value ? 'text-nc-teal' : 'text-nc-ink-muted']" />
                <span class="text-sm text-nc-ink font-sans">{{ option.label }}</span>
              </button>
            </div>
          </div>

          <!-- Divider -->
          <div class="nc-divider-solid" />

          <!-- Font Size -->
          <div>
            <label class="text-sm font-medium text-nc-ink-muted mb-3 block font-sans">Font Size</label>
            <div class="flex gap-2">
              <button
                v-for="option in fontSizeOptions"
                :key="option.value"
                :class="[
                  'px-4 py-2 rounded-nc-md font-medium transition-all duration-200 font-sans text-sm',
                  userStore.preferences.value.fontSize === option.value
                    ? 'bg-nc-teal text-nc-charcoal'
                    : 'bg-nc-pencil text-nc-ink hover:bg-nc-graphite'
                ]"
                @click="userStore.setPreference('fontSize', option.value as any)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <!-- Divider -->
          <div class="nc-divider-solid" />

          <!-- Reduced Motion -->
          <div class="nc-between">
            <div>
              <p class="text-nc-ink font-medium font-sans">Reduced Motion</p>
              <p class="text-sm text-nc-ink-muted font-sans">Minimize animations for accessibility</p>
            </div>
            <NcSwitch
              :model-value="userStore.preferences.value.reducedMotion"
              @update:model-value="userStore.setPreference('reducedMotion', $event)"
            />
          </div>
        </div>
      </NcCard>

      <!-- Canvas -->
      <NcCard elevated padding="lg">
        <h2 class="text-lg font-sans font-semibold text-nc-ink mb-6">Canvas</h2>

        <div class="space-y-6">
          <!-- Show Grid -->
          <div class="nc-between">
            <div>
              <p class="text-nc-ink font-medium font-sans">Show Grid</p>
              <p class="text-sm text-nc-ink-muted font-sans">Display background grid on canvas</p>
            </div>
            <NcSwitch
              :model-value="userStore.preferences.value.showGrid"
              @update:model-value="userStore.setPreference('showGrid', $event)"
            />
          </div>

          <!-- Divider -->
          <div class="nc-divider-solid" />

          <!-- Show Minimap -->
          <div class="nc-between">
            <div>
              <p class="text-nc-ink font-medium font-sans">Show Minimap</p>
              <p class="text-sm text-nc-ink-muted font-sans">Display navigation minimap</p>
            </div>
            <NcSwitch
              :model-value="userStore.preferences.value.showMinimap"
              @update:model-value="userStore.setPreference('showMinimap', $event)"
            />
          </div>
        </div>
      </NcCard>

      <!-- Auto-save -->
      <NcCard elevated padding="lg">
        <h2 class="text-lg font-sans font-semibold text-nc-ink mb-6">Auto-save</h2>

        <div class="space-y-6">
          <!-- Enable Auto-save -->
          <div class="nc-between">
            <div>
              <p class="text-nc-ink font-medium font-sans">Enable Auto-save</p>
              <p class="text-sm text-nc-ink-muted font-sans">Automatically save your work</p>
            </div>
            <NcSwitch
              :model-value="userStore.preferences.value.autoSave"
              @update:model-value="userStore.setPreference('autoSave', $event)"
            />
          </div>

          <!-- Auto-save Interval -->
          <div v-if="userStore.preferences.value.autoSave">
            <div class="nc-divider-solid mb-6" />
            <label class="text-sm font-medium text-nc-ink-muted mb-3 block font-sans">Save Interval</label>
            <div class="flex items-center gap-4">
              <NcSlider
                :model-value="[userStore.preferences.value.autoSaveInterval / 1000]"
                :min="10"
                :max="120"
                :step="10"
                show-value
                class="flex-1"
                @update:model-value="userStore.setPreference('autoSaveInterval', $event[0] * 1000)"
              />
              <span class="text-sm text-nc-ink-muted w-16 font-sans">
                {{ userStore.preferences.value.autoSaveInterval / 1000 }}s
              </span>
            </div>
          </div>
        </div>
      </NcCard>

      <!-- About -->
      <NcCard elevated padding="lg">
        <h2 class="text-lg font-sans font-semibold text-nc-ink mb-6">About</h2>

        <div class="space-y-4 text-sm font-sans">
          <div class="nc-between py-2">
            <span class="text-nc-ink-muted">Version</span>
            <span class="text-nc-ink font-medium">1.0.0</span>
          </div>
          <div class="nc-divider-solid" />
          <div class="nc-between py-2">
            <span class="text-nc-ink-muted">Author</span>
            <span class="text-nc-ink font-medium">Vanja Modrinjak</span>
          </div>
          <div class="nc-divider-solid" />
          <div class="nc-between py-2">
            <span class="text-nc-ink-muted">Technology</span>
            <span class="text-nc-ink font-medium">Nuxt 4 + Tauri 2 + Capacitor 7</span>
          </div>
        </div>

        <div class="mt-8 pt-6 border-t border-nc-pencil">
          <button
            class="text-sm text-nc-error hover:underline font-sans"
            @click="handleResetPreferences"
          >
            Reset all settings to defaults
          </button>
        </div>
      </NcCard>
    </main>
  </div>
</template>
