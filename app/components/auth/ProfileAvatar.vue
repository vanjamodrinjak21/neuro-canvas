<script setup lang="ts">
const { data: session } = useAuth()

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
    return user.value.email[0].toUpperCase()
  }
  return '?'
})

const avatarImage = computed(() => user.value?.image || null)
</script>

<template>
  <button
    class="profile-avatar"
    title="Settings"
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
  background: linear-gradient(135deg, var(--nc-surface-2, #121216), var(--nc-surface-3, #18181D));
  border: 1px solid var(--nc-border, #252529);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.profile-avatar:hover {
  border-color: var(--nc-teal, #00D2BE);
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(0, 210, 190, 0.3);
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
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 2px solid transparent;
  background: linear-gradient(135deg, var(--nc-teal, #00D2BE), transparent) border-box;
  mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  opacity: 0;
  transition: opacity 0.3s;
}

.profile-avatar:hover .avatar-ring {
  opacity: 1;
}
</style>
