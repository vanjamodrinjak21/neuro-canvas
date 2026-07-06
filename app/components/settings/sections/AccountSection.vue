<script setup lang="ts">
import { useAISettings } from '~/composables/useAISettings'
import { resolveDisplayEmail } from '~/utils/userDisplay'

const emit = defineEmits<{
  close: []
}>()

const { data: _sessionData } = useAuth()
const session = _sessionData ?? ref(null)
const { handleSignOut, isLoading: signOutLoading } = useAuthStore()
const aiSettings = useAISettings()
const { t } = useI18n()

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
    // Widened to `string` to skip nitro's typed-route matching, which blows
    // TypeScript's instantiation depth on this path (TS2321).
    const profileUrl: string = '/api/user/profile'
    userProfile.value = await $fetch<{ createdAt?: string; totpEnabled?: boolean }>(profileUrl)
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
      <span class="section-label">{{ t('settings.account.section_account') }}</span>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.account.email_label') }}</span>
          <span class="setting-desc">{{ t('settings.account.email_desc') }}</span>
        </div>
        <span class="setting-value">{{ user ? resolveDisplayEmail(user) : t('settings.account.not_set') }}</span>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.account.member_since_label') }}</span>
          <span class="setting-desc">{{ t('settings.account.member_since_desc') }}</span>
        </div>
        <span class="setting-value">{{ memberSince }}</span>
      </div>
    </div>

    <!-- SECURITY Section -->
    <div class="settings-section">
      <span class="section-label">{{ t('settings.account.section_security') }}</span>

      <!-- Change Password -->
      <div class="setting-row" :class="{ expanded: showPasswordForm }">
        <template v-if="!showPasswordForm">
          <div class="setting-info">
            <span class="setting-title">{{ t('settings.account.change_password') }}</span>
            <span class="setting-desc">{{ t('settings.account.change_password_desc') }}</span>
          </div>
          <button class="action-btn" @click="showPasswordForm = true">
            {{ t('settings.account.change_button') }}
          </button>
        </template>

        <template v-else>
          <div class="password-form">
            <div class="setting-info">
              <span class="setting-title">{{ t('settings.account.change_password') }}</span>
            </div>

            <div class="form-fields">
              <input
                v-model="currentPassword"
                type="password"
                class="setting-input"
                :placeholder="t('settings.account.current_password')"
                autocomplete="current-password"
              >
              <input
                v-model="newPassword"
                type="password"
                class="setting-input"
                :placeholder="t('settings.account.new_password')"
                autocomplete="new-password"
                minlength="8"
              >

              <div v-if="passwordError" class="inline-error">
                <span class="i-lucide-alert-circle" />
                {{ passwordError }}
              </div>

              <div v-if="passwordSuccess" class="inline-success">
                <span class="i-lucide-check-circle" />
                {{ t('settings.account.password_changed_success') }}
              </div>

              <div class="form-actions">
                <button
                  class="cancel-btn"
                  @click="showPasswordForm = false; passwordError = null"
                >
                  {{ t('common.buttons.cancel') }}
                </button>
                <button
                  class="save-btn"
                  :disabled="isChangingPassword || !currentPassword || !newPassword"
                  @click="changePassword"
                >
                  {{ isChangingPassword ? t('settings.account.saving') : t('settings.account.save') }}
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
            <span class="setting-title">{{ t('settings.account.two_factor_authentication') }}</span>
            <span class="setting-desc">
              {{ totpEnabled ? t('settings.account.two_factor_enabled_desc') : t('settings.account.two_factor_disabled_desc') }}
            </span>
          </div>
          <button
            v-if="!totpEnabled"
            class="action-btn"
            :disabled="totpLoading"
            @click="startTotpSetup"
          >
            {{ t('settings.account.enable') }}
          </button>
          <button
            v-else
            class="delete-btn"
            @click="totpStep = 'disable'"
          >
            {{ t('settings.account.disable') }}
          </button>
        </template>

        <!-- Setup: Show QR code -->
        <template v-else-if="totpStep === 'verify'">
          <div class="totp-setup">
            <div class="setting-info">
              <span class="setting-title">{{ t('settings.account.scan_qr_title') }}</span>
              <span class="setting-desc">{{ t('settings.account.scan_qr_desc') }}</span>
            </div>

            <div class="totp-qr">
              <img v-if="totpQrCode" :src="totpQrCode" alt="TOTP QR Code" class="qr-img" >
            </div>

            <div class="totp-manual">
              <span class="setting-desc">{{ t('settings.account.or_enter_manual') }}</span>
              <code class="totp-key">{{ totpSecretKey }}</code>
            </div>

            <div class="form-fields">
              <input
                v-model="totpCode"
                type="text"
                class="setting-input"
                :placeholder="t('settings.account.totp_code_placeholder')"
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
                <button class="cancel-btn" @click="closeTotpFlow">{{ t('common.buttons.cancel') }}</button>
                <button
                  class="save-btn"
                  :disabled="totpLoading || totpCode.length !== 6"
                  @click="verifyTotp"
                >
                  {{ totpLoading ? t('settings.account.verifying') : t('settings.account.verify_enable') }}
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Backup codes -->
        <template v-else-if="totpStep === 'backup'">
          <div class="totp-setup">
            <div class="setting-info">
              <span class="setting-title success-title">{{ t('settings.account.twofa_enabled_title') }}</span>
              <span class="setting-desc">{{ t('settings.account.backup_codes_desc') }}</span>
            </div>

            <div class="backup-grid">
              <code v-for="code in backupCodes" :key="code" class="backup-code">{{ code }}</code>
            </div>

            <div class="form-actions">
              <button class="save-btn" @click="closeTotpFlow">{{ t('settings.account.done') }}</button>
            </div>
          </div>
        </template>

        <!-- Disable 2FA -->
        <template v-else-if="totpStep === 'disable'">
          <div class="totp-setup">
            <div class="setting-info">
              <span class="setting-title delete-title">{{ t('settings.account.disable_2fa_title') }}</span>
              <span class="setting-desc">{{ t('settings.account.disable_2fa_desc') }}</span>
            </div>

            <div class="form-fields">
              <input
                v-model="disablePassword"
                type="password"
                class="setting-input"
                :placeholder="t('auth.signin.password_placeholder')"
                autocomplete="current-password"
                @keydown.enter="disableTotp"
              >

              <div v-if="totpError" class="inline-error">
                <span class="i-lucide-alert-circle" />
                {{ totpError }}
              </div>

              <div class="form-actions">
                <button class="cancel-btn" @click="closeTotpFlow">{{ t('common.buttons.cancel') }}</button>
                <button
                  class="delete-confirm-btn"
                  :disabled="totpLoading || !disablePassword"
                  @click="disableTotp"
                >
                  {{ totpLoading ? t('settings.account.disabling') : t('settings.account.disable_2fa_button') }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- DANGER ZONE Section -->
    <div class="settings-section">
      <span class="section-label danger">{{ t('settings.account.section_danger') }}</span>

      <!-- Export All Data -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.account.export_all_data') }}</span>
          <span class="setting-desc">{{ t('settings.account.export_all_data_desc') }}</span>
        </div>
        <button
          class="action-btn"
          :disabled="isExporting"
          @click="exportAllData"
        >
          {{ isExporting ? t('settings.account.exporting') : t('settings.account.export') }}
        </button>
      </div>

      <div v-if="exportError" class="inline-error inline-error--section">
        <span class="i-lucide-alert-circle" />
        {{ exportError }}
      </div>

      <!-- Delete Account -->
      <div class="setting-row danger-row" :class="{ expanded: showDeleteConfirm }">
        <template v-if="!showDeleteConfirm">
          <div class="setting-info">
            <span class="setting-title">{{ t('settings.account.delete_account') }}</span>
            <span class="setting-desc">{{ t('settings.account.delete_account_desc') }}</span>
          </div>
          <button class="delete-btn" @click="showDeleteConfirm = true">
            {{ t('settings.account.delete') }}
          </button>
        </template>

        <template v-else>
          <div class="delete-form">
            <div class="setting-info">
              <span class="setting-title delete-title">{{ t('settings.account.delete_account') }}</span>
              <span class="setting-desc">
                {{ t('settings.account.delete_confirm_desc_prefix') }}
                <strong>{{ t('settings.account.delete_confirmation_placeholder') }}</strong>
                {{ t('settings.account.delete_confirm_desc_suffix') }}
              </span>
            </div>

            <div class="form-fields">
              <input
                v-model="deleteConfirmText"
                type="text"
                class="setting-input delete-input"
                :placeholder="t('settings.account.delete_confirmation_placeholder')"
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

/* Section eyebrow — mono uppercase micro-label (REDESIGN.md §4) */
.section-label {
  font-family: var(--nc-font-mono);
  font-size: calc(0.68rem * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 14px;
  color: var(--nc-text-secondary);
  padding-bottom: 4px;
}

.section-label.danger {
  color: var(--nc-coral);
}

/* Setting Row — flat surface + THE hairline (REDESIGN.md §5) */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
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
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--nc-text);
}

