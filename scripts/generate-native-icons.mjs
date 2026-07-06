#!/usr/bin/env node
/**
 * Regenerate every native app icon from the canonical NcLogo mark (AER-85).
 *
 * Why per-platform variants instead of one square PNG:
 *  - iOS forbids alpha in app icons — baked rounded corners render as BLACK
 *    corners on device. iOS gets an opaque full-bleed square (the system
 *    applies the mask).
 *  - Android (API 26+) masks adaptive icons itself: the foreground must be
 *    the MARK ONLY inside the 66/108 safe zone over a solid background
 *    color, otherwise the launcher shows a double-masked, cropped square.
 *    Legacy launchers get pre-shaped (rounded / circle) icons.
 *  - macOS icons are expected to be the Big Sur rounded-rect with margins —
 *    a full-bleed square looks broken in the Dock. Built as an .iconset and
 *    compiled with iconutil (macOS host required for the icns step).
 *  - Windows .ico / Store logos come from the full-bleed square via
 *    `tauri icon` (run separately, see bottom).
 *
 * Usage: node scripts/generate-native-icons.mjs
 * Then:  npx tauri icon build/icons/fullbleed-1024.png  (regenerates
 *        src-tauri/icons; this script then overwrites icon.icns with the
 *        macOS-styled version it built)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'

const TEAL = '#00D2BE' // NcLogo container fill (Paper brand identity sheet)
const INK = '#09090B'  // mark color, same as NcLogo.vue

// NcLogo layers ink at 0.5/0.7 opacity over teal. At icon sizes the alpha
// STACKING shows dark patches where spokes overlap node circles, so bake the
// blends to solid colors: 0.5-ink-over-teal and 0.7-ink-over-teal.
const SPOKE = '#056E64'
const NODE = '#034239'

// 6-spoke mark, geometry verbatim from app/components/NcLogo.vue (viewBox 72).
const MARK = `
  <line x1="36" y1="28" x2="36" y2="19" stroke="${SPOKE}" stroke-width="2.5" />
  <line x1="43" y1="32" x2="50" y2="27" stroke="${SPOKE}" stroke-width="2.5" />
  <line x1="43" y1="40" x2="50" y2="45" stroke="${SPOKE}" stroke-width="2.5" />
  <line x1="36" y1="44" x2="36" y2="53" stroke="${SPOKE}" stroke-width="2.5" />
  <line x1="29" y1="40" x2="22" y2="45" stroke="${SPOKE}" stroke-width="2.5" />
  <line x1="29" y1="32" x2="22" y2="27" stroke="${SPOKE}" stroke-width="2.5" />
  <circle cx="36" cy="16" r="5" fill="${NODE}" />
  <circle cx="52" cy="26" r="5" fill="${NODE}" />
  <circle cx="52" cy="46" r="5" fill="${NODE}" />
  <circle cx="36" cy="56" r="5" fill="${NODE}" />
  <circle cx="20" cy="46" r="5" fill="${NODE}" />
  <circle cx="20" cy="26" r="5" fill="${NODE}" />
  <circle cx="36" cy="36" r="8" fill="${INK}" />
`

/** Mark centered in a canvas: markRatio = mark svg edge / canvas edge. */
const markAt = (canvas, markRatio) => {
  const edge = Math.round(canvas * markRatio)
  const off = Math.round((canvas - edge) / 2)
  return `<svg x="${off}" y="${off}" width="${edge}" height="${edge}" viewBox="0 0 72 72">${MARK}</svg>`
}

const svgFullBleed = (s) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
  `<rect width="${s}" height="${s}" fill="${TEAL}"/>${markAt(s, 0.78)}</svg>`

// Big Sur style: 824/1024 rounded-rect (Apple's grid), transparent outside.
const svgMacSquircle = (s) => {
  const box = Math.round(s * 0.805)
  const off = Math.round((s - box) / 2)
  const rx = Math.round(box * 0.2237)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
    `<rect x="${off}" y="${off}" width="${box}" height="${box}" rx="${rx}" fill="${TEAL}"/>` +
    `${markAt(s, 0.62)}</svg>`
}

const svgAndroidLegacy = (s) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
  `<rect width="${s}" height="${s}" rx="${Math.round(s * 0.12)}" fill="${TEAL}"/>${markAt(s, 0.78)}</svg>`

const svgAndroidRound = (s) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
  `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="${TEAL}"/>${markAt(s, 0.66)}</svg>`

// Adaptive foreground: transparent, mark inside the 66/108 safe zone.
const svgAndroidForeground = (s) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">${markAt(s, 0.48)}</svg>`

const png = (svg) => sharp(Buffer.from(svg)).png()

async function writePng(svg, path, { opaque = false } = {}) {
  let img = png(svg)
  if (opaque) img = img.flatten({ background: TEAL }).removeAlpha()
  await img.toFile(path)
  console.log('wrote', path)
}

const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
const FG_DENSITIES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }

await mkdir('build/icons', { recursive: true })

// Source for `tauri icon` (Windows ico + Store logos + desktop pngs).
await writePng(svgFullBleed(1024), 'build/icons/fullbleed-1024.png', { opaque: true })

// iOS — single 1024, opaque, NO alpha channel.
await writePng(svgFullBleed(1024), 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', { opaque: true })

// Android — legacy + round + adaptive foreground per density.
for (const [d, size] of Object.entries(DENSITIES)) {
  await writePng(svgAndroidLegacy(size), `android/app/src/main/res/mipmap-${d}/ic_launcher.png`)
  await writePng(svgAndroidRound(size), `android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`)
}
for (const [d, size] of Object.entries(FG_DENSITIES)) {
  await writePng(svgAndroidForeground(size), `android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`)
}
// Adaptive background color: teal, not the white placeholder.
await writeFile(
  'android/app/src/main/res/values/ic_launcher_background.xml',
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">${TEAL}</color>\n</resources>\n`
)
console.log('wrote android ic_launcher_background.xml')

// macOS — Big Sur squircle .iconset → icon.icns (requires macOS iconutil).
const iconset = 'build/icons/icon.iconset'
await mkdir(iconset, { recursive: true })
for (const s of [16, 32, 128, 256, 512]) {
  await writePng(svgMacSquircle(s), `${iconset}/icon_${s}x${s}.png`)
  await writePng(svgMacSquircle(s * 2), `${iconset}/icon_${s}x${s}@2x.png`)
}
try {
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', 'build/icons/icon.icns'])
  console.log('wrote build/icons/icon.icns (copy to src-tauri/icons/ AFTER running `npx tauri icon`)')
} catch {
  console.warn('iconutil unavailable (non-macOS host?) — icns not built')
}
