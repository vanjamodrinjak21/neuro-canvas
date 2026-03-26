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
  '0.0.0.0', '::1', 'fd', 'fe80:'
]

const BLOCKED_HOSTS = [
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254'
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

  for (const prefix of PRIVATE_PREFIXES) {
    if (hostname.startsWith(prefix) || hostname === 'localhost') {
      return {
        safe: false,
        resolvedUrl: url,
        error: 'Custom providers cannot target private/local addresses'
      }
    }
  }

  return { safe: true, resolvedUrl: parsed.toString() }
}
