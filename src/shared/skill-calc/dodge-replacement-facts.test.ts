import { describe, expect, it } from 'vitest'
import { vindicatorDodgeContent } from './dodge-replacement-facts'

/**
 * Known Exceptions Sweep Leg 6 (2026-09-29) regression guard: Reaver's Curse (2259) triples Saint of
 * zu Heltzer's Saint's Shield healing/barrier (base + 200% WvW increase) when both traits are
 * equipped, and leaves it untouched otherwise.
 */

const TENACIOUS_RUIN_ID = 2262
const SAINT_OF_ZU_HELTZER_ID = 2238
const REAVERS_CURSE_ID = 2259

const DURATION_PERCENT = { boon: 0, condition: 0 }

function healAndBarrierValue(activeIds: ReadonlySet<number>, healingPower: number): number {
  const content = vindicatorDodgeContent(activeIds, 1000, healingPower, 2597, DURATION_PERCENT)
  const healingLine = content?.numericLines.find((l) => l.text.startsWith('Healing:'))
  expect(healingLine).toBeDefined()
  return Number(healingLine!.text.replace('Healing: ', '').replace(/,/g, ''))
}

describe('vindicatorDodgeContent Saint of zu Heltzer + Reaver\'s Curse interaction', () => {
  it('uses the unmodified 300 + 0.3*healingPower formula without Reaver\'s Curse', () => {
    const activeIds = new Set([TENACIOUS_RUIN_ID, SAINT_OF_ZU_HELTZER_ID])
    expect(healAndBarrierValue(activeIds, 1000)).toBe(600)
  })

  it('triples the healing/barrier value when Reaver\'s Curse is also equipped', () => {
    const activeIds = new Set([TENACIOUS_RUIN_ID, SAINT_OF_ZU_HELTZER_ID, REAVERS_CURSE_ID])
    expect(healAndBarrierValue(activeIds, 1000)).toBe(1800)
  })

  it('has no effect on the other 2 GM dodge-replacements (Damage Increase pair out of scope)', () => {
    const forerunnerBase = vindicatorDodgeContent(new Set([TENACIOUS_RUIN_ID, 2257]), 1000, 1000, 2597, DURATION_PERCENT)
    const forerunnerWithCurse = vindicatorDodgeContent(new Set([TENACIOUS_RUIN_ID, 2257, REAVERS_CURSE_ID]), 1000, 1000, 2597, DURATION_PERCENT)
    expect(forerunnerWithCurse?.numericLines).toEqual(forerunnerBase?.numericLines)
  })
})
