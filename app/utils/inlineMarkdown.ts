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
 * to keep `javascript:` and `data:` schemes out. Crucially, ALL raw input is
 * escaped — the only unescaped HTML in the output is the anchor markup this
 * function builds itself, tracked via an un-forgeable NUL sentinel (see below).
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

// NUL is our sentinel delimiter: it cannot legitimately occur in outline text
// and survives escapeHtml/applyInlineFormatting untouched. Derived via
// fromCharCode so no invisible byte ever sits in this source file.
const NUL = String.fromCharCode(0)
const SENTINEL_RE = new RegExp(`${NUL}A(\\d+)${NUL}`, 'g')

export function renderInlineMarkdown(text: string): string {
  if (!text) return ''

  // Strip any NUL the user managed to inject so they cannot forge a sentinel.
  const clean = text.split(NUL).join('')

  // 1. Extract links from the RAW text (URL parsing needs the real characters,
  //    not HTML entities), build the fully-safe anchor HTML now, and leave a
  //    sentinel token (NUL + "A" + index + NUL) in its place. That token is the
  //    ONLY thing we later treat as our own HTML. We must never trust a literal
  //    "<a ...>" the user typed — that was the previous bug: a raw anchor
  //    matched the "emitted anchor" split pattern and skipped escaping, giving
  //    stored XSS via `v-html` in OutlineItem.vue.
  const anchors: string[] = []
  const withPlaceholders = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText: string, url: string) => {
    let parsed: URL
    try { parsed = new URL(url) } catch { return escapeHtml(linkText) }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return escapeHtml(linkText)
    }
    anchors.push(`<a href="${escapeHtml(parsed.toString())}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`)
    return `${NUL}A${anchors.length - 1}${NUL}`
  })

  // 2. Escape EVERYTHING else (neutralising any raw "<a>", "<script>", event
  //    handlers, etc.), then apply inline formatting on the now-safe text.
  const formatted = applyInlineFormatting(escapeHtml(withPlaceholders))

  // 3. Restore the sentinels with the anchor HTML built in step 1. An unmatched
  //    index (e.g. a forged sentinel) resolves to '' — never HTML.
  return formatted.replace(SENTINEL_RE, (_, i: string) => anchors[Number(i)] ?? '')
}