.setting-desc {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 16px;
  color: var(--nc-text-secondary);
}

.setting-value {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--nc-text-secondary);
}

/* Action button (Change, Export) — ghost action grammar: mono uppercase
   chip, hover brightens to accent (REDESIGN.md §5) */
.action-btn {
  font-family: var(--nc-font-mono);
  font-size: calc(0.72rem * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-secondary);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  padding: 8px 16px;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.action-btn:active:not(:disabled) { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .action-btn:hover:not(:disabled) {
    border-color: var(--nc-border-active);
    color: var(--nc-accent);
  }
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Delete button — calm coral text + hairline, never solid red
   (REDESIGN.md §1 / ui/NcButton danger) */
.delete-btn {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-coral);
  background: none;
  border: 1px solid rgba(var(--nc-coral-rgb), 0.45);
  border-radius: var(--nc-radius-md);
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.delete-btn:active { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .delete-btn:hover {
    background: rgba(var(--nc-coral-rgb), 0.08);
    border-color: var(--nc-coral);
  }
}

.danger-row {
  border-color: rgba(var(--nc-coral-rgb), 0.15);
}

/* Toggle Switch — hairline track + chip fill (REDESIGN.md §5 / ui/NcSwitch) */
.toggle-switch {
  width: 44px;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 2.4rem;
  border: 1px solid var(--nc-border);
  background: var(--nc-chip-bg);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--nc-duration-normal) var(--nc-ease);
}

.toggle-switch:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.toggle-knob {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--nc-text);
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

/* Input grammar — chip fill, hairline, focus = border-color only
   (REDESIGN.md §5) */
.setting-input {
  width: 100%;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: var(--nc-radius-md);
  padding: 10px 12px;
  outline: none;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.setting-input:focus {
  border-color: var(--nc-accent);
}

.setting-input::placeholder {
  color: var(--nc-text-dim);
}

/* Destructive-confirm input focuses coral (REDESIGN.md §1) */
.delete-input:focus {
  border-color: var(--nc-coral);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Cancel — quiet ghost text action (REDESIGN.md §5) */
.cancel-btn {
  font-family: var(--nc-font-mono);
  font-size: calc(0.72rem * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-secondary);
  background: none;
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  padding: 8px 14px;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.cancel-btn:active { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .cancel-btn:hover {
    color: var(--nc-text);
    border-color: var(--nc-border-active);
  }
}

/* Save — primary ink pill (REDESIGN.md §5) */
.save-btn {
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-bg);
  background: var(--nc-text);
  border: none;
  border-radius: 2.4rem;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.save-btn:active:not(:disabled) { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .save-btn:hover:not(:disabled) {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

.save-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

/* Destructive confirm — calm coral fill + hairline, never solid red
   (REDESIGN.md §1) */
.delete-confirm-btn {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-coral);
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.45);
  border-radius: var(--nc-radius-md);
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.delete-confirm-btn:active:not(:disabled) { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .delete-confirm-btn:hover:not(:disabled) {
    background: rgba(var(--nc-coral-rgb), 0.14);
    border-color: var(--nc-coral);
  }
}

.delete-confirm-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.delete-title {
  color: var(--nc-coral);
}

/* Success carries accent — no status rainbow (REDESIGN.md §1) */
.success-title {
  color: var(--nc-accent);
}

/* Inline feedback — coral for errors, accent for success (REDESIGN.md §1) */
.inline-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-coral);
}

.inline-error--section {
  padding: 0 20px 12px;
}

.inline-success {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-accent);
}

/* Sign Out — coral danger grammar, kept calm (REDESIGN.md §1) */
.signout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border-radius: var(--nc-radius-md);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.45);
  background: none;
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-coral);
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.signout-btn:active:not(:disabled) { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .signout-btn:hover:not(:disabled) {
    background: rgba(var(--nc-coral-rgb), 0.08);
  }
}

.signout-btn:disabled {
  opacity: 0.45;
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
  /* QR is shipped as black-on-white for scanner compatibility, so the
     container stays a neutral light tile regardless of theme — a keyword,
     not a palette value. The hairline token keeps the edge visible on
     light surfaces and disappears against the white tile in dark mode. */
  background: white;
  border: 1px solid var(--nc-border-subtle);
  border-radius: var(--nc-radius-md);
}

.qr-img {
  width: 200px;
  height: 200px;
  image-rendering: pixelated;
  display: block;
}

.totp-manual {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Vault key chip — mono accent on chip fill (REDESIGN.md §5) */
.totp-key {
  font-family: var(--nc-font-mono);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-accent);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  padding: 8px 12px;
  border-radius: 0.4rem;
  word-break: break-all;
  user-select: all;
}

.backup-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.backup-code {
  font-family: var(--nc-font-mono);
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  padding: 8px 12px;
  border-radius: 0.4rem;
  text-align: center;
  user-select: all;
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */
</style>
