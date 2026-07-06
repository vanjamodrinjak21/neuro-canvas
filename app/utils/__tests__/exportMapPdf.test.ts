import { describe, it, expect } from 'vitest'
import { traceRoundRect, snapFontWeights, type PathSink } from '../exportMapPdf'

// ---------------------------------------------------------------------------
// traceRoundRect — the shim's replacement for ctx.roundRect (canvas2svg has
// none). Correctness here directly shapes every node card in the vector PDF.
// ---------------------------------------------------------------------------

type SinkCall =
  | ['moveTo' | 'lineTo', number, number]
  | ['arc', number, number, number, number, number]
  | ['closePath']

function recordingSink(): { sink: PathSink; calls: SinkCall[] } {
  const calls: SinkCall[] = []
  const sink: PathSink = {
    moveTo: (x, y) => { calls.push(['moveTo', x, y]) },
    lineTo: (x, y) => { calls.push(['lineTo', x, y]) },
    arc: (x, y, r, a0, a1) => { calls.push(['arc', x, y, r, a0, a1]) },
    closePath: () => { calls.push(['closePath']) },
  }
  return { sink, calls }
}

describe('traceRoundRect', () => {
  it('uniform radius: four corner arcs with correct centers and radius', () => {
    const { sink, calls } = recordingSink()
    traceRoundRect(sink, 10, 20, 200, 100, 10)

    const arcs = calls.filter((c): c is Extract<SinkCall, ['arc', ...number[]]> => c[0] === 'arc')
    expect(arcs).toHaveLength(4)
    // Corner centers are inset by the radius on both axes.
    expect(arcs.map((a) => [a[1], a[2], a[3]])).toEqual([
      [200, 30, 10],  // top-right    (10+200-10, 20+10)
      [200, 110, 10], // bottom-right (…, 20+100-10)
      [20, 110, 10],  // bottom-left
      [20, 30, 10],   // top-left
    ])
    expect(calls[0]).toEqual(['moveTo', 20, 20]) // starts after the TL corner
    expect(calls.at(-1)).toEqual(['closePath'])
  })

  it('zero radius: plain rectangle — no arcs at all', () => {
    const { sink, calls } = recordingSink()
    traceRoundRect(sink, 0, 0, 50, 30, 0)
    expect(calls.some((c) => c[0] === 'arc')).toBe(false)
    expect(calls[0]).toEqual(['moveTo', 0, 0])
    expect(calls.at(-1)).toEqual(['closePath'])
  })

  it('undefined radii behave like zero', () => {
    const { sink, calls } = recordingSink()
    traceRoundRect(sink, 0, 0, 50, 30)
    expect(calls.some((c) => c[0] === 'arc')).toBe(false)
  })

  it('pill shape: oversized radius is clamped so adjacent corners never overlap', () => {
    const { sink, calls } = recordingSink()
    // The "pill" shape passes r = min(h/2, w/2); make radius exceed the
    // height budget instead: r=40 on a 100×60 rect → tl+bl = 80 > 60 → ×0.75.
    traceRoundRect(sink, 0, 0, 100, 60, 40)
    const arcs = calls.filter((c) => c[0] === 'arc')
    expect(arcs).toHaveLength(4)
    for (const a of arcs) expect(a[3]).toBeCloseTo(30, 10) // 40 × (60/80)
  })

  it('negative radii are clamped to zero instead of corrupting the path', () => {
    const { sink, calls } = recordingSink()
    traceRoundRect(sink, 0, 0, 100, 60, -5)
    expect(calls.some((c) => c[0] === 'arc')).toBe(false)
  })

  it('per-corner radii array [tl, tr, br, bl]', () => {
    const { sink, calls } = recordingSink()
    traceRoundRect(sink, 0, 0, 100, 100, [10, 0, 20, 0])
    const arcs = calls.filter((c): c is Extract<SinkCall, ['arc', ...number[]]> => c[0] === 'arc')
    expect(arcs).toHaveLength(2)
    expect(arcs[0]?.[3]).toBe(20) // bottom-right
    expect(arcs[1]?.[3]).toBe(10) // top-left
  })

  it('two-value radii array maps to [tl+br, tr+bl] per the spec', () => {
    const { sink, calls } = recordingSink()
    traceRoundRect(sink, 0, 0, 100, 100, [8, 16])
    const arcs = calls.filter((c): c is Extract<SinkCall, ['arc', ...number[]]> => c[0] === 'arc')
    expect(arcs.map((a) => a[3])).toEqual([16, 8, 16, 8]) // tr, br, bl, tl order
  })
})

// ---------------------------------------------------------------------------
// snapFontWeights — only four Inter faces are embedded in the PDF; unmatched
// weights would silently fall back to Times.
// ---------------------------------------------------------------------------

describe('snapFontWeights', () => {
  it('leaves embedded weights untouched', () => {
    expect(snapFontWeights('500 15px "Inter", system-ui, sans-serif'))
      .toBe('500 15px "Inter", system-ui, sans-serif')
    expect(snapFontWeights('700 12px "Inter"')).toBe('700 12px "Inter"')
  })

  it('snaps unembedded weights to the nearest face', () => {
    expect(snapFontWeights('300 14px "Inter"')).toBe('400 14px "Inter"')
    expect(snapFontWeights('800 14px "Inter"')).toBe('700 14px "Inter"')
    expect(snapFontWeights('900 14px "Inter"')).toBe('700 14px "Inter"')
    expect(snapFontWeights('100 14px "Inter"')).toBe('400 14px "Inter"')
  })

  it('never mistakes a font size for a weight', () => {
    expect(snapFontWeights('900px "Inter"')).toBe('900px "Inter"')
    expect(snapFontWeights('500 900px "Inter"')).toBe('500 900px "Inter"')
  })

  it('keeps keyword weights and weightless fonts as-is', () => {
    expect(snapFontWeights('bold 14px "Inter"')).toBe('bold 14px "Inter"')
    expect(snapFontWeights('10px sans-serif')).toBe('10px sans-serif')
  })
})
