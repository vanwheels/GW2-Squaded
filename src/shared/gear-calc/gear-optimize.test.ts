import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { GameData } from '../types'
import { statComboContribution } from './attribute-totals'
import { dominates, pruneDominated, type SearchOption } from './gear-optimize'

/**
 * Regression coverage for the Pareto-dominance pruning added 2026-08-23 — see that same date's
 * TODO.md entry. Found diagnosing a truncated Gear Optimizer run that returned Rampager's pieces
 * in a Power Virtuoso build that wasn't tracking Condition Damage at all: Rampager's (Power 0.25 /
 * Precision 0.35 / ConditionDamage 0.25) is strictly dominated by Assassin's (Power 0.25 /
 * Precision 0.35 / CritDamage 0.25) whenever Condition Damage isn't a floor/target, since the two
 * are identical on Power and Precision and Assassin's also gives CritDamage for free. A fully-run
 * search should never pick a dominated option — this makes that guarantee unconditional (holds
 * even under `NODE_LIMIT` truncation) by removing the dominated option from the candidate list
 * before the solver ever runs.
 */

function opt(id: number, deltas: number[]): SearchOption {
  return { id, label: String(id), deltas }
}

describe('dominates', () => {
  it('is true when one option is >= on every metric and > on at least one', () => {
    expect(dominates(opt(1, [10, 5]), opt(2, [8, 5]))).toBe(true)
    expect(dominates(opt(1, [10, 5]), opt(2, [8, 3]))).toBe(true)
  })

  it('is false for two options that are each better on a different metric', () => {
    expect(dominates(opt(1, [10, 3]), opt(2, [8, 5]))).toBe(false)
    expect(dominates(opt(2, [8, 5]), opt(1, [10, 3]))).toBe(false)
  })

  it('is false for two options with identical deltas (neither is strictly better)', () => {
    expect(dominates(opt(1, [10, 5]), opt(2, [10, 5]))).toBe(false)
  })
})

describe('pruneDominated', () => {
  it('drops an option strictly dominated by another', () => {
    const rampagerLike = opt(1, [10, 5, 0]) // Power, Precision, CritDamage — no CritDamage
    const assassinLike = opt(2, [10, 5, 3]) // same Power/Precision, plus CritDamage for free
    const result = pruneDominated([rampagerLike, assassinLike])
    expect(result.map((o) => o.id)).toEqual([2])
  })

  it('keeps every option when none dominates another (incomparable, e.g. Berserker vs. Dragon-shaped trade-offs)', () => {
    const powerHeavy = opt(1, [10, 3])
    const critHeavy = opt(2, [7, 6])
    const result = pruneDominated([powerHeavy, critHeavy])
    expect(result.map((o) => o.id).sort()).toEqual([1, 2])
  })

  it('keeps both options when their deltas are identical (nothing to prune)', () => {
    const a = opt(1, [10, 5])
    const b = opt(2, [10, 5])
    const result = pruneDominated([a, b])
    expect(result.map((o) => o.id).sort()).toEqual([1, 2])
  })
})

describe('pruneDominated against real itemstats.json (Rampager vs. Assassin\'s)', () => {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const itemStats = JSON.parse(
    readFileSync(resolve(__dirname, '../../../data/game-data/itemstats.json'), 'utf-8')
  ) as GameData['itemStats']

  // Real ids confirmed 2026-08-23 to be legal for the same slot category (armorWeapon) — same
  // Power (0.25) and Precision (0.35) multipliers; Rampager's spends its 3rd stat on Condition
  // Damage, Assassin's spends it on CritDamage instead.
  const RAMPAGER_ARMOR_ID = 159
  const ASSASSIN_ARMOR_ID = 753

  it('removes Rampager\'s from a helm-slot candidate list once Condition Damage is untracked', () => {
    const rampager = itemStats.find((s) => s.id === RAMPAGER_ARMOR_ID)
    const assassin = itemStats.find((s) => s.id === ASSASSIN_ARMOR_ID)
    expect(rampager).toBeDefined()
    expect(assassin).toBeDefined()

    // Mirrors statOptionsFor's own delta shape: one number per relevant metric, in this case
    // [Power, Precision (crit chance), CritDamage] — deliberately NOT including Condition Damage,
    // matching a run where it's neither a floor nor a maximize target.
    const relevantPoints = (stat: NonNullable<typeof rampager>): number[] => {
      const totals = statComboContribution(stat, 'armorHelm')
      return [totals.points.Power ?? 0, totals.points.Precision ?? 0, totals.points.CritDamage ?? 0]
    }

    const options = [opt(RAMPAGER_ARMOR_ID, relevantPoints(rampager!)), opt(ASSASSIN_ARMOR_ID, relevantPoints(assassin!))]
    const survivors = pruneDominated(options)

    expect(survivors.map((o) => o.id)).toEqual([ASSASSIN_ARMOR_ID])
  })
})
