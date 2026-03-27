/**
 * Synchronous theme application plugin.
 * Runs before any component mounts to prevent flash of wrong theme.
 * Reads from localStorage cache (written by userStore on every theme change).
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const cached = localStorage.getItem('nc-theme-cache')
  const root = document.documentElement

  if (cached === 'light') {
    root.classList.add('light')
    root.classList.remove('dark')
  } else if (cached === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('light', !prefersDark)
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.add('dark')
    root.classList.remove('light')
  }
})
