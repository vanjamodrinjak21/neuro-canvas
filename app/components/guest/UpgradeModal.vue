<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'

const guest = useGuestMode()
const router = useRouter()

function handleSignUp() {
  guest.dismissUpgradeModal()
  router.push('/auth/signup')
}
</script>

<template>
  <NcDialog
    :open="guest.showUpgradeModal.value"
    :title="guest.upgradeInfo.value?.title || 'Unlock Feature'"
    size="sm"
    @update:open="guest.dismissUpgradeModal()"
  >
    <div class="upgrade-body">
      <div class="upgrade-icon">
        <span class="i-lucide-lock" />
      </div>
      <p class="upgrade-desc">
        {{ guest.upgradeInfo.value?.description }}
      </p>
      <p class="upgrade-sub">
        Create a free account to unlock all features.
      </p>
      <div class="upgrade-actions">
        <NcButton variant="primary" @click="handleSignUp">
          Sign up free
        </NcButton>
        <NcButton variant="ghost" @click="guest.dismissUpgradeModal()">
          Maybe later
        </NcButton>
      </div>
    </div>
  </NcDialog>
</template>

<style scoped>
.upgrade-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  padding: 1rem 0;
}

.upgrade-icon {
  width: 56px;
  height: 56px;
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--nc-teal, #00D2BE);
}

.upgrade-desc {
  font-size: 0.95rem;
  color: var(--nc-ink, #FAFAFA);
  margin: 0;
  line-height: 1.5;
}

.upgrade-sub {
  font-size: 0.8rem;
  color: var(--nc-ink-muted, #A1A1AA);
  margin: 0;
}

.upgrade-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  margin-top: 0.5rem;
}
</style>
