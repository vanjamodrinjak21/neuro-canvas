// Ring buffer velocity tracker — computes release velocity from recent position samples

interface VelocitySample {
  x: number
  y: number
  time: number
}

export function useVelocityTracker(maxAge: number = 100, bufferSize: number = 5) {
  const samples: VelocitySample[] = []

  function addSample(x: number, y: number) {
    const now = performance.now()
    samples.push({ x, y, time: now })
    // Keep only last bufferSize samples
    if (samples.length > bufferSize) {
      samples.shift()
    }
  }

  function getVelocity(): { vx: number; vy: number } {
    const now = performance.now()
    // Filter to samples within maxAge ms
    const recent = samples.filter(s => now - s.time <= maxAge)

    if (recent.length < 2) {
      return { vx: 0, vy: 0 }
    }

    const oldest = recent[0]!
    const newest = recent[recent.length - 1]!
    const dt = (newest.time - oldest.time) / 1000 // seconds

    if (dt < 0.001) {
      return { vx: 0, vy: 0 }
    }

    return {
      vx: (newest.x - oldest.x) / dt,
      vy: (newest.y - oldest.y) / dt
    }
  }

  function reset() {
    samples.length = 0
  }

  return {
    addSample,
    getVelocity,
    reset
  }
}
