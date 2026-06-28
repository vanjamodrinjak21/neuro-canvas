import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useCameraIntelligence } from '../useCameraIntelligence'
import type { Camera, Node } from '~/types/canvas'

function makeNode(id: string, x: number, y: number, w = 120, h = 40): Node {
  return {
    id, type: 'text', position: { x, y }, size: { width: w, height: h },
    content: id, style: {
      shape: 'rounded', fillColor: '#111', borderColor: '#222', borderWidth: 1,
      textColor: '#fff', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false,
    }, createdAt: 0, updatedAt: 0,
  } as Node
}

/** Build the composable with a fake spring camera that just records targets. */
function setup(viewport: { width: number; height: number }, nodes: Node[], zoom = 1) {
  const camera = ref<Camera>({ x: 0, y: 0, zoom })
  const setTarget = vi.fn((t: Partial<Camera>) => { camera.value = { ...camera.value, ...t } })
  const spring = { camera, setTarget, setCurrent: vi.fn(), stop: vi.fn() }
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const intel = useCameraIntelligence(
    spring,
    () => nodeMap,
    () => new Set<string>(),
    null,
    undefined,
    undefined,
    () => viewport,
  )
  return { intel, setTarget }
}

describe('useCameraIntelligence — viewport-aware framing', () => {
  // The bug: framing used window.innerWidth/Height, ignoring the left sidebar
  // and the right detail panel, so content landed off-centre with a dead gap.
  // The fix routes all framing through an injected *visible* viewport.

  it('flyToNode centres the node in the GIVEN viewport, not the window', () => {
    const node = makeNode('a', 100, 100)
    const { intel, setTarget } = setup({ width: 1000, height: 800 }, [node])
    intel.flyToNode('a')
    // x = -100*1 + 1000/2 - (120*1)/2 = 340 ; y = -100 + 400 - 20 = 280
    expect(setTarget).toHaveBeenCalledWith(
      expect.objectContaining({ x: 340, y: 280, zoom: 1 }),
      'snappy',
    )
  })

  it('flyToNode shifts left by half the panel width when the detail panel insets the viewport', () => {
    const node = makeNode('a', 100, 100)
    const full = setup({ width: 1000, height: 800 }, [node])
    full.intel.flyToNode('a')
    const inset = setup({ width: 640, height: 800 }, [node]) // 1000 - 360 panel
    inset.intel.flyToNode('a')
    const xFull = full.setTarget.mock.calls[0]![0].x as number
    const xInset = inset.setTarget.mock.calls[0]![0].x as number
    expect(xFull - xInset).toBe(180) // exactly DETAIL_PANEL_WIDTH / 2
  })

  it('fitToContent frames content into the given viewport (and recentres for the inset)', () => {
    const node = makeNode('a', 100, 100) // bbox 100,100..220,140
    const full = setup({ width: 1000, height: 800 }, [node])
    full.intel.fitToContent(80)
    // contentW=280, contentH=200 → zoom=min(3.57,4,2)=2 ; centreX=160 → x=500-320=180
    expect(full.setTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 180, y: 160, zoom: 2 }), 'navigation',
    )

    const inset = setup({ width: 640, height: 800 }, [node])
    inset.intel.fitToContent(80)
    // zoom still clamps to 2 → x=320-320=0 : shifted left by 180 vs full
    expect(inset.setTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 0, y: 160, zoom: 2 }), 'navigation',
    )
  })
})
