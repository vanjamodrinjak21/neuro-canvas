import { describe, it, expect } from 'vitest'
import { renderInlineMarkdown, escapeHtml } from '../inlineMarkdown'

describe('inlineMarkdown', () => {
  describe('escapeHtml', () => {
    it('encodes the five HTML-relevant characters', () => {
      expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;')
    })
  })

  describe('renderInlineMarkdown — formatting', () => {
    it('returns empty string for empty input', () => {
      expect(renderInlineMarkdown('')).toBe('')
    })
    it('renders bold', () => {
      expect(renderInlineMarkdown('**hi**')).toBe('<strong>hi</strong>')
    })
    it('renders italic', () => {
      expect(renderInlineMarkdown('*hi*')).toBe('<em>hi</em>')
    })
    it('renders inline code', () => {
      expect(renderInlineMarkdown('`x`')).toBe('<code>x</code>')
    })
    it('renders an http link', () => {
      const out = renderInlineMarkdown('[a](https://example.com)')
      expect(out).toContain('href="https://example.com/"')
      expect(out).toContain('rel="noopener noreferrer"')
      expect(out).toContain('target="_blank"')
      expect(out).toContain('>a</a>')
    })
  })

  describe('renderInlineMarkdown — XSS', () => {
    it('escapes raw HTML in plain text', () => {
      expect(renderInlineMarkdown('<script>alert(1)</script>'))
        .toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    })

    it('rejects javascript: protocol in links', () => {
      const out = renderInlineMarkdown('[click](javascript:alert(1))')
      expect(out).not.toContain('javascript:')
      expect(out).toContain('click')
    })

    it('rejects data: protocol in links', () => {
      const out = renderInlineMarkdown('[click](data:text/html,<script>alert(1)</script>)')
      expect(out).not.toContain('data:')
    })

    it('does not let attribute-injection escape the href quotes', () => {
      // Classic break-out-of-href payload: a quote followed by an event handler.
      const out = renderInlineMarkdown('[x](https://a.com" onclick="alert(1) )')
      // The link form is invalid as a URL, so we should fall back to the link
      // text — never an open <a onclick=...>.
      expect(out).not.toMatch(/onclick/i)
      expect(out).not.toMatch(/<a [^>]*onclick/i)
    })

    it('escapes link text containing HTML', () => {
      const out = renderInlineMarkdown('[<b>x</b>](https://a.com)')
      expect(out).toContain('&lt;b&gt;x&lt;/b&gt;')
      expect(out).not.toContain('<b>x</b>')
    })

    it('escapes ampersands in URLs (no &-entity smuggling)', () => {
      const out = renderInlineMarkdown('[q](https://a.com/?a=1&b=2)')
      // & must be encoded as &amp; in the href attribute
      expect(out).toContain('&amp;b=2')
    })

    it('does not double-escape inside emitted anchors', () => {
      const out = renderInlineMarkdown('[a](https://example.com)')
      expect(out).not.toContain('&amp;amp;')
    })
  })
})
