/**
 * Virtual Keyboard Avoidance
 *
 * Tracks the native keyboard height on Capacitor so bottom sheets
 * and input-heavy views can adjust their layout to stay visible.
 */
import { ref, readonly, onMounted, onUnmounted } from 'vue'

export function useKeyboardAvoidance() {
  const keyboardHeight = ref(0)
  const isKeyboardOpen = ref(false)

  let showListener: { remove: () => Promise<void> } | null = null
  let hideListener: { remove: () => Promise<void> } | null = null

  async function setup() {
    if (typeof window === 'undefined') return
    if (!('Capacitor' in window) || !(window as Record<string, unknown>).Capacitor) return

    try {
      const { Keyboard } = await import('@capacitor/keyboard')

      showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
        keyboardHeight.value = info.keyboardHeight
        isKeyboardOpen.value = true
      })

      hideListener = await Keyboard.addListener('keyboardDidHide', () => {
        keyboardHeight.value = 0
        isKeyboardOpen.value = false
      })
    } catch {
      // Not on a native platform — keyboard events not available
    }
  }

  async function cleanup() {
    await showListener?.remove()
    await hideListener?.remove()
    showListener = null
    hideListener = null
  }

  onMounted(setup)
  onUnmounted(cleanup)

  return {
    keyboardHeight: readonly(keyboardHeight),
    isKeyboardOpen: readonly(isKeyboardOpen)
  }
}
