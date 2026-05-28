import { describe, it, expect } from 'vitest'
import { safeImageUrl } from '../safeUrl'

describe('safeImageUrl', () => {
  it('accepts plain https URLs', () => {
    expect(safeImageUrl('https://lh3.googleusercontent.com/a/abc')).toBe('https://lh3.googleusercontent.com/a/abc')
    expect(safeImageUrl('https://avatars.githubusercontent.com/u/1')).toBe('https://avatars.githubusercontent.com/u/1')
  })

  it('accepts plain http URLs', () => {
    expect(safeImageUrl('http://example.com/avatar.png')).toBe('http://example.com/avatar.png')
  })

  it('rejects javascript: URIs', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeImageUrl('JAVASCRIPT:alert(1)')).toBeNull()
    expect(safeImageUrl('  javascript:alert(1)  ')).toBeNull()
  })

  it('rejects data: URLs that are not image payloads', () => {
    expect(safeImageUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeImageUrl('data:application/javascript,alert(1)')).toBeNull()
  })

  it('accepts safe data:image/ URIs', () => {
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    expect(safeImageUrl(tinyPng)).toBe(tinyPng)
    const tinyJpeg = 'data:image/jpeg;base64,/9j/4AAQ'
    expect(safeImageUrl(tinyJpeg)).toBe(tinyJpeg)
  })

  it('rejects relative paths', () => {
    expect(safeImageUrl('/avatars/123.png')).toBeNull()
    expect(safeImageUrl('avatars/123.png')).toBeNull()
    expect(safeImageUrl('../secret')).toBeNull()
  })

  it('rejects empty / whitespace / non-string', () => {
    expect(safeImageUrl('')).toBeNull()
    expect(safeImageUrl('   ')).toBeNull()
    expect(safeImageUrl(null)).toBeNull()
    expect(safeImageUrl(undefined)).toBeNull()
    expect(safeImageUrl(42 as unknown)).toBeNull()
    expect(safeImageUrl({} as unknown)).toBeNull()
  })

  it('rejects file: / vbscript: / ftp: protocols', () => {
    expect(safeImageUrl('file:///etc/passwd')).toBeNull()
    expect(safeImageUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeImageUrl('ftp://example.com/avatar.png')).toBeNull()
  })

  it('rejects malformed URLs that throw in URL parser', () => {
    expect(safeImageUrl('https://')).toBeNull()
  })
})
