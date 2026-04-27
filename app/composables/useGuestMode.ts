const GUEST_KEY = 'nc:guest'
const GUEST_MAP_KEY = 'nc:guest:mapId'
const GUEST_ONBOARDING_KEY = 'nc:guest:onboarded'

export type GuestRestrictedFeature =
  | 'export'
  | 'share'
  | 'ai'
  | 'ai-settings'
  | 'new-map'
  | 'account-settings'
  | 'sync'

const FEATURE_LABELS: Record<GuestRestrictedFeature, { title: string; description: string }> = {
  'export': { title: 'Export Your Work', description: 'Export your maps as PNG, JSON, or Markdown.' },
  'share': { title: 'Share Your Maps', description: 'Share maps with collaborators via link.' },
  'ai': { title: 'AI-Powered Features', description: 'Use AI to expand ideas, suggest connections, and generate maps.' },
  'ai-settings': { title: 'Configure AI', description: 'Connect your own AI provider for smart features.' },
  'new-map': { title: 'Create Unlimited Maps', description: 'Create as many maps as you need.' },
  'account-settings': { title: 'Your Account', description: 'Manage your profile, providers, and preferences.' },
  'sync': { title: 'Cloud Sync', description: 'Sync your maps across devices.' },
}

const state = reactive({
  isGuest: false,
  guestMapId: null as string | null,
  onboardingComplete: false,
  upgradeFeature: null as GuestRestrictedFeature | null,
  showUpgradeModal: false,
})

if (import.meta.client) {
  state.isGuest = sessionStorage.getItem(GUEST_KEY) === 'true'
  state.guestMapId = sessionStorage.getItem(GUEST_MAP_KEY)
  state.onboardingComplete = sessionStorage.getItem(GUEST_ONBOARDING_KEY) === 'true'
}

export function useGuestMode() {
  function enterGuestMode() {
    state.isGuest = true
    sessionStorage.setItem(GUEST_KEY, 'true')
  }

  function exitGuestMode() {
    state.isGuest = false
    state.guestMapId = null
    state.onboardingComplete = false
    state.showUpgradeModal = false
    state.upgradeFeature = null
    sessionStorage.removeItem(GUEST_KEY)
    sessionStorage.removeItem(GUEST_MAP_KEY)
    sessionStorage.removeItem(GUEST_ONBOARDING_KEY)
  }

  function setGuestMapId(id: string) {
    state.guestMapId = id
    sessionStorage.setItem(GUEST_MAP_KEY, id)
  }

  function completeOnboarding() {
    state.onboardingComplete = true
    sessionStorage.setItem(GUEST_ONBOARDING_KEY, 'true')
  }

  function requireFeature(feature: GuestRestrictedFeature): boolean {
    if (!state.isGuest) return true
    state.upgradeFeature = feature
    state.showUpgradeModal = true
    return false
  }

  function dismissUpgradeModal() {
    state.showUpgradeModal = false
    state.upgradeFeature = null
  }

  const upgradeInfo = computed(() => {
    if (!state.upgradeFeature) return null
    return FEATURE_LABELS[state.upgradeFeature]
  })

  return {
    isGuest: computed(() => state.isGuest),
    guestMapId: computed(() => state.guestMapId),
    onboardingComplete: computed(() => state.onboardingComplete),
    showUpgradeModal: computed(() => state.showUpgradeModal),
    upgradeFeature: computed(() => state.upgradeFeature),
    upgradeInfo,
    enterGuestMode,
    exitGuestMode,
    setGuestMapId,
    completeOnboarding,
    requireFeature,
    dismissUpgradeModal,
  }
}
