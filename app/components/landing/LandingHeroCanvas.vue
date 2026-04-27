<script setup lang="ts">
interface DemoNode {
  id: string
  label: string
  x: number
  y: number
  w: number
  variant: 'root' | 'idea' | 'ai'
}

interface DemoEdge {
  from: string
  to: string
  variant: 'solid' | 'ai'
}

const VIEW_W = 900
const VIEW_H = 520

const initialNodes: DemoNode[] = [
  { id: 'root', label: 'Onboarding rework', x: 110, y: 240, w: 178, variant: 'root' },
  { id: 'i1', label: 'Hero CTA framing', x: 360, y: 170, w: 152, variant: 'idea' },
  { id: 'i2', label: 'Save-your-work prompt', x: 250, y: 360, w: 192, variant: 'idea' },
  { id: 'a1', label: 'Progressive nudges', x: 580, y: 110, w: 162, variant: 'ai' },
  { id: 'a2', label: 'Visual template previews', x: 580, y: 360, w: 200, variant: 'ai' },
]

const edges: DemoEdge[] = [
  { from: 'root', to: 'i1', variant: 'solid' },
  { from: 'root', to: 'i2', variant: 'solid' },
  { from: 'i1', to: 'a1', variant: 'ai' },
  { from: 'i2', to: 'a2', variant: 'ai' },
]

const nodes = ref<DemoNode[]>(JSON.parse(JSON.stringify(initialNodes)))

const camera = reactive({ x: 0, y: 0, zoom: 1 })

const surfaceRef = ref<HTMLElement | null>(null)

// Drag state
type DragMode = 'none' | 'pan' | 'node'
const drag = reactive({
  mode: 'none' as DragMode,
  nodeId: null as string | null,
  startX: 0,
  startY: 0,
  origX: 0,
  origY: 0,
})

