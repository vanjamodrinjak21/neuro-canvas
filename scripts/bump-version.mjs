#!/usr/bin/env node
/**
 * Bump every per-platform version file to the same number, then optionally
 * tag the result.
 *
 *   node scripts/bump-version.mjs 1.2.3
 *   node scripts/bump-version.mjs 1.2.3 --tag
 *   node scripts/bump-version.mjs --check        # prints current versions
 *
 * Files touched:
 *   - package.json                     "version"
 *   - src-tauri/Cargo.toml             [package] version
 *   - src-tauri/tauri.conf.json        "version"
 *   - android/app/build.gradle         versionName + versionCode (incremented)
 *   - ios/App/App.xcodeproj/project.pbxproj  MARKETING_VERSION + CURRENT_PROJECT_VERSION
 *
 * Windows / macOS / Linux desktop bundles all read from tauri.conf.json, so
 * bumping that one entry covers every Tauri target.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const wantTag = args.includes('--tag')
const checkOnly = args.includes('--check')
const positional = args.find(a => !a.startsWith('--'))

const FILES = {
  pkg:      resolve(ROOT, 'package.json'),
  cargo:    resolve(ROOT, 'src-tauri/Cargo.toml'),
  tauri:    resolve(ROOT, 'src-tauri/tauri.conf.json'),
  gradle:   resolve(ROOT, 'android/app/build.gradle'),
  pbxproj:  resolve(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'),
}

// Strict semver — also matches the GitHub Actions release.yml tag filter.
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

function read(p)        { return readFileSync(p, 'utf8') }
function write(p, body) { writeFileSync(p, body) }

function readVersions() {
  const pkg     = JSON.parse(read(FILES.pkg)).version
  const cargo   = read(FILES.cargo).match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1]
  const tauri   = JSON.parse(read(FILES.tauri)).version
  const gradle  = read(FILES.gradle).match(/versionName\s+"([^"]+)"/)?.[1]
  const code    = Number(read(FILES.gradle).match(/versionCode\s+(\d+)/)?.[1] ?? '0')
  const ios     = read(FILES.pbxproj).match(/MARKETING_VERSION\s*=\s*([^;]+);/)?.[1]?.trim()
  return { pkg, cargo, tauri, gradle, gradleCode: code, ios }
}

function setJsonVersion(file, next) {
  const obj = JSON.parse(read(file))
  obj.version = next
  write(file, JSON.stringify(obj, null, 2) + '\n')
}

function setCargoVersion(file, next) {
  const src = read(file)
  // Anchor on the [package] table's version line specifically. Workspace
  // and dependency tables further down can have their own version = "..."
  // entries which we must never touch.
  const re = /(\[package\][\s\S]*?\n\s*version\s*=\s*)"[^"]+"/
  if (!re.test(src)) throw new Error(`[package] version line not found in ${file}`)
  write(file, src.replace(re, `$1"${next}"`))
}

function setGradleVersion(file, next, codeBumpFrom) {
  let src = read(file)
  src = src.replace(/(versionName\s+)"[^"]+"/, `$1"${next}"`)
  src = src.replace(/(versionCode\s+)\d+/, `$1${codeBumpFrom + 1}`)
  write(file, src)
}

function setPbxprojVersion(file, next) {
  let src = read(file)
  src = src.replace(/MARKETING_VERSION\s*=\s*[^;]+;/g, `MARKETING_VERSION = ${next};`)
  src = src.replace(/CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g, `CURRENT_PROJECT_VERSION = ${next};`)
  write(file, src)
}

if (checkOnly || !positional) {
  const v = readVersions()
  console.log('Current per-platform versions:')
  console.log(`  package.json         ${v.pkg}`)
  console.log(`  Cargo.toml           ${v.cargo}`)
  console.log(`  tauri.conf.json      ${v.tauri}`)
  console.log(`  Android versionName  ${v.gradle}  (versionCode ${v.gradleCode})`)
  console.log(`  iOS  MARKETING_VER   ${v.ios}`)
  const aligned = [v.pkg, v.cargo, v.tauri, v.gradle, v.ios].every(x => x === v.pkg)
  console.log(aligned ? '\n✓ aligned' : '\n✗ DRIFT — run `node scripts/bump-version.mjs <version>` to realign')
  process.exit(checkOnly && !aligned ? 1 : 0)
}

if (!SEMVER_RE.test(positional)) {
  console.error(`✗ Not a valid semver: ${positional}`)
  console.error('  Expected: 1.2.3, 1.2.3-rc.1, 1.2.3-beta.4+build.5')
  process.exit(2)
}

const NEXT = positional
const before = readVersions()

setJsonVersion(FILES.pkg, NEXT)
setCargoVersion(FILES.cargo, NEXT)
setJsonVersion(FILES.tauri, NEXT)
setGradleVersion(FILES.gradle, NEXT, before.gradleCode)
setPbxprojVersion(FILES.pbxproj, NEXT)

const after = readVersions()
console.log(`Bumped ${before.pkg} → ${after.pkg}`)
console.log(`  Android versionCode ${before.gradleCode} → ${after.gradleCode}`)

if (wantTag) {
  // execFileSync with an arg array — never goes through a shell, so the
  // semver-validated version string cannot inject commands.
  const tag = `v${NEXT}`
  execFileSync('git', ['add', '-A'], { stdio: 'inherit' })
  execFileSync('git', ['commit', '-m', `chore(release): ${tag}`], { stdio: 'inherit' })
  execFileSync('git', ['tag', '-a', tag, '-m', `Release ${tag}`], { stdio: 'inherit' })
  console.log(`\nTagged ${tag}. Push with:  git push origin main && git push origin ${tag}`)
} else {
  console.log('\nFiles updated. Review the diff, then commit + tag yourself, or re-run with --tag.')
}
