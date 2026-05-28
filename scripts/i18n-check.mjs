#!/usr/bin/env node
// i18n locale-file linter.
//
// What it catches:
//   1. Duplicate JSON keys (JSON.parse silently keeps the last one,
//      so dup-keys vanish at runtime — exactly the bug that took out
//      `settings.personal` and `settings.account` recently).
//   2. Invalid JSON (parser would explode at build time anyway,
//      catching it earlier here gives a clear error per file).
//   3. Missing keys: every key present in the default locale (en)
//      must also exist in every other locale, otherwise users on
//      non-default locales hit fallback-to-key leaks.
//   4. Extra keys: keys defined in a non-default locale but not in
//      the default — flagged as warnings (might be typos or stale).
//
// Exit codes:
//   0 — clean
//   1 — at least one error (duplicate key or missing translation)
//
// Run via: pnpm i18n:check

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const DEFAULT_LOCALE = 'en'
const LOCALES_DIR = resolve(process.cwd(), 'i18n/locales')

// ─── ANSI ────────────────────────────────────────────────────────────
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

let errorCount = 0
let warningCount = 0

function err(msg) { errorCount++; console.error(`${RED}error${RESET} ${msg}`) }
function warn(msg) { warningCount++; console.warn(`${YELLOW}warn${RESET}  ${msg}`) }

// ─── Duplicate-key scanner ───────────────────────────────────────────
// Walks the raw JSON text and reports any key that appears twice within
// the same object. Operates on the source text rather than the parsed
// object because JSON.parse merges duplicates before any reviver sees
// them. The scanner ignores keys inside strings (so a `:` inside a
// value can't be mistaken for a key separator) and tracks `{}` nesting.
function findDuplicateKeys(text) {
  const dupes = []
  const stack = [new Set()] // one Set per open object
  let i = 0
  let inString = false
  let escape = false
  let buf = ''

  function lineOf(offset) {
    let line = 1
    for (let j = 0; j < offset && j < text.length; j++) {
      if (text[j] === '\n') line++
    }
    return line
  }

  while (i < text.length) {
    const c = text[i]

    if (inString) {
      if (escape) { buf += c; escape = false; i++; continue }
      if (c === '\\') { escape = true; i++; continue }
      if (c === '"') {
        // String just closed — peek ahead past whitespace to see if
        // this is followed by `:` (= it's a key).
        let j = i + 1
        while (j < text.length && /\s/.test(text[j])) j++
        if (text[j] === ':') {
          const set = stack[stack.length - 1]
          if (set.has(buf)) {
            dupes.push({ key: buf, line: lineOf(i) })
          } else {
            set.add(buf)
          }
        }
        buf = ''
        inString = false
        i++
        continue
      }
      buf += c
      i++
      continue
    }

    if (c === '"') { inString = true; i++; continue }
    if (c === '{') { stack.push(new Set()); i++; continue }
    if (c === '}') {
      if (stack.length > 1) stack.pop()
      i++
      continue
    }
    i++
  }

  return dupes
}

// ─── Recursive key collector ─────────────────────────────────────────
function collectKeys(obj, prefix = '', out = new Set()) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out.add(prefix)
    return out
  }
  for (const [k, v] of Object.entries(obj)) {
    collectKeys(v, prefix ? `${prefix}.${k}` : k, out)
  }
  return out
}

// ─── Walk the locales tree ───────────────────────────────────────────
function listFilesByLocale() {
  const byLocale = {}
  try {
    for (const localeName of readdirSync(LOCALES_DIR)) {
      const localeDir = join(LOCALES_DIR, localeName)
      if (!statSync(localeDir).isDirectory()) continue
      byLocale[localeName] = readdirSync(localeDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .map(f => ({ file: f, path: join(localeDir, f) }))
    }
  } catch (e) {
    err(`Could not read ${LOCALES_DIR}: ${e.message}`)
    process.exit(1)
  }
  return byLocale
}

const byLocale = listFilesByLocale()
const locales = Object.keys(byLocale)
if (!locales.includes(DEFAULT_LOCALE)) {
  err(`Default locale "${DEFAULT_LOCALE}" not found in ${LOCALES_DIR}`)
  process.exit(1)
}

console.log(`${BOLD}i18n check${RESET} — ${locales.length} locales, default=${DEFAULT_LOCALE}`)
console.log()

// 1) Per-file: parse + duplicate scan
const parsedByLocale = {}
for (const locale of locales) {
  parsedByLocale[locale] = {}
  for (const { file, path } of byLocale[locale]) {
    let text
    try { text = readFileSync(path, 'utf8') }
    catch (e) { err(`${locale}/${file}: cannot read (${e.message})`); continue }

    // Duplicate keys
    const dupes = findDuplicateKeys(text)
    for (const d of dupes) {
      err(`${locale}/${file}:${d.line} — duplicate key "${d.key}" (later value silently overwrites the earlier one)`)
    }

    // JSON validity
    let parsed
    try { parsed = JSON.parse(text) }
    catch (e) { err(`${locale}/${file}: invalid JSON — ${e.message}`); continue }

    parsedByLocale[locale][file] = parsed
  }
}

// 2) Cross-locale: every default-locale key must exist in every other locale
const nonDefault = locales.filter(l => l !== DEFAULT_LOCALE)
for (const { file } of byLocale[DEFAULT_LOCALE]) {
  const defaultParsed = parsedByLocale[DEFAULT_LOCALE][file]
  if (!defaultParsed) continue
  const defaultKeys = collectKeys(defaultParsed)

  for (const locale of nonDefault) {
    const localeParsed = parsedByLocale[locale]?.[file]
    if (!localeParsed) {
      err(`${locale}/${file}: missing (default locale has it)`)
      continue
    }
    const localeKeys = collectKeys(localeParsed)
    const missing = [...defaultKeys].filter(k => !localeKeys.has(k))
    const extra = [...localeKeys].filter(k => !defaultKeys.has(k))

    for (const k of missing) {
      err(`${locale}/${file}: missing key "${k}" (defined in ${DEFAULT_LOCALE})`)
    }
    for (const k of extra) {
      warn(`${locale}/${file}: extra key "${k}" not in ${DEFAULT_LOCALE} (typo? stale?)`)
    }
  }
}

// 3) Summary
console.log()
const totalFiles = locales.reduce((n, l) => n + byLocale[l].length, 0)
const summary = `${totalFiles} files, ${locales.length} locales`
if (errorCount === 0 && warningCount === 0) {
  console.log(`${GREEN}${BOLD}✓ clean${RESET} — ${summary}`)
  process.exit(0)
}
if (errorCount === 0) {
  console.log(`${YELLOW}${BOLD}⚠ ${warningCount} warning(s)${RESET} ${DIM}(${summary})${RESET}`)
  process.exit(0)
}
console.log(`${RED}${BOLD}✗ ${errorCount} error(s), ${warningCount} warning(s)${RESET} ${DIM}(${summary})${RESET}`)
process.exit(1)