function nodeById(id: string): DemoNode | undefined {
  return nodes.value.find(n => n.id === id)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function onSurfacePointerDown(ev: PointerEvent) {
  const target = ev.target as HTMLElement
  // If clicking on a node, the node handler caught it via stopPropagation; here we pan
  if (target.closest('.lc-node')) return
  drag.mode = 'pan'
  drag.startX = ev.clientX
  drag.startY = ev.clientY
  drag.origX = camera.x
  drag.origY = camera.y
  surfaceRef.value?.setPointerCapture(ev.pointerId)
}

function onNodePointerDown(ev: PointerEvent, node: DemoNode) {
  if (node.variant === 'ai') return // AI nodes are decorative
  ev.stopPropagation()
  drag.mode = 'node'
  drag.nodeId = node.id
  drag.startX = ev.clientX
  drag.startY = ev.clientY
  drag.origX = node.x
  drag.origY = node.y
  ;(ev.currentTarget as HTMLElement)?.setPointerCapture(ev.pointerId)
}

function onPointerMove(ev: PointerEvent) {
  if (drag.mode === 'none') return
  const dx = (ev.clientX - drag.startX) / camera.zoom
  const dy = (ev.clientY - drag.startY) / camera.zoom
  if (drag.mode === 'pan') {
    camera.x = clamp(drag.origX + dx, -260, 260)
    camera.y = clamp(drag.origY + dy, -160, 160)
  }
  else if (drag.mode === 'node' && drag.nodeId) {
    const n = nodeById(drag.nodeId)
    if (n) {
      n.x = clamp(drag.origX + dx, 20, VIEW_W - n.w - 20)
      n.y = clamp(drag.origY + dy, 20, VIEW_H - 60)
    }
  }
}

function onPointerUp(ev: PointerEvent) {
  drag.mode = 'none'
  drag.nodeId = null
  surfaceRef.value?.releasePointerCapture?.(ev.pointerId)
}

function onWheel(ev: WheelEvent) {
  if (!ev.ctrlKey && !ev.metaKey && Math.abs(ev.deltaY) < 8) return
  ev.preventDefault()
  const delta = -ev.deltaY * 0.001
  const next = clamp(camera.zoom * (1 + delta), 0.7, 1.3)
  camera.zoom = next
}

function resetView() {
  camera.x = 0
  camera.y = 0
  camera.zoom = 1
  nodes.value = JSON.parse(JSON.stringify(initialNodes))
}

// Edge anchor calculation — where line meets the node border
function edgePath(from: DemoNode, to: DemoNode): string {
  const fcx = from.x + from.w / 2
  const fcy = from.y + 20
  const tcx = to.x + to.w / 2
  const tcy = to.y + 20
  return `M ${fcx} ${fcy} L ${tcx} ${tcy}`
}
</script>

<template>
  <div class="lc-frame">
    <!-- Window chrome -->
    <div class="lc-bar">
      <div class="lc-dots">
        <i class="lc-dot lc-dot--r" />
        <i class="lc-dot lc-dot--y" />
        <i class="lc-dot lc-dot--g" />
      </div>
      <div class="lc-title">guest_session.live</div>
      <div class="lc-meta">
        <span class="lc-pill">
          <span class="lc-pill-dot" />
          <span>live · pan · zoom · drag</span>
        </span>
        <button class="lc-reset" type="button" aria-label="Reset view" @click="resetView">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M2 2 V5 H5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M2.5 7 a4 4 0 1 0 1.5 -3.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Canvas surface -->
    <div
      ref="surfaceRef"
      class="lc-surface"
      :class="{ 'is-panning': drag.mode === 'pan' }"
      @pointerdown="onSurfacePointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.passive="onWheel"
    >
      <div class="lc-grid" />

      <div
        class="lc-stage"
        :style="{
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
        }"
      >
        <svg
          class="lc-edges"
          :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
          preserveAspectRatio="xMidYMid meet"
        >
          <g>
            <path
              v-for="(e, i) in edges"
              :key="i"
              :d="edgePath(nodeById(e.from)!, nodeById(e.to)!)"
              fill="none"
              :class="['lc-edge', `lc-edge--${e.variant}`]"
            />
          </g>
        </svg>

        <div
          v-for="n in nodes"
          :key="n.id"
          :class="['lc-node', `lc-node--${n.variant}`]"
          :style="{
            left: `${n.x}px`,
            top: `${n.y}px`,
            width: `${n.w}px`,
          }"
          @pointerdown="onNodePointerDown($event, n)"
        >
          <div v-if="n.variant === 'ai'" class="lc-node-eyebrow">
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
              <path d="M6 1 L7.5 4.5 L11 6 L7.5 7.5 L6 11 L4.5 7.5 L1 6 L4.5 4.5 Z" />
            </svg>
            <span>AI · SUGGESTED</span>
          </div>
          <div class="lc-node-label">{{ n.label }}</div>
        </div>
      </div>

      <!-- Toolbar chips -->
      <div class="lc-chip lc-chip--toolbar">
        <span class="lc-chip-dot" />
        <span>{{ nodes.length }} nodes</span>
      </div>

      <!-- Bottom prompt bar -->
      <div class="lc-prompt">
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M6 1 L7.5 4.5 L11 6 L7.5 7.5 L6 11 L4.5 7.5 L1 6 L4.5 4.5 Z" />
        </svg>
        <span class="lc-prompt-text">Generate from a sentence — "plan a launch for our pgvector release"</span>
        <span class="lc-prompt-kbd">
          <span>⌘</span><span>K</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lc-frame {
  width: 100%;
  max-width: 1280px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border, #1E1E22);
  background: var(--surface, #0C0C10);
  box-shadow: 0 32px 64px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}

:root.light .lc-frame {
  background: #FFFFFF;
  border-color: #DDD9CF;
  box-shadow: 0 32px 64px rgba(26, 26, 26, 0.08);
}

/* ── Window bar ── */
.lc-bar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 10px;
  background: var(--surface, #0C0C10);
  border-bottom: 1px solid var(--border, #1E1E22);
  flex-shrink: 0;
}

:root.light .lc-bar {
  background: #FAF8F4;
  border-bottom-color: #DDD9CF;
}

.lc-dots {
  display: flex;
  gap: 6px;
}

.lc-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.lc-dot--r { background: #FF5F57; }
.lc-dot--y { background: #FFBD2E; }
.lc-dot--g { background: #28C840; }

.lc-title {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-muted, #A1A1AA);
}

:root.light .lc-title {
  color: #5A5A5A;
}

.lc-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lc-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(0, 210, 190, 0.06);
  border: 1px solid rgba(0, 210, 190, 0.22);
  border-radius: 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--accent, #00D2BE);
  letter-spacing: 0.04em;
}

.lc-pill-dot {
  width: 5px;
  height: 5px;
  background: var(--accent, #00D2BE);
  border-radius: 50%;
  animation: lc-pulse 2.4s ease-in-out infinite;
}

@keyframes lc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.lc-reset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border, #1E1E22);
  background: transparent;
  border-radius: 6px;
  color: var(--text-muted, #A1A1AA);
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease;
}

.lc-reset:hover {
  border-color: var(--text-3, #71717A);
  color: var(--text, #FAFAFA);
}

:root.light .lc-reset {
  border-color: #DDD9CF;
  color: #8A8780;
}

:root.light .lc-reset:hover {
  border-color: #C8C4B8;
  color: #1A1A1A;
}

/* ── Surface ── */
.lc-surface {
  position: relative;
  flex: 1;
  height: 540px;
  overflow: hidden;
  cursor: grab;
  background: var(--bg, #09090B);
  user-select: none;
  touch-action: none;
}

:root.light .lc-surface {
  background: #FAF8F4;
}

.lc-surface.is-panning {
  cursor: grabbing;
}

.lc-grid {
  position: absolute;
  inset: -10%;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

:root.light .lc-grid {
  background-image: radial-gradient(circle, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
}

.lc-stage {
  position: absolute;
  inset: 0;
  transform-origin: 50% 50%;
  will-change: transform;
}

.lc-edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.lc-edge--solid {
  stroke: var(--border-hover, #3F3F46);
  stroke-width: 1.4;
}

:root.light .lc-edge--solid {
  stroke: #C8C4B8;
}

.lc-edge--ai {
  stroke: var(--accent, #00D2BE);
  stroke-width: 1.4;
  stroke-dasharray: 5 4;
  animation: lc-dash 16s linear infinite;
}

@keyframes lc-dash {
  to { stroke-dashoffset: -180; }
}

/* ── Nodes ── */
.lc-node {
  position: absolute;
  padding: 9px 14px;
  border-radius: 10px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #FAFAFA);
  cursor: grab;
  transition: border-color 150ms ease, transform 80ms ease, box-shadow 150ms ease;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lc-node:active {
  cursor: grabbing;
}

.lc-node--root {
  background: var(--surface-3, #1E1E22);
  border: 1px solid var(--border-hover, #3F3F46);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

:root.light .lc-node--root {
  background: #EDE9E0;
  border-color: #C8C4B8;
  color: #1A1A1A;
  box-shadow: 0 1px 3px rgba(26, 26, 26, 0.06);
}

.lc-node--idea {
  background: var(--surface-2, #121216);
  border: 1px solid var(--border, #1E1E22);
}

:root.light .lc-node--idea {
  background: #FFFFFF;
  border-color: #DDD9CF;
  color: #1A1A1A;
}

.lc-node--idea:hover {
  border-color: var(--border-hover, #3F3F46);
}

:root.light .lc-node--idea:hover {
  border-color: #C8C4B8;
}

.lc-node--ai {
  background: var(--surface, #0C0C10);
  border: 1px solid rgba(0, 210, 190, 0.4);
  box-shadow: 0 0 0 3px rgba(0, 210, 190, 0.06);
  cursor: default;
}

:root.light .lc-node--ai {
  background: #FFFFFF;
  border-color: rgba(0, 181, 164, 0.5);
  box-shadow: 0 0 0 3px rgba(0, 181, 164, 0.06);
  color: #1A1A1A;
}

.lc-node-eyebrow {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.06em;
  color: var(--accent, #00D2BE);
}

:root.light .lc-node-eyebrow {
  color: var(--accent-dark, #00B5A4);
}

.lc-node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Floating chips ── */
.lc-chip {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--surface-2, #121216);
  border: 1px solid var(--border, #1E1E22);
  border-radius: 7px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--text-muted, #A1A1AA);
  pointer-events: none;
}

:root.light .lc-chip {
  background: #FFFFFF;
  border-color: #DDD9CF;
  color: #5A5A5A;
}

.lc-chip--toolbar {
  top: 14px;
  right: 14px;
}

.lc-chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent, #00D2BE);
}

/* ── Prompt bar ── */
.lc-prompt {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: var(--surface, #0C0C10);
  border: 1px solid var(--border, #1E1E22);
  border-radius: 10px;
  color: var(--accent, #00D2BE);
  pointer-events: none;
}

:root.light .lc-prompt {
  background: #F4F2EC;
  border-color: #DDD9CF;
  color: var(--accent-dark, #00B5A4);
}

.lc-prompt-text {
  flex: 1;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--text-2, #888890);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:root.light .lc-prompt-text {
  color: #5A5A5A;
}

.lc-prompt-kbd {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 6px;
  background: var(--surface-3, #1E1E22);
  border: 1px solid var(--border, #1E1E22);
  border-radius: 5px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--text-muted, #A1A1AA);
}

:root.light .lc-prompt-kbd {
  background: #EDE9E0;
  border-color: #DDD9CF;
  color: #5A5A5A;
}

/* ── Mobile / responsive ── */
@media (max-width: 768px) {
  .lc-surface {
    height: 400px;
  }
  .lc-prompt-text {
    font-size: 12px;
  }
  .lc-pill span:nth-child(2) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lc-edge--ai,
  .lc-pill-dot {
    animation: none;
  }
}
</style>
