// Reduced motion composable — respects prefers-reduced-motion
// Provides a global flag that disables animations across the app

export function useReducedMotion() {
  const isReduced = ref(false)

  if (typeof window !== 'undefined') {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    isReduced.value = mql.matches

    const handler = (e: MediaQueryListEvent) => {
      isReduced.value = e.matches
    }

    mql.addEventListener('change', handler)

    if (getCurrentInstance()) {
      onUnmounted(() => {
        mql.removeEventListener('change', handler)
      })
    }
  }

  return {
    isReduced: isReduced as Ref<boolean>
  }
}
