import type { Node, Edge } from '~/types/canvas'

export interface ForceNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  isRoot: boolean
  label: string
  pinned: boolean
}

interface ForceConfig {
  springK: number
  springRestLength: number
  repulsionK: number
  centerGravity: number
  damping: number
  settleThreshold: number
}

const DEFAULT_CONFIG: ForceConfig = {
  springK: 0.015,
  springRestLength: 180,
  repulsionK: 12000,
  centerGravity: 0.005,
  damping: 0.82,
  settleThreshold: 0.3,
}

export function useForceGraph(
  nodesGetter: () => Map<string, Node>,
  edgesGetter: () => Map<string, Edge>,
  rootNodeIdGetter: () => string | null,
) {
  const forceNodes = ref<Map<string, ForceNode>>(new Map())
  const isSimulating = ref(false)
  const isSettled = ref(false)
  let rafId: number | null = null

  function syncFromStore() {
    const nodes = nodesGetter()
    const rootId = rootNodeIdGetter()
    const existing = forceNodes.value
    const updated = new Map<string, ForceNode>()

    for (const [id, node] of nodes) {
      const prev = existing.get(id)
      if (prev) {
        // Keep existing position and velocity
        updated.set(id, { ...prev, label: node.content, isRoot: id === rootId })
      } else {
        // New node — place randomly near center
        const angle = Math.random() * Math.PI * 2
        const dist = 50 + Math.random() * 200
        updated.set(id, {
          id,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          vx: 0,
          vy: 0,
          isRoot: id === rootId,
          label: node.content,
          pinned: false,
        })
      }
    }

    forceNodes.value = updated
    isSettled.value = false
  }

  function tick() {
    const nodes = Array.from(forceNodes.value.values())
    const edges = edgesGetter()
    const config = DEFAULT_CONFIG
    const n = nodes.length
    if (n === 0) return

    // Reset forces
    for (const node of nodes) {
      if (node.pinned) continue
      node.vx *= config.damping
      node.vy *= config.damping
    }

    // Repulsion between all pairs (Barnes-Hut would be better for large graphs)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = 1 }

        const force = config.repulsionK / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        if (!a.pinned) { a.vx -= fx; a.vy -= fy }
        if (!b.pinned) { b.vx += fx; b.vy += fy }
      }
    }

    // Spring forces along edges
    for (const edge of edges.values()) {
      const a = forceNodes.value.get(edge.sourceId)
      const b = forceNodes.value.get(edge.targetId)
      if (!a || !b) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const displacement = dist - config.springRestLength
      const force = config.springK * displacement
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      if (!a.pinned) { a.vx += fx; a.vy += fy }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy }
    }

    // Center gravity
    for (const node of nodes) {
      if (node.pinned) continue
      node.vx -= node.x * config.centerGravity
      node.vy -= node.y * config.centerGravity
    }

    // Apply velocities and check settlement
    let maxVel = 0
    for (const node of nodes) {
      if (node.pinned) continue
      node.x += node.vx
      node.y += node.vy
      const vel = Math.abs(node.vx) + Math.abs(node.vy)
      if (vel > maxVel) maxVel = vel
    }

    if (maxVel < config.settleThreshold) {
      isSettled.value = true
    }
  }

  function startSimulation() {
    if (isSimulating.value) return
    isSimulating.value = true
    isSettled.value = false

    function loop() {
      tick()
      if (!isSettled.value && isSimulating.value) {
        rafId = requestAnimationFrame(loop)
      } else {
        isSimulating.value = false
      }
    }
    rafId = requestAnimationFrame(loop)
  }

  function stopSimulation() {
    isSimulating.value = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function restartSimulation() {
    stopSimulation()
    syncFromStore()
    startSimulation()
  }

  function pinNode(nodeId: string, x: number, y: number) {
    const node = forceNodes.value.get(nodeId)
    if (node) {
      node.pinned = true
      node.x = x
      node.y = y
      node.vx = 0
      node.vy = 0
      // Wake up simulation so other nodes adjust
      if (isSettled.value) {
        isSettled.value = false
        startSimulation()
      }
    }
  }

  function unpinNode(nodeId: string) {
    const node = forceNodes.value.get(nodeId)
    if (node) {
      node.pinned = false
      if (isSettled.value) {
        isSettled.value = false
        startSimulation()
      }
    }
  }

  function moveNode(nodeId: string, x: number, y: number) {
    const node = forceNodes.value.get(nodeId)
    if (node && node.pinned) {
      node.x = x
      node.y = y
    }
  }

  function findNodeAt(worldX: number, worldY: number, hitRadius = 16): string | null {
    for (const node of forceNodes.value.values()) {
      const dx = worldX - node.x
      const dy = worldY - node.y
      const r = node.isRoot ? 12 : 6
      if (dx * dx + dy * dy <= (r + hitRadius) * (r + hitRadius)) {
        return node.id
      }
    }
    return null
  }

  onUnmounted(() => {
    stopSimulation()
  })

  return {
    forceNodes: readonly(forceNodes),
    isSimulating: readonly(isSimulating),
    isSettled: readonly(isSettled),
    syncFromStore,
    startSimulation,
    stopSimulation,
    restartSimulation,
    pinNode,
    unpinNode,
    moveNode,
    findNodeAt,
  }
}
