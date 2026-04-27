import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export interface CanvasColors {
  canvasBg: string
  nodeBg: string
  nodeBorder: string
  nodeTier2Bg: string
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

const darkColors: CanvasColors = {
  canvasBg: '#0A0A0C',
  nodeBg: '#111113',
  nodeBorder: '#27272A',
  nodeTier2Bg: '#0D0D0F',
  nodeText: '#FAFAFA',
  nodeSelected: '#00D2BE',
  nodeGlow: 'rgba(0, 210, 190, 0.08)',
  nodeHoverBorder: '#00D2BE',
  nodeAiGlow: 'rgba(0, 210, 190, 0.15)',
  nodeHighlightGlow: 'rgba(0, 210, 190, 0.1)',
  edgeDefault: '#3A3A42',
  edgeSelected: '#00D2BE',
  gridDot: '#3F3F46',
  gridLine: 'rgba(255, 255, 255, 0.02)',
  accent: '#00D2BE',
  boxSelectFill: 'rgba(0, 210, 190, 0.06)',
  boxSelectBorder: 'rgba(0, 210, 190, 0.4)',
  connectionPreview: '#00D2BE',
  anchorFill: '#0A0A0C',
  anchorBorder: '#00D2BE',
  rootIndicatorBg: '#00D2BE',
  rootIndicatorText: '#0A0A0C',
}

const lightColors: CanvasColors = {
  canvasBg: '#FAFAF9',
  nodeBg: '#FFFFFF',
  nodeBorder: '#E8E8E6',
  nodeTier2Bg: '#F5F5F3',
  nodeText: '#111111',
  nodeSelected: '#00D2BE',
  nodeGlow: 'rgba(0, 210, 190, 0.06)',
  nodeHoverBorder: '#00D2BE',
  nodeAiGlow: 'rgba(0, 210, 190, 0.10)',
  nodeHighlightGlow: 'rgba(0, 210, 190, 0.08)',
  edgeDefault: '#D4D4D8',
  edgeSelected: '#00D2BE',
  gridDot: '#A1A1AA',
  gridLine: 'rgba(0, 0, 0, 0.03)',
  accent: '#00D2BE',
  boxSelectFill: 'rgba(0, 210, 190, 0.06)',
  boxSelectBorder: 'rgba(0, 210, 190, 0.4)',
  connectionPreview: '#00D2BE',
  anchorFill: '#FAFAF9',
  anchorBorder: '#00D2BE',
  rootIndicatorBg: '#00D2BE',
  rootIndicatorText: '#FAFAF9',
}

export function useCanvasTheme() {
  const isLight = ref(false)

  function checkTheme() {
    if (typeof document !== 'undefined') {
      isLight.value = document.documentElement.classList.contains('light')
    }
  }

  const colors = computed<CanvasColors>(() => isLight.value ? lightColors : darkColors)

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
