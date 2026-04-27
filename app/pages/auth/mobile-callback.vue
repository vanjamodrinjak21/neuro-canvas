<script setup lang="ts">
/**
 * Mobile OAuth Callback
 *
 * After OAuth completes, next-auth redirects here (in the in-app browser).
 * This page:
 * 1. Reads the session user data via useAuth()
 * 2. Fetches the raw JWT cookie via /api/auth/mobile-token
 * 3. Redirects to neurocanvas://auth/callback with both the user data and token
 * 4. The native app sets the token cookie in CapacitorHttp's jar for sync
 */
definePageMeta({ layout: false })

onMounted(async () => {
  try {
    // Wait for session to be available
    const { data, getSession } = useAuth()
    await getSession({ force: true })
    await new Promise(r => setTimeout(r, 300))

    const user = data.value?.user
    if (!user?.email) {
      window.location.href = '/dashboard'
      return
    }

    // Fetch the raw JWT token from the server (same-origin, cookie attached)
    let token = ''
    let cookieName = ''
    try {
      const tokenData: { token: string; cookieName: string } = await $fetch('/api/auth/mobile-token')
      token = tokenData.token
      cookieName = tokenData.cookieName
    } catch {
      // Token fetch failed — still pass user data, sync just won't work
    }

    const payload = btoa(JSON.stringify({
      user: {
        id: (user as any).id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      token,
      cookieName,
    }))

    window.location.href = `neurocanvas://auth/callback?session=${payload}`
  } catch {
    window.location.href = '/dashboard'
  }
})
</script>

<template>
  <div class="callback-page">
    <p>Completing sign-in...</p>
  </div>
</template>

<style scoped>
.callback-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #09090B;
  color: #888890;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
}
</style>
