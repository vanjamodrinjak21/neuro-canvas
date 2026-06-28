import { describe, it, expect } from 'vitest'
import { buildInviteEmail, escapeHtml } from '../email'

describe('email — escapeHtml', () => {
  it('escapes the OWASP-required characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml('"><img src=x onerror=1>')).toBe('&quot;&gt;&lt;img src=x onerror=1&gt;')
    expect(escapeHtml("it's & 5 > 3")).toBe('it&#39;s &amp; 5 &gt; 3')
  })

  it('leaves benign text untouched', () => {
    expect(escapeHtml('Hello, world!')).toBe('Hello, world!')
    expect(escapeHtml('email@example.com')).toBe('email@example.com')
  })
})

describe('email — buildInviteEmail', () => {
  it('produces a subject and HTML body', () => {
    const { subject, html } = buildInviteEmail({
      mapTitle: 'Cognitive Architecture',
      inviterName: 'Vanja',
      role: 'EDITOR',
      shareUrl: 'https://neuro-canvas.com/s/abc123',
    })
    expect(subject).toContain('Vanja')
    expect(subject).toContain('Cognitive Architecture')
    expect(subject).toContain('collaborate on')
    expect(html).toContain('href="https://neuro-canvas.com/s/abc123"')
    expect(html).toContain('Vanja')
  })

  it('uses the right verb per role', () => {
    expect(buildInviteEmail({
      mapTitle: 'X', inviterName: 'A', role: 'VIEWER',
      shareUrl: 'https://example.com/s/t',
    }).subject).toContain('view')

    expect(buildInviteEmail({
      mapTitle: 'X', inviterName: 'A', role: 'COMMENTER',
      shareUrl: 'https://example.com/s/t',
    }).subject).toContain('comment on')

    expect(buildInviteEmail({
      mapTitle: 'X', inviterName: 'A', role: 'EDITOR',
      shareUrl: 'https://example.com/s/t',
    }).subject).toContain('collaborate on')
  })

  it('escapes inviter name, map title, and share URL into the HTML body', () => {
    const { html } = buildInviteEmail({
      mapTitle: '<img src=x onerror=alert(1)>',
      inviterName: '"><script>evil()</script>',
      role: 'VIEWER',
      shareUrl: 'https://neuro-canvas.com/s/abc',
    })
    expect(html).not.toContain('<script>evil()')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
    expect(html).toContain('&lt;script&gt;evil()')
  })

  it('embeds the personal note when provided, escaped', () => {
    const { html } = buildInviteEmail({
      mapTitle: 'My Map',
      inviterName: 'Vanja',
      role: 'EDITOR',
      shareUrl: 'https://neuro-canvas.com/s/abc',
      personalNote: 'Hey check this out!\n<script>x</script>',
    })
    expect(html).toContain('Hey check this out!')
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })

  it('renders the brand logo as a hosted image scoped to the share URL origin', () => {
    const { html } = buildInviteEmail({
      mapTitle: 'F1',
      inviterName: 'AeroDynamics',
      role: 'EDITOR',
      shareUrl: 'https://neuro-canvas.com/s/mv4M7Ar8r9xlTdz',
    })
    expect(html).toContain('<img src="https://neuro-canvas.com/icon-512.png"')
    expect(html).toContain('alt="NeuroCanvas"')
    // No empty placeholder square in its place anymore
    expect(html).not.toContain('background:linear-gradient(135deg,#00D2BE,#00A89A);border-radius:12px;margin-bottom:16px;"></div>')
  })

  it('falls back to the brand-colour block when the share URL has no parseable origin', () => {
    const { html } = buildInviteEmail({
      mapTitle: 'X',
      inviterName: 'A',
      role: 'VIEWER',
      shareUrl: 'not-a-url',
    })
    expect(html).not.toContain('<img src=')
    expect(html).toContain('background:linear-gradient(135deg,#00D2BE,#00A89A)')
  })

  it('omits the note block when no note is supplied', () => {
    const { html } = buildInviteEmail({
      mapTitle: 'My Map',
      inviterName: 'Vanja',
      role: 'EDITOR',
      shareUrl: 'https://neuro-canvas.com/s/abc',
    })
    // The note block uses a left-border accent — its absence means no leftover styles
    expect(html).not.toContain('border-left:3px solid')
  })
})
