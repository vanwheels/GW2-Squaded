import { describe, expect, it } from 'vitest'
import type { Build, ItemStat, Profession, Trait } from '../types'
import { DEFAULT_COMBAT_STATE } from './combat-state'
import { optimizeGear, type OptimizerInput } from './gear-optimize'

/**
 * Coverage for "trait conversions credited during search, not just in the final result", added
 * 2026-08-23 after the user flagged Virtuoso's Quiet Intensity (real trait id 2193, curated in
 * `trait-attributes.ts`'s `CURATED_CONVERSIONS`: 10% of Vitality -> CritDamage) as "something that
 * would play a decent factor in how gear is calculated." Before this fix, the search's own
 * slot-by-slot comparisons only ever looked at a candidate's DIRECT attribute contribution — a
 * Vitality-carrying stat combo's indirect Ferocity bonus from this trait was invisible to `solve()`/
 * `pruneDominated`, even though the FINAL reported `metricValues` always included it (computed from
 * the actual resulting build via `applyTraitBonuses`/`applyConversions`). That meant the search could
 * settle on a genuinely suboptimal combination for a Ferocity-sensitive target on this spec. Since a
 * source->target percent conversion is linear, crediting it independently to the baseline and to
 * every option's own delta and summing reproduces the exact true value — no approximation needed,
 * unlike `EffectivePower`'s nonlinear composite (see `effective-power.test.ts`).
 */

function makeBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'test-build',
    name: 'Test',
    notes: '',
    profession: 'Mesmer',
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

const PROFESSION: Profession = {
  id: 'Mesmer',
  name: 'Mesmer',
  icon: '',
  iconBig: '',
  tangoIcon: '',
  specializationIds: [],
  weapons: {},
  professionSkills: [],
  code: 7,
  skillPalette: []
}

// Quiet Intensity (Mesmer, Virtuoso, Minor GM): "Gain ferocity based on your vitality." Real
// specializationId irrelevant here — just needs to match the build's equipped line so
// `activeTraitIds` treats this always-on minor trait as active.
const VIRTUOSO_SPEC_ID = 99
const QUIET_INTENSITY_TRAIT: Trait = {
  id: 2193,
  tier: 3,
  order: 0,
  name: 'Quiet Intensity',
  description: 'Gain ferocity based on your vitality.',
  slot: 'Minor',
  specializationId: VIRTUOSO_SPEC_ID,
  icon: '',
  facts: [],
  traitedFacts: []
}

// A pure-Ferocity combo (id 1) vs. a pure-Vitality combo (id 2) with a MUCH bigger multiplier —
// large enough that 10% of its Vitality contribution (the trait's conversion) exceeds combo 1's
// entire direct CritDamage contribution. Neither combo touches any other attribute, and only
// CriticalDamagePercent is tracked, so this is a clean, unambiguous "which wins" comparison: with
// the conversion credited, combo 2 should strictly beat combo 1; without it, combo 2 contributes
// nothing to the only tracked metric and should never be chosen.
const FEROCITY_COMBO: ItemStat = { id: 1, name: 'Synthetic Ferocity', attributes: [{ attribute: 'CritDamage', multiplier: 0.35, value: 0 }] }
const VITALITY_COMBO: ItemStat = { id: 2, name: 'Synthetic Vitality', attributes: [{ attribute: 'Vitality', multiplier: 5, value: 0 }] }

function gameDataWith(traits: Trait[]): OptimizerInput['gameData'] {
  return {
    itemStats: [FEROCITY_COMBO, VITALITY_COMBO],
    itemStatLegalIds: { armorWeapon: [1, 2], trinket: [1, 2] },
    professions: [PROFESSION],
    infusions: [],
    runes: [],
    sigils: [],
    food: [],
    utility: [],
    traits,
    legends: []
  }
}

const baseInput: Omit<OptimizerInput, 'gameData' | 'build'> = {
  combatState: DEFAULT_COMBAT_STATE,
  floors: [],
  targets: ['CriticalDamagePercent'],
  optimizeFoodUtility: false,
  optimizeRunesInfusions: false
}

describe('Gear Optimizer credits active trait conversions during search, not just in the final result', () => {
  it('prefers the Vitality combo over the direct-Ferocity combo once Quiet Intensity is active', () => {
    const build = makeBuild({
      specializations: [{ specializationId: VIRTUOSO_SPEC_ID, chosenTraitIds: [null, null, null] }, null, null]
    })
    const result = optimizeGear({ ...baseInput, build, gameData: gameDataWith([QUIET_INTENSITY_TRAIT]) })
    expect(result.feasible).toBe(true)
    const gearSlots = result.slots.filter((s) => s.kind === undefined)
    expect(gearSlots.length).toBeGreaterThan(0)
    expect(gearSlots.every((s) => s.chosenId === 2)).toBe(true)
  })

  it('never picks the Vitality combo without the trait active (it contributes nothing on its own)', () => {
    const build = makeBuild() // no specializations equipped
    const result = optimizeGear({ ...baseInput, build, gameData: gameDataWith([QUIET_INTENSITY_TRAIT]) })
    expect(result.feasible).toBe(true)
    const gearSlots = result.slots.filter((s) => s.kind === undefined)
    expect(gearSlots.length).toBeGreaterThan(0)
    expect(gearSlots.every((s) => s.chosenId === 1)).toBe(true)
  })
})
