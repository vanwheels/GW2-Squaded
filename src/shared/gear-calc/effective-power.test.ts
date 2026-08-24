import { describe, expect, it } from 'vitest'
import type { Build, ItemStat } from '../types'
import { DEFAULT_COMBAT_STATE } from './combat-state'
import { effectivePowerValue, effectivePowerWeights, optimizeGear, type OptimizerInput } from './gear-optimize'

/**
 * Coverage for the `EffectivePower` composite maximize-target added 2026-08-23 — see that same
 * date's TODO.md entry and COMPLETED.md for the Power-vs-Ferocity marginal-value math this
 * implements. `effectivePowerValue`/`effectivePowerWeights` are the pure formula (and its linear
 * approximation's partial derivatives) the rest of this test suite, and `optimizeGear`'s own
 * search, build on.
 */

describe('effectivePowerValue', () => {
  it('matches the "100% effective crit" formula worked out for the user (Power × (1.5 + Ferocity/1500)) at 100% crit chance', () => {
    // At CC=100%, CD%=150 (base, i.e. Ferocity=0): value should reduce to Power × 1.5.
    expect(effectivePowerValue(2500, 100, 150)).toBeCloseTo(2500 * 1.5, 5)
    // CD%=200 corresponds to Ferocity=750 (BASE_CRITICAL_DAMAGE_PERCENT=150, 15 Ferocity per %) —
    // 1.5 + 750/1500 = 1.5 + 0.5 = 2.0, matching Damage ∝ Power × (1.5 + Ferocity/1500).
    expect(effectivePowerValue(2500, 100, 200)).toBeCloseTo(2500 * 2.0, 5)
  })

  it('reduces to plain Power at 0% crit chance (crit damage is irrelevant if you never crit)', () => {
    expect(effectivePowerValue(2500, 0, 250)).toBeCloseTo(2500, 5)
  })

  it('interpolates between 0% and 100% crit chance', () => {
    // Half the crit chance means half the crit-damage bonus is realized on average.
    const full = effectivePowerValue(2500, 100, 200)
    const half = effectivePowerValue(2500, 50, 200)
    const none = effectivePowerValue(2500, 0, 200)
    expect(half).toBeCloseTo((full + none) / 2, 5)
  })

  it('clamps crit chance above 100% (no marginal value from over-capped crit chance)', () => {
    expect(effectivePowerValue(2500, 150, 200)).toBeCloseTo(effectivePowerValue(2500, 100, 200), 5)
  })
})

describe('effectivePowerWeights', () => {
  it("matches effectivePowerValue's own partial derivative w.r.t. Power directly", () => {
    const point = { power: 2500, criticalChancePercent: 60, criticalDamagePercent: 175 }
    const weights = effectivePowerWeights(point)
    // d(effectivePowerValue)/dPower at fixed CC/CD is exactly the bracketed multiplier itself.
    const h = 1
    const numericPowerSlope = (effectivePowerValue(point.power + h, point.criticalChancePercent, point.criticalDamagePercent) - effectivePowerValue(point.power, point.criticalChancePercent, point.criticalDamagePercent)) / h
    expect(weights.power).toBeCloseTo(numericPowerSlope, 5)
  })

  it('zeroes the Precision weight once crit chance is already at/above 100% (no marginal value left to buy)', () => {
    const weights = effectivePowerWeights({ power: 2500, criticalChancePercent: 100, criticalDamagePercent: 200 })
    expect(weights.precision).toBe(0)
    // Ferocity still has marginal value at 100% crit chance — every hit is already a crit.
    expect(weights.ferocity).toBeGreaterThan(0)
  })

  it('gives Precision/Ferocity weights that grow with Power (a higher-Power build values crit stats more)', () => {
    const lowPower = effectivePowerWeights({ power: 1000, criticalChancePercent: 50, criticalDamagePercent: 175 })
    const highPower = effectivePowerWeights({ power: 3000, criticalChancePercent: 50, criticalDamagePercent: 175 })
    expect(highPower.precision).toBeGreaterThan(lowPower.precision)
    expect(highPower.ferocity).toBeGreaterThan(lowPower.ferocity)
  })
})

function makeBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'test-build',
    name: 'Test',
    notes: '',
    profession: 'Guardian',
    specializations: [null, null, null],
    skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: null },
    equipment: {},
    relicId: null,
    foodId: null,
    utilityId: null,
    environment: 'land',
    activeWeaponSet: 'A',
    activeUnderwaterSet: 'U1',
    equippedPetIds: [null, null],
    activePetIndex: 0,
    activeBundleSkillId: null,
    rangerUnleashed: false,
    familiarId: null,
    activeAttunement: 'Fire',
    weaverPreviousAttunement: null,
    thiefStolenSkillId: null,
    vindicatorAspectFlipped: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedAtGw2Build: null,
    tags: [],
    order: 0,
    favorite: false,
    ...overrides
  }
}

// Two synthetic stat combos (bigger total budget than any real GW2 prefix, but that's irrelevant
// here — only their relative shape matters): one pure Power, one that trades some Power for
// Precision+CritDamage. Verified numerically (not just asserted) that stacking every armor/trinket
// slot into the crit-leaning combo achieves higher TRUE Effective Power than stacking every slot
// into pure Power — exercising the actual crossover the Power-vs-Ferocity math (see TODO.md/
// COMPLETED.md, 2026-08-23) predicts. A raw-Power-only search can't see this trade at all, since
// Precision/CritDamage never show up in `relevant` unless something asks for them.
const POWER_COMBO: ItemStat = { id: 1, name: 'Synthetic Power', attributes: [{ attribute: 'Power', multiplier: 1, value: 0 }] }
const CRIT_COMBO: ItemStat = {
  id: 2,
  name: 'Synthetic Crit',
  attributes: [
    { attribute: 'Power', multiplier: 0.8, value: 0 },
    { attribute: 'Precision', multiplier: 0.4, value: 0 },
    { attribute: 'CritDamage', multiplier: 0.4, value: 0 }
  ]
}

const GAME_DATA: OptimizerInput['gameData'] = {
  itemStats: [POWER_COMBO, CRIT_COMBO],
  itemStatLegalIds: { armorWeapon: [1, 2], trinket: [1, 2] },
  professions: [],
  infusions: [],
  runes: [],
  sigils: [],
  food: [],
  utility: [],
  traits: [],
  legends: []
}

describe('optimizeGear with EffectivePower as the maximize target', () => {
  const build = makeBuild({ equipment: {} })
  const baseInput: Omit<OptimizerInput, 'targets'> = {
    build,
    gameData: GAME_DATA,
    combatState: DEFAULT_COMBAT_STATE,
    floors: [],
    optimizeFoodUtility: false,
    optimizeRunesInfusions: false
  }

  it("achieves at least as much true Effective Power as maximizing raw Power alone — and strictly more in a scenario where crit stats are worth stacking", () => {
    const powerOnly = optimizeGear({ ...baseInput, targets: ['Power'] })
    const effectivePower = optimizeGear({ ...baseInput, targets: ['EffectivePower'] })

    expect(powerOnly.feasible).toBe(true)
    expect(effectivePower.feasible).toBe(true)

    const powerOnlyTrueValue = effectivePowerValue(
      powerOnly.metricValues.Power ?? 0,
      powerOnly.metricValues.CriticalChancePercent ?? 0,
      powerOnly.metricValues.CriticalDamagePercent ?? 0
    )

    // A raw-Power-only search can't see Precision/CritDamage at all (they're outside `relevant`),
    // so every slot should land on the pure-Power combo — no crit stats gained over baseline.
    expect(powerOnly.metricValues.CriticalChancePercent).toBeCloseTo(5, 1) // BASE_CRITICAL_CHANCE_PERCENT, untouched
    expect(powerOnly.metricValues.CriticalDamagePercent).toBeCloseTo(150, 1) // BASE_CRITICAL_DAMAGE_PERCENT, untouched

    // The EffectivePower-targeted search's own reported metric is the TRUE (non-approximated)
    // value — sanity-check it against the same formula computed from its own final Power/CC/CD.
    expect(effectivePower.metricValues.EffectivePower).toBeCloseTo(
      effectivePowerValue(
        effectivePower.metricValues.Power ?? 0,
        effectivePower.metricValues.CriticalChancePercent ?? 0,
        effectivePower.metricValues.CriticalDamagePercent ?? 0
      ),
      3
    )

    // The whole point: chasing real damage finds a better answer than chasing raw Power ever could.
    expect(effectivePower.metricValues.EffectivePower ?? 0).toBeGreaterThan(powerOnlyTrueValue)
  })
})
