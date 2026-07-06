// streamBudget — resource caps for the /api/ai/stream SSE proxy (AER-81).
// A hung or malicious upstream (custom baseUrl is user-supplied) must not be
// able to hold the connection or push bytes indefinitely.

import { describe, it, expect } from 'vitest'
import { createStreamBudget } from '../streamBudget'

describe('createStreamBudget', () => {
  it('returns null while within both budgets', () => {
    const budget = createStreamBudget({ maxMs: 1000, maxBytes: 100, now: () => 0 })
    expect(budget.consume(50)).toBeNull()
    expect(budget.consume(50)).toBeNull()
  })

  it('reports a size violation once forwarded bytes exceed the cap', () => {
    const budget = createStreamBudget({ maxMs: 1000, maxBytes: 100, now: () => 0 })
    expect(budget.consume(100)).toBeNull()
    expect(budget.consume(1)).toMatch(/output limit/)
  })

  it('reports a duration violation once the clock exceeds the cap', () => {
    let t = 0
    const budget = createStreamBudget({ maxMs: 1000, maxBytes: 1_000_000, now: () => t })
    expect(budget.consume(10)).toBeNull()
    t = 1001
    expect(budget.consume(10)).toMatch(/minute limit/)
  })

  it('defaults to 5 minutes and 2 MB', () => {
    const budget = createStreamBudget({ now: () => 0 })
    expect(budget.consume(2_000_000)).toBeNull()
    expect(budget.consume(1)).toMatch(/2 MB/)
  })
})
