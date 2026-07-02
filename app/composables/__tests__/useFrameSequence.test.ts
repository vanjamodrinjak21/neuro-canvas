import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clamp01,
  coverSourceRect,
  frameIndexFor,
  frameUrlFor,
  prefetchWindow,
  probeAvifDecode,
  resetAvifProbeForTests,
  useFrameSequence,
} from '../useFrameSequence'

// ─── Pure helpers ────────────────────────────────────────────────────

describe('clamp01', () => {
  it('passes through in-range values', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1)).toBe(1)
  })

  it('clamps out-of-range values', () => {
    expect(clamp01(-0.25)).toBe(0)
    expect(clamp01(1.75)).toBe(1)
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1)
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0)
  })

  it('clamps NaN to 0', () => {
    expect(clamp01(Number.NaN)).toBe(0)
  })
})

describe('frameIndexFor', () => {
  it('maps progress 0 to the first frame', () => {
    expect(frameIndexFor(0, 145)).toBe(0)
  })

  it('maps progress 1 to the last frame', () => {
    expect(frameIndexFor(1, 145)).toBe(144)
  })

  it('rounds mid progress to the nearest frame', () => {
    expect(frameIndexFor(0.5, 145)).toBe(72)
    expect(frameIndexFor(0.5, 4)).toBe(2) // 0.5 * 3 = 1.5 → rounds to 2
  })

  it('clamps progress above 1 and below 0', () => {
    expect(frameIndexFor(1.5, 145)).toBe(144)
    expect(frameIndexFor(-3, 145)).toBe(0)
  })

  it('resolves to frame 0 when count is 1 or degenerate', () => {
    expect(frameIndexFor(0.9, 1)).toBe(0)
    expect(frameIndexFor(0.9, 0)).toBe(0)
    expect(frameIndexFor(0.9, -5)).toBe(0)
    expect(frameIndexFor(0.9, Number.NaN)).toBe(0)
  })
})

describe('prefetchWindow', () => {
  it('orders current first, then ahead, then behind (forward)', () => {
    expect(prefetchWindow(10, 145, 3, 1)).toEqual([10, 11, 12, 13, 9, 8, 7])
  })

  it('biases look-ahead in the backward direction', () => {
    expect(prefetchWindow(10, 145, 3, -1)).toEqual([10, 9, 8, 7, 11, 12, 13])
  })

  it('bounds indices at the start of the sequence', () => {
    expect(prefetchWindow(0, 145, 2, 1)).toEqual([0, 1, 2])
    expect(prefetchWindow(1, 145, 2, -1)).toEqual([1, 0, 2, 3])
  })

  it('bounds indices at the end of the sequence', () => {
    expect(prefetchWindow(144, 145, 2, 1)).toEqual([144, 143, 142])
  })

  it('dedupes when the window covers the whole sequence', () => {
    const plan = prefetchWindow(1, 3, 5, 1)
    expect(plan).toEqual([1, 2, 0])
    expect(new Set(plan).size).toBe(plan.length)
  })

  it('clamps an out-of-range center index', () => {
    expect(prefetchWindow(500, 10, 2, 1)).toEqual([9, 8, 7])
    expect(prefetchWindow(-4, 10, 2, 1)).toEqual([0, 1, 2])
  })

  it('returns empty for a degenerate count and handles radius 0', () => {
    expect(prefetchWindow(0, 0, 3, 1)).toEqual([])
    expect(prefetchWindow(5, 10, 0, 1)).toEqual([5])
  })
})

describe('coverSourceRect', () => {
  it('crops the width of a wide source on a tall destination', () => {
    const { sx, sy, sw, sh } = coverSourceRect(1920, 1080, 1080, 1080)
    expect(sw).toBeCloseTo(1080)
    expect(sh).toBeCloseTo(1080)
    expect(sx).toBeCloseTo(420)
    expect(sy).toBeCloseTo(0)
  })

  it('uses the full source when aspect ratios match', () => {
    const { sx, sy, sw, sh } = coverSourceRect(1920, 1080, 960, 540)
    expect({ sx, sy, sw, sh }).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 })
  })
})

describe('frameUrlFor', () => {
  it('expands the %04d pattern with 1-based numbering', () => {
    expect(frameUrlFor('/landing/seq/frame_%04d.avif', 0)).toBe('/landing/seq/frame_0001.avif')
    expect(frameUrlFor('/landing/seq/frame_%04d.avif', 144)).toBe('/landing/seq/frame_0145.avif')
  })
})

