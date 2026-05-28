// Tauri auth shim: intercept /api/auth/* fetch calls BEFORE Nuxt boots.
// Inside the Tauri WebviewWindow we use a native Google OAuth flow and the
// JWT is delivered via a Tauri command — Nuxt's auth endpoints don't exist
// on the local origin, so swallow them with a 200 to keep nuxt-auth happy.
//
// Served from /public/tauri-shim.js so the page's CSP doesn't need
// 'unsafe-inline' for scripts. Loaded synchronously in app.head.
(function () {
  if (!window.__TAURI__ && !window.__TAURI_INTERNALS__) return
  var _f = window.fetch.bind(window)
  window.fetch = function (u, o) {
    var s = typeof u === 'string'
      ? u
      : (u instanceof URL ? u.toString() : u.url)
    if (s.indexOf('/api/auth/') !== -1) {
      return Promise.resolve(new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
    }
    return _f(u, o)
  }
})()
