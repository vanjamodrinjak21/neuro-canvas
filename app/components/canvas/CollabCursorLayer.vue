<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { RemoteUser } from '~/composables/useCollabSession'

interface NodeBounds {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const props = defineProps<{
  remotes: RemoteUser[]
  camera: { x: number; y: number; zoom: number }
  nodes?: Map<string, NodeBounds>
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0

// Per-remote interpolation state. PartyKit awareness broadcasts at the
// peer's broadcast cadence (capped at ~30Hz upstream), but we render at
// the local 60-120Hz rAF rate. Lerping between the previous draw and
// the latest target produces fluid motion instead of stepped jumps.
interface CursorAnim {
  // Smoothed position currently being rendered.
  rx: number
  ry: number
  // Most recent target from awareness.
  tx: number
  ty: number
  // For idle-fade: timestamp of the last meaningful move.
  lastMoveAt: number
}
const anim = new Map<string, CursorAnim>()

const SMOOTH = 0.28          // lerp factor per frame; ~120ms catch-up
const IDLE_FADE_AFTER_MS = 3500   // start fading the name flag after this idle
const IDLE_FADE_DURATION_MS = 800  // fade-out duration

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function draw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const w = c.clientWidth, h = c.clientHeight
  ctx.clearRect(0, 0, w, h)

  const now = performance.now()
  const seen = new Set<string>()

  // Selection halos behind cursors so cursors stay legible.
  if (props.nodes) {
    for (const r of props.remotes) {
      if (!r.selection.length) continue
      ctx.strokeStyle = r.color
      ctx.lineWidth = 2
      for (const id of r.selection) {
        const n = props.nodes.get(id)
        if (!n) continue
        const x = (n.x - props.camera.x) * props.camera.zoom
        const y = (n.y - props.camera.y) * props.camera.zoom
        const ww = n.w * props.camera.zoom
        const hh = n.h * props.camera.zoom
        ctx.strokeRect(x - 1, y - 1, ww + 2, hh + 2)
      }
    }
  }

  // Cursors
  for (const r of props.remotes) {
    if (!r.cursor) {
      anim.delete(r.sessionId)
      continue
    }
    seen.add(r.sessionId)
    const tx = r.cursor.x
    const ty = r.cursor.y

    let a = anim.get(r.sessionId)
    if (!a) {
      // First sighting — snap to position so cursors don't fly in from origin.
      a = { rx: tx, ry: ty, tx, ty, lastMoveAt: now }
      anim.set(r.sessionId, a)
    } else {
      // Detect actual movement (>0.5px) to refresh the idle timer.
      if (Math.abs(tx - a.tx) > 0.5 || Math.abs(ty - a.ty) > 0.5) {
        a.lastMoveAt = now
      }
      a.tx = tx
      a.ty = ty
      a.rx = lerp(a.rx, tx, SMOOTH)
      a.ry = lerp(a.ry, ty, SMOOTH)
    }

    const x = (a.rx - props.camera.x) * props.camera.zoom
    const y = (a.ry - props.camera.y) * props.camera.zoom

    // Cursor body
    ctx.fillStyle = r.color
    ctx.strokeStyle = '#050508'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + 14)
    ctx.lineTo(x + 4.5, y + 11)
    ctx.lineTo(x + 7.5, y + 16)
    ctx.lineTo(x + 9.5, y + 15.2)
    ctx.lineTo(x + 7.5, y + 10.2)
    ctx.lineTo(x + 12, y + 10)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Name flag — fades out after the cursor sits still.
    const idleFor = now - a.lastMoveAt
    let alpha = 1
    if (idleFor > IDLE_FADE_AFTER_MS) {
      const t = Math.min(1, (idleFor - IDLE_FADE_AFTER_MS) / IDLE_FADE_DURATION_MS)
      alpha = 1 - t
    }
    if (alpha > 0.02) {
      ctx.globalAlpha = alpha
      ctx.font = '600 11px Inter, system-ui, sans-serif'
      const tw = ctx.measureText(r.displayName).width + 14
      ctx.fillStyle = r.color
      ctx.fillRect(x + 4, y + 18, tw, 16)
      ctx.fillStyle = '#050508'
      ctx.fillText(r.displayName, x + 11, y + 30)
      ctx.globalAlpha = 1
    }
  }

  // Garbage-collect anim entries for users who dropped from the awareness
  // map (left the room, lost connection, etc.).
  for (const id of anim.keys()) {
    if (!seen.has(id)) anim.delete(id)
  }

  raf = requestAnimationFrame(draw)
}

function resize() {
  const c = canvasRef.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  c.width = c.clientWidth * dpr
  c.height = c.clientHeight * dpr
  const ctx = c.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

onMounted(() => {
  resize()
  raf = requestAnimationFrame(draw)
  window.addEventListener('resize', resize)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  anim.clear()
})
watch(() => props.remotes.length, resize)
</script>

<template>
  <canvas ref="canvasRef" class="collab-cursor-layer" />
</template>

<style scoped>
.collab-cursor-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
  z-index: 50;
}
</style>
