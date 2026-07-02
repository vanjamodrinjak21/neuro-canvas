// Scroll-scrubbed image-sequence engine.
//
// Loads a frame manifest, resolves frame URLs from a %04d pattern, and
// decodes frames via fetch -> createImageBitmap with a *windowed* cache:
// only ±`radius` frames around the current index stay resident; bitmaps
// leaving the window are close()d to cap GPU/CPU memory. In-flight
// fetches are deduped and look-ahead is biased in the scroll direction.
//
// AVIF support is feature-detected with a tiny probe — when the browser
// can't decode AVIF the composable reports `unsupported` so the UI can
// fall back to the static poster.
import { getCurrentInstance, onBeforeUnmount, ref, shallowRef } from 'vue'

export interface FrameSequenceManifest {
  count: number
  width: number
  height: number
  pattern: string
  poster: string
  posterAvif: string
  mobileVideo: string
}

export type ScrollDirection = 1 | -1

// ─── Pure, unit-testable helpers ────────────────────────────────────

/** Clamp a progress value into [0, 1]. NaN clamps to 0. */
export function clamp01(progress: number): number {
  if (Number.isNaN(progress)) return 0
  return Math.min(1, Math.max(0, progress))
}

/**
 * Map progress (0..1) to a frame index (0..count-1).
 * Out-of-range progress clamps; count <= 1 always resolves to frame 0.
 */
export function frameIndexFor(progress: number, count: number): number {
  if (!Number.isFinite(count) || count <= 1) return 0
  return Math.round(clamp01(progress) * (count - 1))
}

/**
 * Ordered prefetch plan around `index`: the current frame first, then the
 * frames ahead (in scroll direction), then the frames behind. Indices are
 * bounded to [0, count) and deduped.
 */
export function prefetchWindow(
  index: number,
  count: number,
  radius: number,
  direction: ScrollDirection = 1,
): number[] {
  if (!Number.isFinite(count) || count <= 0) return []
  const center = Math.min(count - 1, Math.max(0, Math.round(index)))
  const span = Math.max(0, Math.floor(radius))
  const seen = new Set<number>()
  const plan: number[] = []
  const push = (i: number): void => {
    if (i < 0 || i >= count || seen.has(i)) return
    seen.add(i)
    plan.push(i)
  }
  push(center)
  for (let d = 1; d <= span; d++) push(center + d * direction)
  for (let d = 1; d <= span; d++) push(center - d * direction)
  return plan
}

/**
 * object-fit: cover source rectangle — which region of a srcW×srcH image
 * should be drawn to fill a dstW×dstH canvas without distortion.
 */
export function coverSourceRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { sx: number, sy: number, sw: number, sh: number } {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(0, srcW), sh: Math.max(0, srcH) }
  }
  const scale = Math.max(dstW / srcW, dstH / srcH)
  const sw = dstW / scale
  const sh = dstH / scale
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh }
}

/** Expand a printf-style %0Nd pattern (e.g. frame_%04d.avif) for 1-based frame numbers. */
export function frameUrlFor(pattern: string, index: number): string {
  return pattern.replace(/%0(\d+)d/, (_, width: string) =>
    String(index + 1).padStart(Number(width), '0'))
}

/**
 * Warmup plan: the first `n` frame indices, [0 .. min(n, count) - 1].
 * Degenerate counts and non-positive n produce an empty plan.
 */
export function warmupPlan(count: number, n: number): number[] {
  if (!Number.isFinite(count) || count <= 0) return []
  const length = Math.min(Math.max(0, Math.floor(n)), Math.floor(count))
  return Array.from({ length }, (_, i) => i)
}

// ─── AVIF decode probe ──────────────────────────────────────────────

// Minimal valid 1×1 AVIF (same probe payload used by avif.js / modernizr).
// Decoded from base64 straight into a Blob — deliberately NOT a data-URI
// fetch, which the app's CSP connect-src would block.
const AVIF_PROBE_B64
  = 'AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A='

let avifProbe: Promise<boolean> | null = null

/**
 * Feature-detect AVIF decoding through the same decoder the scrubber
 * uses (Blob -> createImageBitmap). Cached after the first call.
 */
