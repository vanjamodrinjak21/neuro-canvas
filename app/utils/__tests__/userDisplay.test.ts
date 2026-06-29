import { describe, it, expect } from 'vitest'
import { getUserInitials, formatRelativeDay } from '../userDisplay'

describe('getUserInitials', () => {
  it('takes first letters of the first two whitespace-separated tokens', () => {
    expect(getUserInitials('Vanja Modrinjak')).toBe('VM')
    expect(getUserInitials('ada b c')).toBe('AB')
  })

  it('handles a single token as one letter', () => {
    expect(getUserInitials('Vanja')).toBe('V')
  })

  it('treats @ as a separator (email-aware)', () => {
    expect(getUserInitials('vanja@example.com')).toBe('VE')
  })

  it('falls back when empty/nullish, honoring a custom fallback', () => {
    expect(getUserInitials('')).toBe('U')
    expect(getUserInitials(null)).toBe('U')
    expect(getUserInitials(undefined)).toBe('U')
    expect(getUserInitials('   ')).toBe('U')
    expect(getUserInitials('', 'NC')).toBe('NC')
  })
})

describe('formatRelativeDay', () => {
  const t = (key: string, named?: Record<string, unknown>) =>
    named ? `${key}:${JSON.stringify(named)}` : key
  const DAY = 86_400_000

  it('labels today / yesterday / N days ago within a week', () => {
    expect(formatRelativeDay(Date.now(), t)).toBe('common.time.today')
    expect(formatRelativeDay(Date.now() - DAY, t)).toBe('common.time.yesterday')
    expect(formatRelativeDay(Date.now() - 3 * DAY, t)).toBe('common.time.days_ago:{"n":3}')
  })

  it('returns an absolute date beyond a week', () => {
    const out = formatRelativeDay(Date.now() - 30 * DAY, t)
    expect(out).not.toContain('common.time')
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns empty string for unparseable input', () => {
    expect(formatRelativeDay('not-a-date', t)).toBe('')
  })
})
