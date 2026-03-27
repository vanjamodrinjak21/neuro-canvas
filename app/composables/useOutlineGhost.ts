import type { OutlineItem } from '~/composables/useOutlineSync'
import { useAI } from '~/composables/useAI'

/**
 * AI ghost text suggestions for the outline editor.
 *
 * Triggers after 800ms pause when cursor is at end of a line.
 * - Offline: uses the ai.worker expand message (pattern-based)
 * - Online: uses LLM-powered expansion
 */
export function useOutlineGhost() {
  const ai = useAI()

  const suggestions = ref<string[]>([])
  const isLoading = ref(false)
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Call when user types in an outline item.
   * Debounces 800ms, then fetches suggestions.
   */
  function onTyping(currentItem: OutlineItem, allItems: OutlineItem[]) {
    dismiss()

    if (!currentItem.content.trim()) return

    typingTimer = setTimeout(async () => {
      await fetchSuggestions(currentItem, allItems)
    }, 800)
  }

  async function fetchSuggestions(currentItem: OutlineItem, allItems: OutlineItem[]) {
    isLoading.value = true

    try {
      // Build context: sibling and parent content
      const context = allItems
        .filter(item => item.id !== currentItem.id)
        .map(item => item.content)
        .filter(Boolean)

      // Use the AI worker's expand functionality (always available, offline-safe)
      const result = await ai.sendMessage<{
        suggestions: string[]
        confidence: number
      }>('expand', {
        nodeContent: currentItem.content,
        context,
        maxSuggestions: 2,
      })

      if (result.suggestions.length > 0) {
        suggestions.value = result.suggestions
      }
    } catch {
      // AI worker not available — fail silently
      suggestions.value = []
    } finally {
      isLoading.value = false
    }
  }

  function dismiss() {
    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    suggestions.value = []
    isLoading.value = false
  }

  return {
    suggestions: readonly(suggestions),
    isLoading: readonly(isLoading),
    onTyping,
    dismiss,
  }
}
