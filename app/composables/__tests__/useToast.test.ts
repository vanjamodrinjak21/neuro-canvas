import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useToast } from '../useToast'

describe('useToast', () => {
  beforeEach(() => {
    const { toasts, dismiss } = useToast()
    // Clear any leftover toasts between tests
    for (const t of [...toasts.value]) dismiss(t.id)
  })

  it('pushes a toast with the correct kind and message', () => {
    const { error, toasts } = useToast()
    const id = error('Boom')
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]).toMatchObject({ id, kind: 'error', message: 'Boom' })
  })

  it('dismisses a toast by id', () => {
    const { warning, dismiss, toasts } = useToast()
    const id = warning('Heads up')
    expect(toasts.value).toHaveLength(1)
    dismiss(id)
    expect(toasts.value).toHaveLength(0)
  })

  it('shares state across composable calls (singleton)', () => {
    const a = useToast()
    const b = useToast()
    a.info('Hello')
    expect(b.toasts.value).toHaveLength(1)
    b.dismiss(b.toasts.value[0]!.id)
    expect(a.toasts.value).toHaveLength(0)
  })

  it('auto-dismisses after the given TTL', () => {
    vi.useFakeTimers()
    const { success, toasts } = useToast()
    success('Saved', 1000)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1100)
    expect(toasts.value).toHaveLength(0)
    vi.useRealTimers()
  })

  it('does not auto-dismiss when ttl is 0', () => {
    vi.useFakeTimers()
    const { error, toasts } = useToast()
    error('Sticky', 0)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(10_000)
    expect(toasts.value).toHaveLength(1)
    vi.useRealTimers()
  })
})
