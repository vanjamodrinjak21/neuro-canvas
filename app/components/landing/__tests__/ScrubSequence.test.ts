import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ScrubSequence from '../ScrubSequence.vue'
import { resetAvifProbeForTests } from '~/composables/useFrameSequence'

function stubEnvironment(options: { avifDecodes: boolean }): void {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('manifest.json')) {
      return new Response(JSON.stringify({
        count: 3,
        width: 1920,
        height: 1080,
        pattern: '/landing/seq/frame_%04d.avif',
        poster: '/landing/poster.jpg',
        posterAvif: '/landing/poster.avif',
        mobileVideo: '/landing/hero-mobile.mp4',
      }), { status: 200 })
    }
    return new Response(new Blob(['x']), { status: 200 })
  }))

  vi.stubGlobal('createImageBitmap', vi.fn(async () => {
    if (!options.avifDecodes) throw new Error('no avif decode')
    return { width: 1920, height: 1080, close: vi.fn() } as unknown as ImageBitmap
  }))

  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  })

  // happy-dom has no 2D canvas — return a minimal context so draw() succeeds.
  const context = {
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
}

describe('ScrubSequence', () => {
  beforeEach(() => resetAvifProbeForTests())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetAvifProbeForTests()
  })

  it('shows the eager high-priority poster before any frame is ready', () => {
    stubEnvironment({ avifDecodes: true })
    const wrapper = mount(ScrubSequence, { props: { progress: 0 } })

    const picture = wrapper.find('picture')
    expect(picture.exists()).toBe(true)
    expect(picture.classes()).not.toContain('is-hidden')

    const img = wrapper.find('img')
    expect(img.attributes('loading')).toBe('eager')
    expect(img.attributes('fetchpriority')).toBe('high')
    expect(img.attributes('src')).toBe('/landing/poster.jpg')
    expect(wrapper.find('source').attributes('type')).toBe('image/avif')

    wrapper.unmount()
  })

  it('hides the poster and emits ready once the first frame is drawn', async () => {
    stubEnvironment({ avifDecodes: true })
    const wrapper = mount(ScrubSequence, { props: { progress: 0 } })

    await vi.waitFor(() => {
      expect(wrapper.emitted('ready')).toBeTruthy()
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('picture').classes()).toContain('is-hidden')

    wrapper.unmount()
  })

  it('keeps the poster and emits unsupported when AVIF cannot decode', async () => {
    stubEnvironment({ avifDecodes: false })
    const wrapper = mount(ScrubSequence, { props: { progress: 0 } })

    await vi.waitFor(() => {
      expect(wrapper.emitted('unsupported')).toBeTruthy()
    })
    expect(wrapper.emitted('ready')).toBeFalsy()
    expect(wrapper.find('picture').classes()).not.toContain('is-hidden')

    wrapper.unmount()
  })
})
