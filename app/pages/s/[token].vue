<script setup lang="ts">
/**
 * Share-link entry point. Resolves the opaque share token to a mapId and
 * redirects into the live collab canvas at `/map/{id}?via={token}`. The
 * canvas page consumes `via` when it mints the PartyKit JWT so the role
 * baked into the share (viewer / commenter / editor) flows all the way
 * through to the Y.Doc readOnly flag.
 *
 * No auth required to land here — share links work for anonymous users
 * when the share role is VIEWER or COMMENTER. EDITOR shares require a
 * signed-in session; mintCollabToken returns 401 and the canvas surfaces
 * a sign-in prompt.
 */

definePageMeta({
  layout: false,
  auth: false,
  ssr: false,
})

const route = useRoute()
const token = computed(() => String(route.params.token || ''))

const error = ref<string | null>(null)
const status = ref<'resolving' | 'redirecting' | 'error'>('resolving')

onMounted(async () => {
  if (!token.value) {
    error.value = 'Missing share token.'
    status.value = 'error'
    return
  }

  try {
    const res = await $fetch<{ id: string }>(`/api/share/${encodeURIComponent(token.value)}`)
    status.value = 'redirecting'
    // Use `replace` so the share URL doesn't pollute back-history — the
    // canvas page becomes the "real" location.
    await navigateTo(`/map/${res.id}?via=${encodeURIComponent(token.value)}`, { replace: true })
  } catch (e: unknown) {
    const err = e as { statusCode?: number; data?: { statusMessage?: string }; message?: string }
    if (err.statusCode === 410) {
      error.value = 'This share link has been revoked or expired.'
    } else if (err.statusCode === 404) {
      error.value = 'Share link not found.'
    } else if (err.statusCode === 429) {
      error.value = 'Too many requests. Please wait a moment and try again.'
    } else {
      error.value = err.data?.statusMessage || 'Could not open this shared map.'
    }
    status.value = 'error'
  }
})

useHead({ title: 'Opening shared map · NeuroCanvas' })
</script>

<template>
  <div class="nc-share-gate">
    <div v-if="status !== 'error'" class="nc-share-gate-card" role="status" aria-live="polite">
      <span class="nc-share-spin i-lucide-loader-circle" />
      <p class="nc-share-msg">
        {{ status === 'resolving' ? 'Opening shared map…' : 'Redirecting…' }}
      </p>
    </div>

    <div v-else class="nc-share-gate-card nc-share-gate-error" role="alert">
      <span class="nc-share-err-icon i-lucide-link-2-off" />
      <p class="nc-share-msg">{{ error }}</p>
      <a class="nc-share-cta" href="/">Back to NeuroCanvas</a>
    </div>
  </div>
</template>

<style scoped>
.nc-share-gate {
  min-height: 100dvh;
  background: var(--nc-bg, #09090B);
  color: var(--nc-text, #FAFAFA);
  display: grid;
  place-items: center;
  font-family: var(--nc-font-body, 'Cabinet Grotesk', system-ui, sans-serif);
  padding: 24px;
}

.nc-share-gate-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 32px 36px;
  border: 1px solid var(--nc-border, #1A1A1E);
  border-radius: 14px;
  background: var(--nc-surface, #111113);
  max-width: 360px;
  text-align: center;
}

.nc-share-spin {
  font-size: 28px;
  color: var(--nc-accent, #00D2BE);
  animation: nc-share-spin 0.9s linear infinite;
}

@keyframes nc-share-spin { to { transform: rotate(360deg); } }

.nc-share-err-icon {
  font-size: 28px;
  color: #EF4444;
}

.nc-share-msg {
  font-size: 14px;
  color: var(--nc-text-secondary, #A1A1AA);
  line-height: 1.5;
  margin: 0;
}

.nc-share-cta {
  margin-top: 4px;
  padding: 8px 18px;
  border-radius: 8px;
  background: var(--nc-accent, #00D2BE);
  color: #09090B;
  font-weight: 600;
  font-size: 13px;
  text-decoration: none;
}
</style>
