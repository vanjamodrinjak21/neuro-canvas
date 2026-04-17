<script setup lang="ts">
// Redirect /signin to /auth/signin
definePageMeta({ layout: false })

onMounted(() => {
  navigateTo('/auth/signin', { replace: true })
})
</script>

<template>
  <div/>
</template>
