const SCANNER_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.aws(\/|$)/i,
  /(^|\/)\.docker(\/|$)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.pypirc$/i,
  /wp-admin(\/|$)/i,
  /wp-login\.php$/i,
  /wp-includes(\/|$)/i,
  /wp-content(\/|$)/i,
  /(^|\/)wordpress(\/|$)/i,
  /xmlrpc\.php$/i,
  /wlwmanifest\.xml$/i,
  /(^|\/)credentials?\.(json|ya?ml)$/i,
  /(^|\/)secrets?\.(json|ya?ml)$/i,
  /service-account\.json$/i,
  /gcp-credentials\.json$/i,
  /google-credentials\.json$/i,
  /firebase-config\.json$/i,
  /__\/firebase\//i,
  /(^|\/)key\.json$/i,
  /keys\/service-account\.json$/i,
  /application\.(properties|yml|yaml)$/i,
  /(^|\/)settings\.py$/i,
  /storage\/logs\//i,
  /laravel\.log$/i,
  /(^|\/)sa\.json$/i,
  /(^|\/)config\.(env|js|json)$/i,
  /(^|\/)env\.(js|json)$/i,
  /(^|\/)__env\.js$/i,
  /(^|\/)runtime-config\.js$/i,
  /(^|\/)app-config\.json$/i,
  /(^|\/)settings\.json$/i,
  /(^|\/)openapi\.json$/i,
  /(^|\/)swagger\.json$/i,
  /(^|\/)api\/(v\d+\/)?(env|config|settings)$/i,
  /(^|\/)admin\/\.env/i,
  /(^|\/)backend\/\.env/i,
  /(^|\/)public\/\.env/i,
  /(^|\/)app\/\.env/i,
  /(^|\/)api\/\.env/i,
]

export function isScannerPath(path: string): boolean {
  if (!path) return false
  for (const pattern of SCANNER_PATTERNS) {
    if (pattern.test(path)) return true
  }
  return false
}
