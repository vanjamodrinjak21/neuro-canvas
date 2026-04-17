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

// Fetch profile for createdAt
const userProfile = ref<{ createdAt?: string; totpEnabled?: boolean } | null>(null)

onMounted(async () => {
  try {
    userProfile.value = await $fetch('/api/user/profile')
  } catch {
    // Non-critical, just won't show member since
  }
})

const memberSince = computed(() => formatDate(userProfile.value?.createdAt))

// ── 2FA (TOTP) ─────────────────────────────────────────────────────
const totpEnabled = computed(() => userProfile.value?.totpEnabled || false)
const totpStep = ref<'idle' | 'setup' | 'verify' | 'backup' | 'disable'>('idle')
const totpQrCode = ref('')
const totpSecretKey = ref('')
const totpCode = ref('')
const totpError = ref<string | null>(null)
const totpLoading = ref(false)
const backupCodes = ref<string[]>([])
const disablePassword = ref('')

async function startTotpSetup() {
  totpLoading.value = true
  totpError.value = null
  try {
    const data = await $fetch<{ qrCode: string; secret: string }>('/api/user/totp/setup', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    totpQrCode.value = data.qrCode
    totpSecretKey.value = data.secret
    totpStep.value = 'verify'
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    totpError.value = err?.data?.statusMessage || 'Failed to start 2FA setup'
  } finally {
    totpLoading.value = false
  }
}

async function verifyTotp() {
  if (totpCode.value.length !== 6) return
  totpLoading.value = true
  totpError.value = null
  try {
    const data = await $fetch<{ backupCodes: string[] }>('/api/user/totp/verify', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: { code: totpCode.value }
    })
    backupCodes.value = data.backupCodes
    totpStep.value = 'backup'
    if (userProfile.value) userProfile.value.totpEnabled = true
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    totpError.value = err?.data?.statusMessage || 'Invalid code'
  } finally {
    totpLoading.value = false
    totpCode.value = ''
  }
}

async function disableTotp() {
  if (!disablePassword.value) return
  totpLoading.value = true
  totpError.value = null
  try {
    await $fetch('/api/user/totp/disable', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: { password: disablePassword.value }
    })
    if (userProfile.value) userProfile.value.totpEnabled = false
    totpStep.value = 'idle'
    disablePassword.value = ''
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    totpError.value = err?.data?.statusMessage || 'Failed to disable 2FA'
  } finally {
    totpLoading.value = false
  }
}

function closeTotpFlow() {
  totpStep.value = 'idle'
  totpQrCode.value = ''
  totpSecretKey.value = ''
  totpCode.value = ''
  totpError.value = null
  backupCodes.value = []
  disablePassword.value = ''
}

// ── Change Password ────────────────────────────────────────────────
const showPasswordForm = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const passwordError = ref<string | null>(null)
const passwordSuccess = ref(false)
const isChangingPassword = ref(false)

// Clear sensitive data from memory on unmount
onUnmounted(() => {
  currentPassword.value = ''
  newPassword.value = ''
  deleteConfirmText.value = ''
})

async function changePassword() {
  if (!currentPassword.value || !newPassword.value) return

  isChangingPassword.value = true
  passwordError.value = null
  passwordSuccess.value = false

  try {
    await $fetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      }
    })
    passwordSuccess.value = true
    currentPassword.value = ''
    newPassword.value = ''
    setTimeout(() => {
      showPasswordForm.value = false
      passwordSuccess.value = false
    }, 2000)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    passwordError.value = err?.data?.statusMessage || 'Failed to change password'
  } finally {
    isChangingPassword.value = false
  }
}

// ── Export Data ─────────────────────────────────────────────────────
const isExporting = ref(false)

const exportError = ref<string | null>(null)

