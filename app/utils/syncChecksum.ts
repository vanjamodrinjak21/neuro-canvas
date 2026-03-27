/**
 * Generate SHA-256 checksum using Web Crypto API
 */
export async function generateChecksum(data: unknown): Promise<string> {
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  const encoded = new TextEncoder().encode(json)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
