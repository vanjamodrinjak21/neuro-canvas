#!/usr/bin/env node
/**
 * OpenAI parity diagnostic for NeuroCanvas.
 *
 * Verifies an OpenAI API key works for everything the app does with Claude:
 *   1. Auth + /models reachability (mirrors /api/ai/test-connection)
 *   2. Confirms the app's configured default models actually exist
 *   3. A real map-generation completion (mirrors /api/templates/generate)
 *      — and empirically determines whether the GPT-5.x models accept the
 *        params the app currently sends (`max_tokens` + custom `temperature`)
 *        or require the newer `max_completion_tokens` / default temperature.
 *   4. Validates the returned content parses as the expected map JSON.
 *
 * Run WITHOUT exposing the key to the agent:
 *   node --env-file=.env scripts/test-openai-generation.mjs
 * or:
 *   OPENAI_API_KEY=sk-... node scripts/test-openai-generation.mjs
 *
 * Optional: TEST_MODEL=gpt-5.4 to override the model under test.
 */

const KEY = process.env.OPENAI_API_KEY
const BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const MODEL = process.env.TEST_MODEL || 'gpt-5.4-mini'
// The four ids the app ships in PROVIDER_TEMPLATES.openai (app/types/ai-settings.ts)
const EXPECTED_MODELS = ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano']

const c = { green: s => `\x1b[32m${s}\x1b[0m`, red: s => `\x1b[31m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m` }
const ok = s => console.log(`${c.green('✓')} ${s}`)
const bad = s => console.log(`${c.red('✗')} ${s}`)
const warn = s => console.log(`${c.yellow('!')} ${s}`)

if (!KEY) {
  bad('OPENAI_API_KEY not set. Run: node --env-file=.env scripts/test-openai-generation.mjs')
  process.exit(2)
}
console.log(c.dim(`key sk-…${KEY.slice(-4)}  base ${BASE}  model ${MODEL}\n`))

// Same generation contract the server uses (server/api/templates/generate.post.ts)
const SYSTEM_PROMPT = `You are a world-class mind-map architect. Turn the topic into a rich, multi-level map and return it as STRICT JSON only.
The response must be valid JSON with this exact structure:
{"rootTopic":"string","rootDescription":{"summary":"string","keywords":["string"]},"branches":[{"title":"string","description":{"summary":"string"},"category":"concept","children":[{"title":"string","description":{"summary":"string"},"category":"concept","children":[],"depth":1}],"depth":0}]}
REQUIREMENTS: exactly 3 main branches, each with 2-4 children. RESPOND WITH ONLY VALID JSON, NO MARKDOWN.`
const USER_PROMPT = 'Create a mind map structure for: "Photosynthesis"'

const auth = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
let failures = 0

// ── 1. /models ────────────────────────────────────────────────────────────
console.log('1) Auth + model list')
let modelIds = []
try {
  const r = await fetch(`${BASE}/models`, { headers: auth })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    bad(`/models → ${r.status} ${e?.error?.message || ''}`)
    failures++
  } else {
    const d = await r.json()
    modelIds = (d.data || []).map(m => m.id)
    ok(`/models → 200 (${modelIds.length} models available)`)
  }
} catch (e) { bad(`/models threw: ${e.message}`); failures++ }

// ── 2. configured defaults exist ──────────────────────────────────────────
console.log('\n2) App default models exist on the account')
for (const m of EXPECTED_MODELS) {
  if (!modelIds.length) { warn(`${m} — skipped (no model list)`); continue }
  if (modelIds.includes(m)) ok(`${m}`)
  else { bad(`${m} — NOT in account model list (generation default would 404)`); failures++ }
}

// ── 3. map generation, with empirical param negotiation ────────────────────
console.log('\n3) Map generation completion')
const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: USER_PROMPT }]

async function tryCompletion({ tokenParam, temperature }) {
  const body = { model: MODEL, messages, [tokenParam]: 4000 }
  if (temperature !== undefined) body.temperature = temperature
  const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: auth, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  return { status: r.status, ok: r.ok, data: d, sent: { tokenParam, temperature } }
}

// Attempt the EXACT request the app sends today, then fall back the way a
// fix would, recording which combination the model actually accepts.
const attempts = [
  { label: 'app-current  (max_tokens + temperature:0.7)', tokenParam: 'max_tokens', temperature: 0.7 },
  { label: 'fix-A        (max_completion_tokens + temperature:0.7)', tokenParam: 'max_completion_tokens', temperature: 0.7 },
  { label: 'fix-B        (max_completion_tokens + default temp)', tokenParam: 'max_completion_tokens', temperature: undefined },
  { label: 'fix-C        (max_tokens + default temp)', tokenParam: 'max_tokens', temperature: undefined },
]

let winner = null
for (const a of attempts) {
  try {
    const res = await tryCompletion(a)
    if (res.ok) {
      ok(`${a.label} → 200`)
      if (!winner) winner = { ...a, content: res.data.choices?.[0]?.message?.content || '' }
    } else {
      const msg = res.data?.error?.message || ''
      bad(`${a.label} → ${res.status} ${c.dim(msg)}`)
    }
  } catch (e) { bad(`${a.label} threw: ${e.message}`) }
}

if (!winner) {
  bad('No parameter combination produced a completion — OpenAI generation is broken for this key/model.')
  failures++
} else {
  console.log(`\n${c.green('→ working params:')} ${winner.tokenParam}${winner.temperature !== undefined ? ' + temperature' : ' + default temperature'}`)
  if (winner.tokenParam !== 'max_tokens' || winner.temperature === undefined) {
    warn('App currently sends max_tokens + custom temperature. Code change required for parity (see report).')
  } else {
    ok('App\'s current request shape is accepted as-is. No code change needed.')
  }

  // ── 4. validate JSON map shape ──────────────────────────────────────────
  console.log('\n4) Output validates as a map structure')
  const raw = winner.content
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = (fence ? fence[1] : raw).trim()
  try {
    const s = JSON.parse(jsonStr)
    if (s.rootTopic && Array.isArray(s.branches) && s.branches.length) {
      ok(`parsed: rootTopic="${s.rootTopic}", ${s.branches.length} branches, ${s.branches.reduce((n, b) => n + (b.children?.length || 0), 0)} children`)
    } else { bad('parsed JSON but missing rootTopic/branches'); failures++ }
  } catch (e) { bad(`could not parse map JSON: ${e.message}`); console.log(c.dim(raw.slice(0, 200))); failures++ }
}

console.log(`\n${failures === 0 ? c.green('ALL CHECKS PASSED — OpenAI is at parity with Claude.') : c.red(`${failures} check(s) failed — see above.`)}`)
process.exit(failures === 0 ? 0 : 1)
