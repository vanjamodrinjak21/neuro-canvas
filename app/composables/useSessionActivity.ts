/**
 * Session Activity Composable
 * Tracks user activity and refreshes session periodically while active
 * Prevents session expiry during active use
 */

const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes
const ACTIVITY_THRESHOLD = 5 * 60 * 1000 // 5 minutes of inactivity before considered idle

export function useSessionActivity() {
  const { status, getSession } = useAuth()

  const lastActivity = ref(Date.now())
  const isActive = ref(true)
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  // Update last activity timestamp
  function recordActivity() {
    lastActivity.value = Date.now()
    isActive.value = true
  }

  // Check if user is still active
  function checkActivity(): boolean {
    const now = Date.now()
    const timeSinceActivity = now - lastActivity.value
    isActive.value = timeSinceActivity < ACTIVITY_THRESHOLD
    return isActive.value
  }

  // Refresh session if user is active
  async function refreshIfActive() {
    if (status.value !== 'authenticated') return

    if (checkActivity()) {
      try {
        // Refresh the session by getting it again
        await getSession({ force: true })
      } catch (error) {
        console.error('Failed to refresh session:', error)
      }
    }
  }

  // Start tracking activity
  function startTracking() {
    if (typeof window === 'undefined') return

    // Track user interactions
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

    // Throttle activity recording to avoid excessive updates
    let throttleTimeout: ReturnType<typeof setTimeout> | null = null
    const throttledRecordActivity = () => {
      if (throttleTimeout) return
      recordActivity()
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null
      }, 1000) // Record at most once per second
    }

    events.forEach(event => {
      window.addEventListener(event, throttledRecordActivity, { passive: true })
    })

    // Set up periodic session refresh
    refreshInterval = setInterval(refreshIfActive, REFRESH_INTERVAL)

    // Initial activity record
    recordActivity()

    // Cleanup function
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledRecordActivity)
      })
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout)
      }
    }
  }

  // Stop tracking activity
  function stopTracking() {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  return {
    lastActivity: readonly(lastActivity),
    isActive: readonly(isActive),
    recordActivity,
    checkActivity,
    refreshIfActive,
    startTracking,
    stopTracking
  }
}
