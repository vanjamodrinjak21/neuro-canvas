import { describe, it, expect } from 'vitest'
import { isPrivateRelayEmail, resolveDisplayName, resolveInitials } from '../userDisplay'

// Sign in with Apple + "Hide My Email" hands back a random relay address like
// `hf2zj5rg97@privaterelay.appleid.com` and (because Apple only surfaces the
// name once, in a POST field next-auth v4 drops) no name. The old UI fell back
// to `email.split('@')[0]`, surfacing the meaningless `hf2zj5rg97` as the
// user's name everywhere. These tests lock in the rule: a relay local-part is
// NEVER shown as a name — we fall back to a clean, caller-supplied default.
describe('isPrivateRelayEmail', () => {
  it('detects Apple Hide-My-Email relay addresses', () => {
    expect(isPrivateRelayEmail('hf2zj5rg97@privaterelay.appleid.com')).toBe(true)
    expect(isPrivateRelayEmail('ABC@PrivateRelay.AppleID.com')).toBe(true)
  })

  it('treats normal addresses as non-relay', () => {
    expect(isPrivateRelayEmail('vanja@gmail.com')).toBe(false)
    expect(isPrivateRelayEmail('person@company.io')).toBe(false)
  })

  it('is false for empty / missing email', () => {
    expect(isPrivateRelayEmail('')).toBe(false)
    expect(isPrivateRelayEmail(null)).toBe(false)
    expect(isPrivateRelayEmail(undefined)).toBe(false)
  })

  it('is not fooled by a relay domain in the local part', () => {
    expect(isPrivateRelayEmail('privaterelay.appleid.com@evil.com')).toBe(false)
  })
})

describe('resolveDisplayName', () => {
  it('prefers an explicit name', () => {
    expect(resolveDisplayName({ name: 'Vanja Modrinjak', email: 'v@x.com' }, 'User')).toBe('Vanja Modrinjak')
  })

  it('derives from the local-part for real emails when no name is set', () => {
    expect(resolveDisplayName({ name: null, email: 'vanja@gmail.com' }, 'User')).toBe('vanja')
  })

  it('falls back to the default for Apple relay emails — never the relay handle', () => {
    expect(resolveDisplayName({ name: null, email: 'hf2zj5rg97@privaterelay.appleid.com' }, 'User')).toBe('User')
  })

  it('falls back to the default for the Tauri local-only sentinel', () => {
    expect(resolveDisplayName({ name: null, email: 'local@device' }, 'User')).toBe('User')
  })

  it('falls back to the default when nothing usable is present', () => {
    expect(resolveDisplayName({ name: '   ', email: null }, 'User')).toBe('User')
    expect(resolveDisplayName(null, 'User')).toBe('User')
    expect(resolveDisplayName(undefined, 'Korisnik')).toBe('Korisnik')
  })

  it('trims a whitespace-padded name', () => {
    expect(resolveDisplayName({ name: '  Ada  ', email: null }, 'User')).toBe('Ada')
  })
})

describe('resolveInitials', () => {
  it('uses first letters of the first two words', () => {
    expect(resolveInitials('Vanja Modrinjak')).toBe('VM')
  })

  it('uses the first two characters of a single word', () => {
    expect(resolveInitials('Ada')).toBe('AD')
  })

  it('uppercases', () => {
    expect(resolveInitials('user')).toBe('US')
  })

  it('returns the fallback for an empty name', () => {
    expect(resolveInitials('')).toBe('NC')
    expect(resolveInitials('   ', 'XX')).toBe('XX')
  })
})
