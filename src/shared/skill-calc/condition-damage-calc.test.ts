import { describe, expect, it } from 'vitest'
import { CONDITION_DAMAGE_FORMULAS, CONFUSION_DAMAGE_FORMULA, conditionDamageValue } from './condition-damage-calc'

/**
 * Regression guard for TODO.md's "condition-damage skills" item, Leg 1: the 5 damaging conditions'
 * fixed per-stack formulas, wiki-verified via raw wikitext 2026-08-29 (see `condition-damage-calc.ts`'s
 * own top comment for sourcing). Base values (0 Condition Damage) and one round-number scaling check
 * per formula, both taken directly from each condition's own wiki page.
 */
describe('CONDITION_DAMAGE_FORMULAS', () => {
  it('Bleeding: 22 base, +0.06/point, no mode split', () => {
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS.Bleeding, 0)).toBe(22)
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS.Bleeding, 1000)).toBe(82)
  })

  it('Burning: 131 base, +0.155/point, no mode split', () => {
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS.Burning, 0)).toBe(131)
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS.Burning, 1000)).toBe(286)
  })

  it('Poisoned: 33.5 base, +0.06/point, no mode split', () => {
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS.Poisoned, 0)).toBe(34) // rounds 33.5 -> 34
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS.Poisoned, 1000)).toBe(94)
  })

  it('Torment (Moving), WvW+PvP: 19.8 base, +0.054/point', () => {
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS['Torment (Moving)'], 0)).toBe(20) // rounds 19.8 -> 20
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS['Torment (Moving)'], 1000)).toBe(74)
  })

  it('Torment (Stationary), WvW+PvP: 26 base, +0.07/point', () => {
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS['Torment (Stationary)'], 0)).toBe(26)
    expect(conditionDamageValue(CONDITION_DAMAGE_FORMULAS['Torment (Stationary)'], 1000)).toBe(96)
  })
})

describe('CONFUSION_DAMAGE_FORMULA', () => {
  it('DoT half, WvW+PvP: flat 10/stack/second, does not scale with Condition Damage at all', () => {
    expect(conditionDamageValue(CONFUSION_DAMAGE_FORMULA.dot, 0)).toBe(10)
    expect(conditionDamageValue(CONFUSION_DAMAGE_FORMULA.dot, 1000)).toBe(10)
  })

  it('on-activation half, WvW+PvP: 49.5 base, +0.0975/point, per stack per activation', () => {
    expect(conditionDamageValue(CONFUSION_DAMAGE_FORMULA.onActivation, 0)).toBe(50) // rounds 49.5 -> 50
    expect(conditionDamageValue(CONFUSION_DAMAGE_FORMULA.onActivation, 1000)).toBe(147)
  })
})