// ─── AVIF probe + composable fallback ───────────────────────────────

type FetchMock = ReturnType<typeof vi.fn>

function stubFetchAndBitmap(options: { avifDecodes: boolean }): { fetchMock: FetchMock, bitmapMock: FetchMock } {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('manifest.json')) {
      return new Response(JSON.stringify({
        count: 5,
        width: 1920,
        height: 1080,
        pattern: '/landing/seq/frame_%04d.avif',
        poster: '/landing/poster.jpg',
        posterAvif: '/landing/poster.avif',
        mobileVideo: '/landing/hero-mobile.mp4',
      }), { status: 200 })
    }
    return new Response(new Blob(['x']), { status: 200 })
  })
  const bitmapMock = vi.fn(async () => {
    if (!options.avifDecodes) throw new Error('decode failure')
    return { width: 1920, height: 1080, close: vi.fn() } as unknown as ImageBitmap
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('createImageBitmap', bitmapMock)
  return { fetchMock, bitmapMock }
}

describe('probeAvifDecode', () => {
  beforeEach(() => resetAvifProbeForTests())
  afterEach(() => {
    vi.unstubAllGlobals()
    resetAvifProbeForTests()
  })

  it('reports supported when the probe decodes', async () => {
    stubFetchAndBitmap({ avifDecodes: true })
    await expect(probeAvifDecode()).resolves.toBe(true)
  })

  it('reports unsupported when decoding throws', async () => {
    stubFetchAndBitmap({ avifDecodes: false })
    await expect(probeAvifDecode()).resolves.toBe(false)
  })

  it('reports unsupported when createImageBitmap is missing', async () => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('createImageBitmap', undefined)
    await expect(probeAvifDecode()).resolves.toBe(false)
  })
})

describe('useFrameSequence', () => {
  beforeEach(() => resetAvifProbeForTests())
  afterEach(() => {
    vi.unstubAllGlobals()
    resetAvifProbeForTests()
  })

  it('flags unsupported and skips the manifest when AVIF cannot decode', async () => {
    const { fetchMock } = stubFetchAndBitmap({ avifDecodes: false })
    const seq = useFrameSequence({ manifestUrl: '/landing/seq/manifest.json' })

    await expect(seq.load()).resolves.toBe(false)
    expect(seq.unsupported.value).toBe(true)
    expect(seq.ready.value).toBe(false)
    // Only the probe data URI was fetched — never the manifest or frames.
    const urls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(urls.some(u => u.endsWith('manifest.json'))).toBe(false)
  })

  it('loads the manifest and presents the first frame when supported', async () => {
    stubFetchAndBitmap({ avifDecodes: true })
    const seq = useFrameSequence({ manifestUrl: '/landing/seq/manifest.json', radius: 2 })

    await expect(seq.load()).resolves.toBe(true)
    // Allow the frame-0 decode kicked by load() to settle.
    await vi.waitFor(() => expect(seq.ready.value).toBe(true))
    expect(seq.currentIndex.value).toBe(0)
    expect(seq.currentBitmap.value).not.toBeNull()
  })

  it('dedupes in-flight frame fetches', async () => {
    const { fetchMock } = stubFetchAndBitmap({ avifDecodes: true })
    const seq = useFrameSequence({ manifestUrl: '/landing/seq/manifest.json', radius: 1 })
    await seq.load()
    // Hammer the same progress repeatedly before decodes settle.
    seq.setProgress(1)
    seq.setProgress(1)
    seq.setProgress(1)
    await vi.waitFor(() => expect(seq.currentIndex.value).toBe(4))

    const frameUrls = fetchMock.mock.calls
      .map(call => String(call[0]))
      .filter(u => u.includes('/frame_'))
    expect(new Set(frameUrls).size).toBe(frameUrls.length)
  })

  it('stops presenting after dispose', async () => {
    stubFetchAndBitmap({ avifDecodes: true })
    const seq = useFrameSequence({ manifestUrl: '/landing/seq/manifest.json' })
    await seq.load()
    await vi.waitFor(() => expect(seq.ready.value).toBe(true))
    seq.dispose()
    expect(seq.currentBitmap.value).toBeNull()
    seq.setProgress(1)
    expect(seq.currentIndex.value).toBe(-1)
  })
})
