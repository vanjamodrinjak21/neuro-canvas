// ---------------------------------------------------------------------------
// Open-state for the global command palette (Cmd+K).
//
// A module-singleton ref so the always-mounted <CommandPalette> (in app.vue),
// the global Cmd+K listener, and any other trigger (sidebar ⌘K hint, a future
// toolbar button) all share one source of truth. The component owns all the
// search/render logic; this just exposes open/close/toggle.
// ---------------------------------------------------------------------------

const isOpen = ref(false)

export function useCommandPalette() {
  return {
    isOpen,
    open: () => { isOpen.value = true },
    close: () => { isOpen.value = false },
    toggle: () => { isOpen.value = !isOpen.value },
  }
}
