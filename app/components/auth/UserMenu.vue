<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from 'radix-vue'
import { safeImageUrl } from '~/utils/safeUrl'

const { t } = useI18n()
const { data: _sessionData, status } = useAuth()
const session = _sessionData ?? ref(null)
const { handleSignOut, isLoading } = useAuthStore()
const router = useRouter()

const user = computed(() => session.value?.user)
const avatarSrc = computed(() => safeImageUrl(user.value?.image))

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
            v-if="avatarSrc"
            :src="avatarSrc"
            :alt="user?.name || 'User'"
            class="avatar-image"
            referrerpolicy="no-referrer"
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
            <p class="user-name">{{ user?.name || t('auth.user_menu.user_default') }}</p>
            <p class="user-email">{{ user?.email }}</p>
          </div>
        </div>

        <DropdownMenuSeparator class="menu-separator" />

        <!-- Menu items -->
        <DropdownMenuItem class="menu-item" @click="goToProfile">
          <span class="i-lucide-user menu-icon" />
          <span>{{ t('auth.user_menu.profile') }}</span>
        </DropdownMenuItem>

        <DropdownMenuItem class="menu-item" @click="goToSettings">
          <span class="i-lucide-settings menu-icon" />
          <span>{{ t('auth.user_menu.settings') }}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator class="menu-separator" />

        <DropdownMenuItem
          class="menu-item menu-item-danger"
          :disabled="isLoading"
          @click="handleSignOut"
        >
          <span v-if="isLoading" class="i-lucide-loader-2 animate-spin menu-icon" />
          <span v-else class="i-lucide-log-out menu-icon" />
          <span>{{ t('auth.user_menu.sign_out') }}</span>
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
  transition: opacity var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .user-menu-trigger:hover {
    opacity: 0.9;
  }
}

.user-menu-trigger:active {
  transform: scale(0.97);
}

.user-menu-trigger:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.user-menu-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* Avatar — flat accent tint + hairline, no gradient (REDESIGN.md §5) */
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(var(--nc-accent-rgb), 0.08);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.3);
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
  color: var(--nc-accent);
}

.chevron {
  font-size: 0.875rem;
  color: var(--nc-text-dim);
  transition: transform var(--nc-duration-normal) var(--nc-ease);
}

.user-menu-trigger[data-state="open"] .chevron {
  transform: rotate(180deg);
}

/* Dropdown — flat surface-2 + hairline, radius 8px, no blur, no glow
   (REDESIGN.md §5). Origin at the trigger, scale(0.97)+opacity. */
.user-menu-content {
  min-width: 220px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  padding: 0.5rem;
  box-shadow: var(--nc-shadow-md);
  z-index: 1000;
  transform-origin: var(--radix-dropdown-menu-content-transform-origin, top right);
  animation: nc-menu-in var(--nc-duration-fast) var(--nc-ease);
}

@keyframes nc-menu-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .user-menu-content {
    animation: none;
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
  background: rgba(var(--nc-accent-rgb), 0.08);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.3);
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
  color: var(--nc-accent);
}

.user-details {
  min-width: 0;
}

.user-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nc-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.8rem;
  color: var(--nc-text-muted);
  margin: 0.125rem 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Separator */
.menu-separator {
  height: 1px;
  background: var(--nc-border-subtle);
  margin: 0.375rem 0;
}

/* Menu items — hover surface-3, ink text (REDESIGN.md §5) */
.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--nc-radius-sm);
  font-size: 0.9rem;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease);
  outline: none;
}

.menu-item:focus {
  background: var(--nc-surface-3);
  color: var(--nc-text);
}

@media (hover: hover) and (pointer: fine) {
  .menu-item:hover {
    background: var(--nc-surface-3);
    color: var(--nc-text);
  }
}

.menu-item[data-disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Destructive — coral text, calm coral-tint hover (accent discipline §1) */
.menu-item-danger {
  color: var(--nc-coral);
}

.menu-item-danger:focus {
  background: rgba(var(--nc-coral-rgb), 0.08);
  color: var(--nc-coral);
}

@media (hover: hover) and (pointer: fine) {
  .menu-item-danger:hover {
    background: rgba(var(--nc-coral-rgb), 0.08);
    color: var(--nc-coral);
  }
}

.menu-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}
</style>
