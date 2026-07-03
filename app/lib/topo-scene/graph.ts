import { Vector4 } from 'three'
import { mulberry32, range } from './rng'

/**
 * 2D neural-map layout for the topographic shader. World space: x is
 * aspect-corrected around 0, y runs from 0 (hero) to PAN_TOTAL + 1
 * (finale). Every node is an elevation peak; every link is a ridge and a
 * drawn dashed line. Counts are compile-time constants because they size
 * GLSL uniform arrays.
 */

export const NODE_COUNT = 34
export const LINK_COUNT = 40
export const PAN_TOTAL = 5 // world-heights of terrain the journey scrolls across

export interface TopoGraph {
  /** xyzw = x, y, peak size, birth (reveal progress at which it appears) */
  nodes: Vector4[]
  /** xyzw = ax, ay, bx, by */
  links: Vector4[]
  /** xyzw = birth, dash phase, pulse speed, unused */
  linkMeta: Vector4[]
}

interface RawNode {
  x: number
  y: number
  size: number
  birth: number
  cluster: number
}

export function buildTopoGraph(seed = 20260702): TopoGraph {
  const rng = mulberry32(seed)

  // 6 clusters: hero, four stations, finale — one per screen of travel.
  const clusterY = [0.5, 1.52, 2.5, 3.52, 4.5, 5.42]
  const clusterX = [0.06, 0.34, -0.36, 0.32, -0.3, 0.02]
  const perCluster = [6, 5, 5, 5, 5, 8]

  const raw: RawNode[] = []
  clusterY.forEach((cy, ci) => {
    const n = perCluster[ci]!
    for (let i = 0; i < n; i++) {
      const spread = ci === 5 ? 0.34 : 0.2
      raw.push({
        x: clusterX[ci]! + range(rng, -spread, spread),
        y: cy + range(rng, -spread * 0.8, spread * 0.8),
        size: rng() > 0.72 ? range(rng, 0.085, 0.115) : range(rng, 0.045, 0.07),
        birth: Math.min(0.86, Math.max(0.01, (ci / 5) * 0.8 - 0.05 + rng() * 0.09)),
        cluster: ci,
      })
    }
  })

  // Intra-cluster chains + one bridge between consecutive clusters.
  const linkPairs: [number, number][] = []
  const byCluster: number[][] = clusterY.map(() => [])
  raw.forEach((n, i) => byCluster[n.cluster]!.push(i))

  for (const ids of byCluster) {
    for (let k = 0; k < ids.length; k++) {
      // chain neighbours + one extra cross for triangles
      if (k > 0) linkPairs.push([ids[k - 1]!, ids[k]!])
      if (k === ids.length - 1 && ids.length > 2 && rng() > 0.4) {
        linkPairs.push([ids[0]!, ids[k]!])
      }
    }
  }
  for (let c = 0; c < byCluster.length - 1; c++) {
    const a = byCluster[c]!
    const b = byCluster[c + 1]!
    let best: [number, number] = [a[0]!, b[0]!]
    let bestD = Infinity
    for (const i of a) {
      for (const j of b) {
        const d = (raw[i]!.x - raw[j]!.x) ** 2 + (raw[i]!.y - raw[j]!.y) ** 2
        if (d < bestD) {
          bestD = d
          best = [i, j]
        }
      }
    }
    linkPairs.push(best)
  }

  // Clamp/pad to the compile-time count. Drop intra-cluster extras, never
  // the inter-cluster bridges — those are the last 5 entries and popping
  // them would visually disconnect the finale from the network.
  while (linkPairs.length > LINK_COUNT) linkPairs.splice(linkPairs.length - 6, 1)
  while (linkPairs.length < LINK_COUNT) {
    const i = Math.floor(rng() * raw.length)
    const j = Math.floor(rng() * raw.length)
    if (i !== j && Math.abs(raw[i]!.cluster - raw[j]!.cluster) <= 1) linkPairs.push([i, j])
  }

  const nodes = raw
    .slice(0, NODE_COUNT)
    .map((n) => new Vector4(n.x, n.y, n.size, n.birth))
  while (nodes.length < NODE_COUNT) nodes.push(new Vector4(0, -10, 0, 2)) // parked off-map

  const links: Vector4[] = []
  const linkMeta: Vector4[] = []
  for (const [i, j] of linkPairs) {
    const a = raw[i]!
    const b = raw[j]!
    links.push(new Vector4(a.x, a.y, b.x, b.y))
    linkMeta.push(
      new Vector4(
        Math.min(0.9, Math.max(a.birth, b.birth) + 0.03),
        rng(),
        range(rng, 0.6, 1.5),
        0,
      ),
    )
  }

  return { nodes, links, linkMeta }
}