async function exportAllData() {
  isExporting.value = true
  exportError.value = null
  try {
    const data = await $fetch('/api/user/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `neurocanvas-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Delay revocation to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e: unknown) {
    const err = e as { statusCode?: number; data?: { statusMessage?: string } }
    if (err?.statusCode === 401) {
      exportError.value = 'Session expired. Please sign in again.'
    } else if (err?.statusCode === 429) {
      exportError.value = 'Too many export requests. Please try again later.'
    } else {
      exportError.value = 'Failed to export data. Please try again.'
    }
  } finally {
    isExporting.value = false
  }
}

// ── Delete Account ──────────────────────────────────────────────────
const showDeleteConfirm = ref(false)
const deleteConfirmText = ref('')
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

async function deleteAccount() {
  if (deleteConfirmText.value !== 'DELETE MY ACCOUNT') return

  isDeleting.value = true
  deleteError.value = null

  try {
    await $fetch('/api/user/account', {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: { confirmation: deleteConfirmText.value }
    })
    // Clear local data and redirect
    await aiSettings.clearAllSecrets()
    await handleSignOut()
    emit('close')
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    deleteError.value = err?.data?.statusMessage || 'Failed to delete account'
  } finally {
    isDeleting.value = false
  }
}

// ── Sign Out ────────────────────────────────────────────────────────
async function onSignOut() {
  await aiSettings.clearAllSecrets()
  await handleSignOut()
  emit('close')
}
</script>

<template>
  <div class="tab-content">
    <!-- ACCOUNT Section -->
    <div class="settings-section">
      <span class="section-label">Account</span>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">Email</span>
          <span class="setting-desc">Your account email address</span>
        </div>
        <span class="setting-value">{{ user?.email || 'Not set' }}</span>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">Member Since</span>
          <span class="setting-desc">When you joined NeuroCanvas</span>
        </div>
        <span class="setting-value">{{ memberSince }}</span>
      </div>
    </div>

    <!-- SECURITY Section -->
    <div class="settings-section">
      <span class="section-label">Security</span>

      <!-- Change Password -->
      <div class="setting-row" :class="{ expanded: showPasswordForm }">
        <template v-if="!showPasswordForm">
          <div class="setting-info">
            <span class="setting-title">Change Password</span>
            <span class="setting-desc">Update your account password</span>
          </div>
          <button class="action-btn" @click="showPasswordForm = true">
            Change
          </button>
        </template>

        <template v-else>
          <div class="password-form">
            <div class="setting-info">
              <span class="setting-title">Change Password</span>
            </div>

            <div class="form-fields">
              <input
                v-model="currentPassword"
                type="password"
                class="setting-input"
                placeholder="Current password"
                autocomplete="current-password"
              >
              <input
                v-model="newPassword"
                type="password"
                class="setting-input"
                placeholder="New password"
                autocomplete="new-password"
                minlength="8"
              >

              <div v-if="passwordError" class="inline-error">
                <span class="i-lucide-alert-circle" />
                {{ passwordError }}
              </div>

              <div v-if="passwordSuccess" class="inline-success">
                <span class="i-lucide-check-circle" />
                Password changed successfully
              </div>

              <div class="form-actions">
                <button
                  class="cancel-btn"
                  @click="showPasswordForm = false; passwordError = null"
                >
                  Cancel
                </button>
                <button
                  class="save-btn"
                  :disabled="isChangingPassword || !currentPassword || !newPassword"
                  @click="changePassword"
                >
                  {{ isChangingPassword ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Two-Factor Authentication -->
      <div class="setting-row" :class="{ expanded: totpStep !== 'idle' }">
        <template v-if="totpStep === 'idle'">
          <div class="setting-info">
            <span class="setting-title">Two-Factor Authentication</span>
            <span class="setting-desc">
              {{ totpEnabled ? 'Enabled — your account is protected with 2FA' : 'Add an extra layer of security to your account' }}
            </span>
          </div>
          <button
            v-if="!totpEnabled"
            class="action-btn"
            :disabled="totpLoading"
            @click="startTotpSetup"
          >
            Enable
          </button>
          <button
            v-else
            class="delete-btn"
            @click="totpStep = 'disable'"
          >
            Disable
          </button>
        </template>

        <!-- Setup: Show QR code -->
        <template v-else-if="totpStep === 'verify'">
          <div class="totp-setup">
            <div class="setting-info">
              <span class="setting-title">Scan QR Code</span>
              <span class="setting-desc">Scan with your authenticator app (Google Authenticator, Authy, etc.)</span>
            </div>

            <div class="totp-qr">
              <img v-if="totpQrCode" :src="totpQrCode" alt="TOTP QR Code" class="qr-img" >
            </div>

            <div class="totp-manual">
              <span class="setting-desc">Or enter this key manually:</span>
              <code class="totp-key">{{ totpSecretKey }}</code>
            </div>

            <div class="form-fields">
              <input
                v-model="totpCode"
                type="text"
                class="setting-input"
                placeholder="Enter 6-digit code"
                maxlength="6"
                inputmode="numeric"
                autocomplete="one-time-code"
                @keydown.enter="verifyTotp"
              >

              <div v-if="totpError" class="inline-error">
                <span class="i-lucide-alert-circle" />
                {{ totpError }}
              </div>

              <div class="form-actions">
                <button class="cancel-btn" @click="closeTotpFlow">Cancel</button>
                <button
                  class="save-btn"
                  :disabled="totpLoading || totpCode.length !== 6"
                  @click="verifyTotp"
                >
                  {{ totpLoading ? 'Verifying...' : 'Verify & Enable' }}
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Backup codes -->
        <template v-else-if="totpStep === 'backup'">
          <div class="totp-setup">
            <div class="setting-info">
              <span class="setting-title" style="color: #22C55E;">2FA Enabled</span>
              <span class="setting-desc">Save these backup codes in a safe place. Each code can only be used once.</span>
            </div>

            <div class="backup-grid">
              <code v-for="code in backupCodes" :key="code" class="backup-code">{{ code }}</code>
            </div>

            <div class="form-actions">
              <button class="save-btn" @click="closeTotpFlow">Done</button>
            </div>
          </div>
        </template>

        <!-- Disable 2FA -->
        <template v-else-if="totpStep === 'disable'">
          <div class="totp-setup">
            <div class="setting-info">
              <span class="setting-title delete-title">Disable 2FA</span>
              <span class="setting-desc">Enter your password to disable two-factor authentication</span>
            </div>

            <div class="form-fields">
              <input
                v-model="disablePassword"
                type="password"
                class="setting-input"
                placeholder="Enter your password"
                autocomplete="current-password"
                @keydown.enter="disableTotp"
              >

              <div v-if="totpError" class="inline-error">
                <span class="i-lucide-alert-circle" />
                {{ totpError }}
              </div>

              <div class="form-actions">
                <button class="cancel-btn" @click="closeTotpFlow">Cancel</button>
                <button
                  class="delete-confirm-btn"
                  :disabled="totpLoading || !disablePassword"
                  @click="disableTotp"
                >
                  {{ totpLoading ? 'Disabling...' : 'Disable 2FA' }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- DANGER ZONE Section -->
    <div class="settings-section">
      <span class="section-label danger">Danger Zone</span>

      <!-- Export All Data -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">Export All Data</span>
          <span class="setting-desc">Download all your maps and account data as JSON</span>
        </div>
        <button
          class="action-btn"
          :disabled="isExporting"
          @click="exportAllData"
        >
          {{ isExporting ? 'Exporting...' : 'Export' }}
        </button>
      </div>

      <div v-if="exportError" class="inline-error" style="padding: 0 20px 12px;">
        <span class="i-lucide-alert-circle" />
        {{ exportError }}
      </div>

      <!-- Delete Account -->
      <div class="setting-row danger-row" :class="{ expanded: showDeleteConfirm }">
        <template v-if="!showDeleteConfirm">
          <div class="setting-info">
            <span class="setting-title">Delete Account</span>
            <span class="setting-desc">Permanently delete your account and all data. This cannot be undone.</span>
          </div>
          <button class="delete-btn" @click="showDeleteConfirm = true">
            Delete
          </button>
        </template>

        <template v-else>
          <div class="delete-form">
            <div class="setting-info">
              <span class="setting-title delete-title">Delete Account</span>
              <span class="setting-desc">Type <strong>DELETE MY ACCOUNT</strong> to confirm</span>
            </div>

            <div class="form-fields">
              <input
                v-model="deleteConfirmText"
                type="text"
                class="setting-input delete-input"
                placeholder="DELETE MY ACCOUNT"
                autocomplete="off"
                spellcheck="false"
              >

              <div v-if="deleteError" class="inline-error">
                <span class="i-lucide-alert-circle" />
                {{ deleteError }}
              </div>

              <div class="form-actions">
                <button
                  class="cancel-btn"
                  @click="showDeleteConfirm = false; deleteConfirmText = ''; deleteError = null"
                >
                  Cancel
                </button>
                <button
                  class="delete-confirm-btn"
                  :disabled="isDeleting || deleteConfirmText !== 'DELETE MY ACCOUNT'"
                  @click="deleteAccount"
                >
                  {{ isDeleting ? 'Deleting...' : 'Delete Forever' }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Sign Out (not in Paper but essential) -->
    <div class="settings-section">
      <button
        class="signout-btn"
        :disabled="signOutLoading"
        @click="onSignOut"
      >
        {{ signOutLoading ? 'Signing out...' : 'Sign Out' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 16px;
  color: var(--s-accent, #00D2BE);
  padding-bottom: 4px;
}

.section-label.danger {
  color: #EF4444;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--s-surface, #0D0D10);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 8px;
}

.setting-row.expanded {
  flex-direction: column;
  align-items: stretch;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  color: var(--s-text, #FAFAFA);
}

.setting-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  color: var(--s-muted, #555560);
}

.setting-value {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--s-muted, #555560);
}

/* Action button (Change, Export) */
.action-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--s-text, #FAFAFA);
  background: none;
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--s-accent, #00D2BE);
  color: var(--s-accent, #00D2BE);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Delete button */
.delete-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #EF4444;
  background: none;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: #EF4444;
}

.danger-row {
  border-color: rgba(239, 68, 68, 0.15);
}

/* Toggle Switch */
.toggle-switch {
  width: 44px;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 12px;
  border: none;
  background: var(--s-toggle-off, #1A1A1E);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}

.toggle-switch:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toggle-knob {
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--s-knob-off, #555560);
  flex-shrink: 0;
}

/* Password / Delete forms */
.password-form,
.delete-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-input {
  width: 100%;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--s-text, #FAFAFA);
  background: var(--s-bg, #09090B);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 10px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.setting-input:focus {
  border-color: var(--s-accent, #00D2BE);
}

.setting-input::placeholder {
  color: var(--s-muted, #555560);
}

.delete-input:focus {
  border-color: #EF4444;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.cancel-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--s-muted, #555560);
  background: none;
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.cancel-btn:hover {
  color: var(--s-text, #FAFAFA);
}

.save-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #09090B;
  background: var(--s-accent, #00D2BE);
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-confirm-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #FAFAFA;
  background: #EF4444;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.delete-confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.delete-title {
  color: #EF4444;
}

/* Inline feedback */
.inline-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: #EF4444;
}

.inline-success {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: #22C55E;
}

/* Sign Out */
.signout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #EF4444;
  cursor: pointer;
  transition: background 0.15s;
}

.signout-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.06);
}

.signout-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 2FA / TOTP styles */
.totp-setup {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.totp-qr {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: var(--s-bg, #09090B);
  border-radius: 8px;
}

.qr-img {
  width: 200px;
  height: 200px;
  image-rendering: pixelated;
}

.totp-manual {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.totp-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--s-accent, #00D2BE);
  background: var(--s-bg, #09090B);
  padding: 8px 12px;
  border-radius: 6px;
  word-break: break-all;
  user-select: all;
}

.backup-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.backup-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--s-text, #FAFAFA);
  background: var(--s-bg, #09090B);
  padding: 8px 12px;
  border-radius: 6px;
  text-align: center;
  user-select: all;
}

/* Light theme */
:root.light .setting-input {
  background: #FFFFFF;
  border-color: #E8E8E6;
  color: #111111;
}

:root.light .setting-input::placeholder {
  color: #777777;
}
</style>
