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

function draw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = c.clientWidth, h = c.clientHeight
  ctx.clearRect(0, 0, w, h)

  // Selection halos behind cursors so cursors stay legible
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
    if (!r.cursor) continue
    const x = (r.cursor.x - props.camera.x) * props.camera.zoom
    const y = (r.cursor.y - props.camera.y) * props.camera.zoom

    ctx.fillStyle = r.color
    ctx.strokeStyle = '#09090B'
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

    // Name flag
    ctx.font = '600 11px Inter, system-ui, sans-serif'
    const tw = ctx.measureText(r.displayName).width + 14
    ctx.fillStyle = r.color
    ctx.fillRect(x + 4, y + 18, tw, 16)
    ctx.fillStyle = '#09090B'
    ctx.fillText(r.displayName, x + 11, y + 30)
  }

  // Account for HiDPI without redoing scale every frame
  void dpr

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
