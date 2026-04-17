/**
 * Post-generate script for Tauri/Capacitor builds.
 * Copies the SPA fallback (200.html) to all dynamic route directories
 * so Tauri's asset protocol can serve the app for any client-side route.
 */
const fs = require('fs')
const path = require('path')

const publicDir = path.join(__dirname, '..', '.output', 'public')
const fallback = path.join(publicDir, '200.html')

if (!fs.existsSync(fallback)) {
  console.log('[post-generate] No 200.html found, skipping')
  process.exit(0)
}

const html = fs.readFileSync(fallback)

// Dynamic route directories that need SPA fallback
const dirs = [
  'map/new',
  'map/_', // Catch-all for /map/{any-id}
  'maps',
  'settings',
  'templates',
  'auth/signin',
  'auth/signup',
]

for (const dir of dirs) {
  const fullDir = path.join(publicDir, dir)
  const indexFile = path.join(fullDir, 'index.html')

  fs.mkdirSync(fullDir, { recursive: true })

  if (!fs.existsSync(indexFile)) {
    fs.writeFileSync(indexFile, html)
    console.log(`[post-generate] Created fallback: ${dir}/index.html`)
  }
}

console.log('[post-generate] Done')
