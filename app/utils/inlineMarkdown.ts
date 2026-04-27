/**
 * Tiny, XSS-safe inline-markdown renderer for outline items.
 *
 * Rules:
 *   - Backtick code: `code`
 *   - Bold: **text**
 *   - Italic: *text*
 *   - Links: [text](url) — http/https only, attribute-encoded
 *
 * Safety: links are parsed with the URL constructor before insertion, every
 * substitution is HTML-escaped, and the protocol is restricted to http/https
 * to keep `javascript:` and `data:` schemes out.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function applyInlineFormatting(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

export function renderInlineMarkdown(text: string): string {
  if (!text) return ''
  // Links first (operate on raw text so URL parsing sees real characters),
  // then split on the safe anchor we emitted and only escape/format the
  // remaining segments. This avoids the &quot;-decoded-back-to-" trap of
  // escape-then-regex pipelines.
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText: string, url: string) => {
      let parsed: URL
      try { parsed = new URL(url) } catch { return escapeHtml(linkText) }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return escapeHtml(linkText)
      }
      return `<a href="${escapeHtml(parsed.toString())}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`
    })
    .split(/(<a [^>]*>[^<]*<\/a>)/g)
    .map((seg, i) => (i % 2 === 1 ? seg : applyInlineFormatting(escapeHtml(seg))))
    .join('')
}
