import { describe, it, expect } from 'vitest'
import { signFlushBody, verifyFlushSignature } from '../collabAuth'

const SECRET = 'test-secret-32-chars-minimum-aaaa'

describe('collabAuth', () => {
  it('signs and verifies a body successfully', () => {
    const body = Buffer.from('hello world')
    const sig = signFlushBody(body, SECRET)
    expect(verifyFlushSignature(body, sig, SECRET)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const body = Buffer.from('hello world')
    const sig = signFlushBody(body, SECRET)
    expect(verifyFlushSignature(Buffer.from('hello world!'), sig, SECRET)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const body = Buffer.from('hello world')
    const sig = signFlushBody(body, SECRET)
    expect(verifyFlushSignature(body, sig, 'wrong-secret-xxxxxxxxxxxxxxxxxxx')).toBe(false)
  })

  it('rejects a malformed signature without throwing', () => {
    const body = Buffer.from('hello world')
    expect(verifyFlushSignature(body, 'deadbeef', SECRET)).toBe(false)
  })
})
