<script setup lang="ts">
const props = withDefaults(defineProps<{
  loading: boolean
  error: string | null
  isDragOver?: boolean
}>(), {
  isDragOver: false
})
</script>

<template>
  <div v-if="loading" class="absolute inset-0 z-50 nc-center bg-nc-bg">
    <div class="text-center">
      <div class="w-12 h-12 rounded-full border-2 border-nc-accent border-t-transparent animate-spin mx-auto mb-4" />
      <p class="text-nc-ink-muted font-display">Loading map...</p>
    </div>
  </div>

  <div v-else-if="error" class="absolute inset-0 z-50 nc-center bg-nc-bg">
    <div class="text-center">
      <div class="w-16 h-16 rounded-full bg-nc-coral/10 nc-center mx-auto mb-4">
        <span class="i-lucide-alert-circle text-nc-coral text-2xl" />
      </div>
      <h2 class="text-xl font-display font-semibold text-nc-ink mb-2">{{ $t('canvas.overlay.load_failed') }}</h2>
      <p class="text-nc-ink-muted mb-6">{{ error }}</p>
      <NcButton variant="primary" @click="$router.push('/dashboard')">{{ $t('canvas.overlay.go_to_dashboard') }}</NcButton>
    </div>
  </div>

  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isDragOver"
      class="absolute inset-0 z-40 pointer-events-none canvas-drop-active"
    />
  </Transition>
</template>

<style scoped>
/* Drop target — dashed accent hairline (1px discipline), tinted fill */
.canvas-drop-active {
  border: 1px dashed var(--nc-accent);
  background: rgba(var(--nc-accent-rgb), 0.04);
  border-radius: 0.5rem;
  margin: 8px;
}
</style>
