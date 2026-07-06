import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * Reactive read of the global font-size preference, expressed as a
 * multiplier (xs=0.85 .. xl=1.25). Mirrors the `--nc-text-scale` CSS
 * variable that lives on `:root` and gets updated by userStore when
 * the user changes Settings → General → Font Size.
 *
 * Canvas renderers can't read CSS variables directly — they render to
 * a 2D context and need a plain number to multiply against `style.fontSize`.
 * This composable observes `data-font-size` on `<html>` and exposes the
 * matching scale as a Vue ref so any Canvas/SVG layer can react.
 */

const SCALE_BY_KEY: Record<string, number> = {
  xs: 0.85,
  small: 0.92,
  medium: 1,
  large: 1.12,
  xl: 1.25,
}

/**
 * One-shot, non-reactive read of the current text scale. Also exported for
 * consumers that render outside a component lifecycle (raster image export)
 * and need the same multiplier the live canvas is using right now.
 */
export function readCurrentTextScale(): number {
  if (typeof document === 'undefined') return 1
  const key = document.documentElement.dataset.fontSize
  if (!key) return 1
  return SCALE_BY_KEY[key] ?? 1
}

export function useTextScale() {
  const scale = ref(readCurrentTextScale())

  function sync() {
    scale.value = readCurrentTextScale()
  }

  if (typeof window !== 'undefined') {
    onMounted(() => {
      sync()
      // Watch for the userStore flipping data-font-size on <html>.
      const observer = new MutationObserver(sync)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-font-size'],
      })
      onBeforeUnmount(() => observer.disconnect())
    })
  }

  return { scale, sync }
}
