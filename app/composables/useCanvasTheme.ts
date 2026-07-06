import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export interface CanvasColors {
  canvasBg: string
  nodeBg: string
  nodeBorder: string
  nodeTier2Bg: string
  nodeTier1Border: string
  nodeTier2Border: string
  nodeText: string
  nodeSelected: string
  nodeGlow: string
  nodeHoverBorder: string
  nodeAiGlow: string
  nodeHighlightGlow: string
  edgeDefault: string
  edgeSelected: string
  gridDot: string
  gridLine: string
  accent: string
  boxSelectFill: string
  boxSelectBorder: string
  connectionPreview: string
  anchorFill: string
  anchorBorder: string
  rootIndicatorBg: string
  rootIndicatorText: string
}

/**
 * Canvas 2D contexts can't resolve `var(--nc-*)`, so palette values are read
 * from the live CSS custom properties at theme-change time and fall back to
 * the canonical token values from tokens.css (REDESIGN.md §1/§2). This keeps
 * tokens.css as the single source of truth while feeding the renderers the
 * same resolved strings they always received — no renderer API change.
 */
function readToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function accentAlpha(alpha: number, fallbackRgb: string): string {
  const rgb = readToken('--nc-accent-rgb', fallbackRgb)
  return `rgba(${rgb}, ${alpha})`
}

const DARK_ACCENT_RGB = '94, 242, 232'
const LIGHT_ACCENT_RGB = '11, 158, 147'

function buildDarkColors(): CanvasColors {
  const accent = readToken('--nc-accent', '#5EF2E8')
  return {
    canvasBg: readToken('--nc-canvas', '#050508'),
    nodeBg: readToken('--nc-surface-2', '#131318'),
    nodeBorder: readToken('--nc-border', 'rgba(244, 244, 248, 0.14)'),
    nodeTier2Bg: readToken('--nc-surface', '#0d0d11'),
    nodeTier1Border: accentAlpha(0.45, DARK_ACCENT_RGB),
    nodeTier2Border: readToken('--nc-border-subtle', 'rgba(244, 244, 248, 0.08)'),
    nodeText: readToken('--nc-text', '#f4f4f8'),
    nodeSelected: accent,
    nodeGlow: accentAlpha(0.08, DARK_ACCENT_RGB),
    nodeHoverBorder: accent,
    nodeAiGlow: accentAlpha(0.15, DARK_ACCENT_RGB),
    nodeHighlightGlow: accentAlpha(0.1, DARK_ACCENT_RGB),
    edgeDefault: '#3A3A42',
    edgeSelected: accent,
    gridDot: '#3F3F46',
    gridLine: 'rgba(255, 255, 255, 0.02)',
    accent,
    boxSelectFill: accentAlpha(0.06, DARK_ACCENT_RGB),
    boxSelectBorder: accentAlpha(0.4, DARK_ACCENT_RGB),
    connectionPreview: accent,
    anchorFill: readToken('--nc-canvas', '#050508'),
    anchorBorder: accent,
    rootIndicatorBg: accent,
    rootIndicatorText: readToken('--nc-bg', '#050508'),
  }
}

// Light-mode neutrals stay tuned for visibility against the warm-paper canvas
// (#FAFAF9) — only the accent family follows the token (light accent is the
// darker #0b9e93 per REDESIGN.md §2; #5EF2E8 is never used on paper).
function buildLightColors(): CanvasColors {
  const accent = readToken('--nc-accent', '#0b9e93')
  return {
    canvasBg: readToken('--nc-canvas', '#FAFAF9'),
    nodeBg: '#FFFFFF',
    nodeBorder: '#D4D4D0',
    nodeTier2Bg: '#FFFFFF',
    nodeTier1Border: accentAlpha(0.85, LIGHT_ACCENT_RGB),
    nodeTier2Border: 'rgba(0, 0, 0, 0.16)',
    nodeText: readToken('--nc-text', '#111111'),
    nodeSelected: accent,
    nodeGlow: accentAlpha(0.12, LIGHT_ACCENT_RGB),
    nodeHoverBorder: accent,
    nodeAiGlow: accentAlpha(0.18, LIGHT_ACCENT_RGB),
    nodeHighlightGlow: accentAlpha(0.14, LIGHT_ACCENT_RGB),
    edgeDefault: '#A1A1AA',
    edgeSelected: accent,
    gridDot: '#B8B8B3',
    gridLine: 'rgba(0, 0, 0, 0.04)',
    accent,
    boxSelectFill: accentAlpha(0.1, LIGHT_ACCENT_RGB),
    boxSelectBorder: accentAlpha(0.55, LIGHT_ACCENT_RGB),
    connectionPreview: accent,
    anchorFill: readToken('--nc-canvas', '#FAFAF9'),
    anchorBorder: accent,
    rootIndicatorBg: accent,
    // Ink on the light accent (5.69:1) — bg-colored text on #0b9e93 is
    // only 3.18:1 and fails AA for the root badge label.
    rootIndicatorText: readToken('--nc-accent-contrast', '#111111'),
  }
}

export function useCanvasTheme() {
  const isLight = ref(false)

  function checkTheme() {
    if (typeof document !== 'undefined') {
      isLight.value = document.documentElement.classList.contains('light')
    }
  }

  const colors = computed<CanvasColors>(() => isLight.value ? buildLightColors() : buildDarkColors())

  if (typeof window !== 'undefined') {
    onMounted(() => {
      checkTheme()
      const observer = new MutationObserver(checkTheme)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      onBeforeUnmount(() => observer.disconnect())
    })
  }

  return { isLight, colors, checkTheme }
}
