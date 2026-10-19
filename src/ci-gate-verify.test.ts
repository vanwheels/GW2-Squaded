import { describe, it, expect } from 'vitest'

describe('ci gate verification (temporary, do not merge)', () => {
  it('deliberately fails to prove the CI gate blocks a broken build', () => {
    expect(1).toBe(2)
  })
})
