<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from 'radix-vue'

const { data: session, status } = useAuth()
const { handleSignOut, isLoading } = useAuthStore()
const router = useRouter()

const user = computed(() => session.value?.user)

const initials = computed(() => {
  if (!user.value?.name && !user.value?.email) return '?'
  const name = user.value.name || user.value.email || ''
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

function goToSettings() {
  router.push('/settings')
}

function goToProfile() {
  router.push('/profile')
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <button class="user-menu-trigger" :disabled="status === 'loading'">
        <div class="avatar">
          <img
            v-if="user?.image"
            :src="user.image"
            :alt="user.name || 'User'"
            class="avatar-image"
          >
          <span v-else class="avatar-initials">{{ initials }}</span>
        </div>
        <span class="i-lucide-chevron-down chevron" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        class="user-menu-content"
        :side-offset="8"
        align="end"
      >
        <!-- User info header -->
        <div class="user-info">
          <div class="user-avatar">
            <img
              v-if="user?.image"
              :src="user.image"
              :alt="user?.name || 'User'"
              class="user-avatar-image"
            >
            <span v-else class="user-avatar-initials">{{ initials }}</span>
          </div>
          <div class="user-details">
            <p class="user-name">{{ user?.name || 'User' }}</p>
            <p class="user-email">{{ user?.email }}</p>
          </div>
        </div>

        <DropdownMenuSeparator class="menu-separator" />

        <!-- Menu items -->
        <DropdownMenuItem class="menu-item" @click="goToProfile">
          <span class="i-lucide-user menu-icon" />
          <span>Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem class="menu-item" @click="goToSettings">
          <span class="i-lucide-settings menu-icon" />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator class="menu-separator" />

        <DropdownMenuItem
          class="menu-item menu-item-danger"
          :disabled="isLoading"
          @click="handleSignOut"
        >
          <span v-if="isLoading" class="i-lucide-loader-2 animate-spin menu-icon" />
          <span v-else class="i-lucide-log-out menu-icon" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.user-menu-trigger:hover {
  opacity: 0.9;
}

.user-menu-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(0, 210, 190, 0.2), rgba(0, 210, 190, 0.1));
  border: 1px solid rgba(0, 210, 190, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--nc-teal, #00D2BE);
}

.chevron {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.2s ease;
}

.user-menu-trigger[data-state="open"] .chevron {
  transform: rotate(180deg);
}

/* Dropdown Content */
.user-menu-content {
  min-width: 220px;
  background: rgba(18, 18, 22, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 0.5rem;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(0, 210, 190, 0.08);
  z-index: 1000;
  animation: slideDown 0.15s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* User info header */
.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(0, 210, 190, 0.2), rgba(0, 210, 190, 0.1));
  border: 1px solid rgba(0, 210, 190, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar-initials {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nc-teal, #00D2BE);
}

.user-details {
  min-width: 0;
}

.user-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0.125rem 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Separator */
.menu-separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0.375rem 0;
}

/* Menu items */
.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
}

.menu-item:hover,
.menu-item:focus {
  background: rgba(255, 255, 255, 0.05);
  color: var(--nc-ink, #FAFAFA);
}

.menu-item[data-disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-item-danger {
  color: rgba(239, 68, 68, 0.9);
}

.menu-item-danger:hover,
.menu-item-danger:focus {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
}

.menu-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}
</style>