export function probeAvifDecode(): Promise<boolean> {
  if (avifProbe) return avifProbe
  avifProbe = (async () => {
    try {
      if (typeof window === 'undefined') return false
      if (typeof createImageBitmap !== 'function') return false
      const binary = atob(AVIF_PROBE_B64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/avif' }))
      bitmap.close()
      return true
    } catch {
      return false
    }
  })()
  return avifProbe
}

/** Test hook — clears the cached probe result so mocks take effect. */
export function resetAvifProbeForTests(): void {
  avifProbe = null
}

// ─── Composable ─────────────────────────────────────────────────────

export interface UseFrameSequenceOptions {
  /** Manifest URL. Defaults to the landing sequence manifest. */
  manifestUrl?: string
  /** Cache window half-width — keep ±radius frames resident. */
  radius?: number
}

export function useFrameSequence(options: UseFrameSequenceOptions = {}) {
  const manifestUrl = options.manifestUrl ?? '/landing/seq/manifest.json'
  const radius = options.radius ?? 12

  const manifest = shallowRef<FrameSequenceManifest | null>(null)
  /** True once the first bitmap has been decoded and presented. */
  const ready = ref(false)
  /** True when AVIF can't be decoded (or the manifest failed) — poster fallback. */
  const unsupported = ref(false)
  /** Index of the currently presented frame (-1 before first decode). */
  const currentIndex = ref(-1)
  const currentBitmap = shallowRef<ImageBitmap | null>(null)

  const cache = new Map<number, ImageBitmap>()
  const inflight = new Map<number, Promise<ImageBitmap | null>>()
  const aborter = new AbortController()
  let direction: ScrollDirection = 1
  let lastRequested = 0
  let disposed = false

  function decodeFrame(index: number): Promise<ImageBitmap | null> {
    const cached = cache.get(index)
    if (cached) return Promise.resolve(cached)
    const pending = inflight.get(index)
    if (pending) return pending

    const m = manifest.value
    if (!m || disposed) return Promise.resolve(null)

    const task = (async (): Promise<ImageBitmap | null> => {
      try {
        const res = await fetch(frameUrlFor(m.pattern, index), { signal: aborter.signal })
        if (!res.ok) return null
        const blob = await res.blob()
        const bitmap = await createImageBitmap(blob)
        if (disposed) {
          bitmap.close()
          return null
        }
        cache.set(index, bitmap)
        return bitmap
      } catch {
        return null
      } finally {
        inflight.delete(index)
      }
    })()
    inflight.set(index, task)
    return task
  }

  function present(index: number, bitmap: ImageBitmap): void {
    currentIndex.value = index
    currentBitmap.value = bitmap
    if (!ready.value) ready.value = true
  }

  /** Close and drop every cached bitmap outside ±radius of `center`. */
  function evictOutside(center: number): void {
    for (const [key, bitmap] of cache) {
      if (Math.abs(key - center) <= radius) continue
      cache.delete(key)
      // Never close the bitmap currently on screen — it would blank the canvas.
      if (bitmap !== currentBitmap.value) bitmap.close()
    }
  }

  /**
   * Drive the sequence from scroll progress (0..1). Presents the resolved
   * frame when it is (or becomes) available, prefetches the surrounding
   * window biased in the scroll direction, and evicts frames that left it.
   */
  function setProgress(progress: number): void {
    const m = manifest.value
    if (!m || disposed || unsupported.value) return

    const index = frameIndexFor(progress, m.count)
    if (index > lastRequested) direction = 1
    else if (index < lastRequested) direction = -1
    lastRequested = index

    const hit = cache.get(index)
    if (hit) {
      if (index !== currentIndex.value) present(index, hit)
    } else {
      void decodeFrame(index).then((bitmap) => {
        // Only present if this frame is still the most recently requested one.
        if (bitmap && !disposed && lastRequested === index) present(index, bitmap)
      })
    }

    for (const i of prefetchWindow(index, m.count, radius, direction)) {
      if (!cache.has(i) && !inflight.has(i)) void decodeFrame(i)
    }
    evictOutside(index)
  }

  /**
   * Probe AVIF support and fetch the manifest. Resolves true when the
   * scrubber is usable; false flips `unsupported` for the poster fallback.
   */
  async function load(): Promise<boolean> {
    if (disposed) return false
    const avifOk = await probeAvifDecode()
    if (!avifOk) {
      unsupported.value = true
      return false
    }
    try {
      const res = await fetch(manifestUrl, { signal: aborter.signal })
      if (!res.ok) {
        unsupported.value = true
        return false
      }
      manifest.value = await res.json() as FrameSequenceManifest
      // Kick the first decode so the poster can hand off ASAP.
      setProgress(0)
      return true
    } catch {
      if (!disposed) unsupported.value = true
      return false
    }
  }

  /**
   * Decode the first `frames` frames into the cache without presenting
   * them (scrub start becomes instant). Deduped against the cache and
   * in-flight fetches; frames beyond the live window are evicted by the
   * next setProgress as usual. Resolves to the number of decoded frames.
   */
  async function warmup(frames: number): Promise<number> {
    const m = manifest.value
    if (!m || disposed || unsupported.value) return 0
    const results = await Promise.all(
      warmupPlan(m.count, frames).map(index => decodeFrame(index)),
    )
    return results.filter(bitmap => bitmap !== null).length
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    aborter.abort()
    for (const bitmap of cache.values()) bitmap.close()
    cache.clear()
    inflight.clear()
    currentBitmap.value = null
    currentIndex.value = -1
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(dispose)
  }

  return {
    manifest,
    ready,
    unsupported,
    currentIndex,
    currentBitmap,
    load,
    setProgress,
    warmup,
    dispose,
  }
}
