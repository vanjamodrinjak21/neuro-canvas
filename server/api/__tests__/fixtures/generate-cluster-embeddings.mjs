// ---------------------------------------------------------------------------
// Deterministic 256-dim cluster-fixture generator (AER-5)
// ---------------------------------------------------------------------------
//
// Produces 30 L2-normalised 256d vectors split into 3 semantic-looking
// clusters (10 vectors each). Each cluster is built around a unit-norm
// centroid plus a small per-member jitter. Cosine similarity between any
// two same-cluster members is materially higher than between cross-cluster
// members, which is exactly the geometric property real embeddings exhibit.
//
// We do NOT call transformers.js / ONNX in this script. The integration
// test cares about backend behaviour (writes round-trip, search ranking
// reflects vector geometry, recall@3 stays high for well-separated
// clusters). Synthetic-but-realistic vectors exercise the same code paths.
//
// Run from repo root:
//   node server/api/__tests__/fixtures/generate-cluster-embeddings.mjs
//
// Determinism: a tiny xorshift32 PRNG seeded by a fixed integer per
// cluster. Re-running this script must always produce byte-identical JSON.
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DIMS = 256
const CLUSTERS = [
  { name: 'animals',  seed: 1001, members: 10, jitter: 0.18, topics: [
    'The lion is the largest cat in Africa',
    'Dolphins are highly intelligent marine mammals',
    'Eagles soar at incredible altitudes hunting prey',
    'Honey bees pollinate most flowering plants',
    'Penguins waddle across antarctic ice sheets',
    'Cheetahs can sprint faster than any other land animal',
    'Wolves hunt cooperatively as a tight-knit pack',
    'Owls rotate their heads almost 270 degrees',
    'Octopuses solve puzzles and open sealed jars',
    'Kangaroos carry their young in a belly pouch',
  ] },
  { name: 'vehicles', seed: 2003, members: 10, jitter: 0.18, topics: [
    'Electric cars accelerate silently from a stop',
    'Cargo ships transport containers across oceans',
    'Bullet trains glide on welded steel rails',
    'Motorcycles lean into corners for stability',
    'Helicopters hover in place using rotor lift',
    'Bicycles convert leg power into forward motion',
    'Submarines dive deep using ballast tanks',
    'Pickup trucks haul lumber to construction sites',
    'Jet aircraft cruise above the weather layer',
    'Cargo bikes deliver groceries in dense cities',
  ] },
  { name: 'foods',    seed: 3007, members: 10, jitter: 0.18, topics: [
    'Sourdough bread ferments slowly with wild yeast',
    'Sushi pairs rice and raw fish with seaweed',
    'Tacos wrap seasoned meat in soft corn tortillas',
    'Pasta carbonara binds eggs and pancetta together',
    'Ramen broths simmer for many hours',
    'Croissants flake apart in buttery layers',
    'Curry mixes spices into a thick simmered sauce',
    'Pizza margherita uses tomato basil and mozzarella',
    'Dumplings steam inside pleated dough wrappers',
    'Pho infuses beef broth with star anise and ginger',
  ] },
]

// xorshift32: pure deterministic PRNG, no Node crypto.
function makeRng(seed) {
  let state = seed >>> 0
  return () => {
    state ^= state << 13; state >>>= 0
    state ^= state >>> 17
    state ^= state << 5;  state >>>= 0
    return (state >>> 0) / 0xffffffff
  }
}

function randomUnitVector(rng, dims) {
  // Box-Muller via two uniforms -> standard normal, then L2-normalise.
  const v = new Array(dims)
  for (let i = 0; i < dims; i += 2) {
    const u1 = Math.max(rng(), 1e-12)
    const u2 = rng()
    const mag = Math.sqrt(-2 * Math.log(u1))
    v[i] = mag * Math.cos(2 * Math.PI * u2)
    if (i + 1 < dims) v[i + 1] = mag * Math.sin(2 * Math.PI * u2)
  }
  let norm = 0
  for (let i = 0; i < dims; i++) norm += v[i] * v[i]
  norm = Math.sqrt(norm)
  for (let i = 0; i < dims; i++) v[i] /= norm
  return v
}

function jitter(vector, rng, scale) {
  // Add small-magnitude noise then re-normalise. Keeps members in the
  // centroid's neighbourhood without flattening the cluster to a single point.
  const out = vector.slice()
  for (let i = 0; i < out.length; i++) {
    out[i] += (rng() * 2 - 1) * scale
  }
  let norm = 0
  for (let i = 0; i < out.length; i++) norm += out[i] * out[i]
  norm = Math.sqrt(norm)
  for (let i = 0; i < out.length; i++) out[i] /= norm
  return out
}

function dot(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

const fixtures = []
const centroids = {}

for (const cluster of CLUSTERS) {
  const rng = makeRng(cluster.seed)
  const centroid = randomUnitVector(rng, DIMS)
  centroids[cluster.name] = centroid
  for (let i = 0; i < cluster.members; i++) {
    const text = cluster.topics[i]
    const embedding = jitter(centroid, rng, cluster.jitter)
    fixtures.push({
      cluster: cluster.name,
      nodeId: `${cluster.name}-${String(i).padStart(2, '0')}`,
      text,
      embedding,
    })
  }
}

// Sanity: same-cluster cosine should exceed cross-cluster cosine on average.
function meanPairwise(filter) {
  let sum = 0; let n = 0
  for (let i = 0; i < fixtures.length; i++) {
    for (let j = i + 1; j < fixtures.length; j++) {
      if (!filter(fixtures[i], fixtures[j])) continue
      sum += dot(fixtures[i].embedding, fixtures[j].embedding)
      n++
    }
  }
  return n === 0 ? 0 : sum / n
}

const sameClusterMean = meanPairwise((a, b) => a.cluster === b.cluster)
const crossClusterMean = meanPairwise((a, b) => a.cluster !== b.cluster)

const meta = {
  dims: DIMS,
  clusters: CLUSTERS.map(c => ({ name: c.name, members: c.members })),
  generator: 'xorshift32 + Box-Muller + jitter, seeded per cluster',
  determinism: 'Re-running this script must produce byte-identical JSON',
  sameClusterCosineMean: Number(sameClusterMean.toFixed(4)),
  crossClusterCosineMean: Number(crossClusterMean.toFixed(4)),
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, 'cluster-embeddings.json')

writeFileSync(outPath, JSON.stringify({ meta, fixtures }, null, 2) + '\n')

console.log(`Wrote ${fixtures.length} embeddings to ${outPath}`)
console.log(`  same-cluster cosine mean = ${meta.sameClusterCosineMean}`)
console.log(`  cross-cluster cosine mean = ${meta.crossClusterCosineMean}`)

if (sameClusterMean <= crossClusterMean) {
  console.error('FAIL: same-cluster cosine must exceed cross-cluster cosine')
  process.exit(1)
}
