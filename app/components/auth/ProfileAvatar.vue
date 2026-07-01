<script setup lang="ts">
const { data: _sessionData } = useAuth()
const session = _sessionData ?? ref(null)

const emit = defineEmits<{
  click: []
}>()

const user = computed(() => session.value?.user)

const initials = computed(() => {
  if (!user.value) return '?'
  if (user.value.name) {
    return user.value.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }
  if (user.value.email) {
    return user.value.email.charAt(0).toUpperCase()
  }
  return '?'
})

const avatarImage = computed(() => user.value?.image || null)
</script>

<template>
  <button
    class="profile-avatar"
    :title="$t('ui.settings_tooltip')"
    @click="emit('click')"
  >
    <img
      v-if="avatarImage"
      :src="avatarImage"
      :alt="user?.name || 'Profile'"
      class="avatar-image"
    >
    <span v-else class="avatar-initials">{{ initials }}</span>
    <span class="avatar-ring" />
  </button>
</template>

<style scoped>
.profile-avatar {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--nc-surface-2, #121216);
  border: 1px solid var(--nc-border, #252529);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 150ms ease-out;
}

.profile-avatar:hover {
  border-color: var(--nc-teal, #00D2BE);
}

.profile-avatar:focus-visible {
  outline: none;
  ring: 2px solid var(--nc-teal, #00D2BE);
  ring-offset: 2px;
  ring-offset-color: var(--nc-charcoal, #06060A);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-initials {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--nc-ink, #FAFAFA);
  font-family: inherit;
}

.avatar-ring {
  display: none;
}
</style>
