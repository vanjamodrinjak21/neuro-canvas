const ALLOWED_HOSTS: Record<string, string[]> = {
  openai: ['api.openai.com'],
  anthropic: ['api.anthropic.com'],
  openrouter: ['openrouter.ai'],
  ollama: ['localhost', '127.0.0.1', '0.0.0.0', '::1']
}

const PRIVATE_PREFIXES = [
  '10.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
  '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
  '172.30.', '172.31.', '192.168.', '169.254.', '127.',
  '0.0.0.0', '::1', 'fd', 'fe80:',
  // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  '::ffff:10.', '::ffff:172.', '::ffff:192.168.', '::ffff:169.254.',
  '::ffff:127.', '::ffff:0.', '0:0:0:0:0:0:0:1',
  // Bracket notation from URL parsers
  '[::1]', '[::]', '[::ffff:'
]

const BLOCKED_HOSTS = [
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',
  '[169.254.169.254]',
  '::ffff:169.254.169.254'
]

export function validateOutboundUrl(
  url: string | undefined,
  provider: string
): { safe: boolean; resolvedUrl: string; error?: string } {
  if (!url) {
    const defaults: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      ollama: 'http://localhost:11434'
    }
    if (defaults[provider]) {
      return { safe: true, resolvedUrl: defaults[provider]! }
    }
    return { safe: false, resolvedUrl: '', error: 'Custom provider requires baseUrl' }
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { safe: false, resolvedUrl: url, error: 'Invalid URL format' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, resolvedUrl: url, error: 'Only http/https URLs allowed' }
  }

  parsed.username = ''
  parsed.password = ''

  const hostname = parsed.hostname.toLowerCase()

  if (BLOCKED_HOSTS.includes(hostname)) {
    return { safe: false, resolvedUrl: url, error: 'Blocked host' }
  }

  const allowed = ALLOWED_HOSTS[provider]
  if (allowed) {
    if (!allowed.includes(hostname)) {
      return {
        safe: false,
        resolvedUrl: url,
        error: `Provider "${provider}" can only connect to: ${allowed.join(', ')}`
      }
    }
    return { safe: true, resolvedUrl: parsed.toString() }
  }

  // For custom providers: block private/local addresses
  for (const prefix of PRIVATE_PREFIXES) {
    if (hostname.startsWith(prefix) || hostname === 'localhost') {
      return {
        safe: false,
        resolvedUrl: url,
        error: 'Custom providers cannot target private/local addresses'
      }
    }
  }

  // Block numeric IP addresses entirely for custom providers
  // Prevents decimal (2130706433), octal (0177.0.0.1), and hex (0x7f000001) bypasses
  const stripped = hostname.replace(/[[\]]/g, '')
  if (/^[\d.]+$/.test(stripped) || /^0[xo]/i.test(stripped) || /^\d+$/.test(stripped)) {
    return {
      safe: false,
      resolvedUrl: url,
      error: 'Custom providers must use domain names, not IP addresses'
    }
  }

  // Block IPv6 zone IDs (e.g., fe80::1%eth0) which can bypass prefix checks
  if (hostname.includes('%')) {
    return {
      safe: false,
      resolvedUrl: url,
      error: 'IPv6 zone IDs are not allowed'
    }
  }

  return { safe: true, resolvedUrl: parsed.toString() }
}

/**
 * Hardened fetch — disables redirect following to prevent SSRF via open redirects.
 * Use this for all outbound AI provider calls.
 */
export function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, redirect: 'error' })
}
