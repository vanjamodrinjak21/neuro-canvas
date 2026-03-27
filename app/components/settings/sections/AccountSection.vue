<script setup lang="ts">
import { useAISettings } from '~/composables/useAISettings'

const emit = defineEmits<{
  close: []
}>()

const { data: _sessionData } = useAuth()
const session = _sessionData ?? ref(null)
const { handleSignOut, isLoading: signOutLoading } = useAuthStore()
const aiSettings = useAISettings()

const user = computed(() => session.value?.user)

// Format date for display
function formatDate(date: string | Date | undefined): string {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Handle sign out - clear secrets first
async function onSignOut() {
  await aiSettings.clearAllSecrets()
  await handleSignOut()
  emit('close')
}
</script>

<template>
  <div class="account-section">
    <!-- Profile Card -->
    <div class="profile-card">
      <div class="profile-avatar-large">
        <img
          v-if="user?.image"
          :src="user.image"
          :alt="user?.name || 'Profile'"
          class="avatar-img"
        >
        <span v-else class="avatar-placeholder">
          <span class="i-lucide-user" />
        </span>
      </div>

      <div class="profile-info">
        <h3 class="profile-name">{{ user?.name || 'User' }}</h3>
        <p class="profile-email">{{ user?.email }}</p>
      </div>
    </div>

    <!-- Account Details -->
    <div class="section-block">
      <h4 class="section-label">Account Details</h4>

      <div class="detail-row">
        <span class="detail-label">
          <span class="i-lucide-mail detail-icon" />
          Email
        </span>
        <span class="detail-value">{{ user?.email || 'Not set' }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">
          <span class="i-lucide-shield-check detail-icon" />
          Sign-in Method
        </span>
        <span class="detail-value oauth-badge">
          <span class="i-lucide-check-circle badge-icon" />
          OAuth
        </span>
      </div>
    </div>

    <!-- Data & Privacy -->
    <div class="section-block">
      <h4 class="section-label">Data & Privacy</h4>

      <p class="privacy-note">
        <span class="i-lucide-lock privacy-icon" />
        Your API keys are encrypted and stored locally in your browser. They are never sent to our servers.
      </p>

      <div class="detail-row">
        <span class="detail-label">
          <span class="i-lucide-database detail-icon" />
          Local Storage
        </span>
        <span class="detail-value">IndexedDB</span>
      </div>
    </div>

    <!-- Sign Out -->
    <div class="section-block danger-zone">
      <h4 class="section-label">Session</h4>

      <NcButton
        variant="danger"
        :loading="signOutLoading"
        @click="onSignOut"
      >
        <span class="i-lucide-log-out" />
        Sign Out
      </NcButton>

      <p class="signout-note">
        Signing out will clear all cached API keys from memory.
      </p>
    </div>
  </div>
</template>

<style scoped>
.account-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--nc-surface, #0C0C10), var(--nc-surface-2, #121216));
  border: 1px solid var(--nc-border, #252529);
  border-radius: 16px;
}

.profile-avatar-large {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--nc-teal, #00D2BE), rgba(0, 210, 190, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 1.75rem;
  color: var(--nc-charcoal, #06060A);
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--nc-ink, #FAFAFA);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-email {
  font-size: 0.875rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0.25rem 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  min-height: 44px;
  background: var(--nc-surface, #0C0C10);
  border: 1px solid var(--nc-border, #252529);
  border-radius: 10px;
}

.detail-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--nc-ink-muted, #A1A1AA);
}

.detail-icon {
  font-size: 1rem;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--nc-ink, #FAFAFA);
}

.oauth-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 6px;
  color: #22C55E;
  font-size: 0.8rem;
}

.badge-icon {
  font-size: 0.875rem;
}

.privacy-note {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: rgba(0, 210, 190, 0.05);
  border: 1px solid rgba(0, 210, 190, 0.15);
  border-radius: 10px;
  font-size: 0.8rem;
  color: var(--nc-ink-muted, #A1A1AA);
  line-height: 1.5;
  margin: 0;
}

.privacy-icon {
  font-size: 1rem;
  color: var(--nc-teal, #00D2BE);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.danger-zone {
  padding-top: 1rem;
  border-top: 1px solid var(--nc-border, #252529);
}

.signout-note {
  font-size: 0.75rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
}
</style>
