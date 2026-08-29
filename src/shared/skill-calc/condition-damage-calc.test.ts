import { describe, expect, it } from 'vitest'
import { CONDITION_DAMAGE_FORMULAS, CONFUSION_DAMAGE_FORMULA, conditionDamagePerStack, conditionDamageValue } from './condition-damage-calc'

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

/**
 * Leg 2 (2026-08-28): `conditionDamagePerStack` is the `BoonConditionSource.boonOrConditionName` ->
 * displayed-value lookup `SkillsEditor.tsx`'s tooltip actually calls. Its 2 non-obvious resolutions
 * (Torment always stationary, Confusion DoT-only) are user-directed decisions — see
 * `condition-damage-calc.ts`'s own top comment for the full reasoning.
 */
describe('conditionDamagePerStack', () => {
  it('Bleeding/Burning/Poisoned pass straight through to their own formula', () => {
    expect(conditionDamagePerStack('Bleeding', 1000)).toBe(82)
    expect(conditionDamagePerStack('Burning', 1000)).toBe(286)
    expect(conditionDamagePerStack('Poisoned', 1000)).toBe(94)
  })

  it('Torment always resolves to the Stationary value, never Moving', () => {
    expect(conditionDamagePerStack('Torment', 1000)).toBe(96) // Torment (Stationary) at 1000, not 74 (Moving)
  })

  it('Confusion resolves to its DoT half only — flat 10, ignores Condition Damage', () => {
    expect(conditionDamagePerStack('Confusion', 0)).toBe(10)
    expect(conditionDamagePerStack('Confusion', 1000)).toBe(10) // NOT 147 (the on-activation half)
  })

  it('returns null for every boon name and any other status this table does not cover', () => {
    expect(conditionDamagePerStack('Might', 1000)).toBeNull()
    expect(conditionDamagePerStack('Vulnerability', 1000)).toBeNull()
  })
})
