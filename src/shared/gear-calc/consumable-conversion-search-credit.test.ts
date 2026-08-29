import { describe, expect, it } from 'vitest'
import type { Build, Consumable, ItemStat, Profession } from '../types'
import { DEFAULT_COMBAT_STATE } from './combat-state'
import { optimizeGear, type OptimizerInput } from './gear-optimize'

/**
 * Coverage for the TODO.md "Gear Optimizer food/utility conversion credit" gap, closed 2026-08-28:
 * a candidate food/utility item's own "Gain X Equal to N% of Your Y" self-conversion (Superior
 * Sharpening Stone, Tuning Crystal, Maintenance Oil, etc. — a full catalog scan found 69 of 260
 * Utility items carry this shape, not the "1-2 candidates" the TODO note originally assumed) wasn't
 * credited during the optimizer's own search, only in the final reported `metricValues`. Two
 * distinct cases, both fixed in `gear-optimize.ts`:
 *
 * 1. `optimizeFoodUtility: false` (the item is FIXED, not itself a search variable) — exact, no
 *    approximation needed: its conversion is gear-independent from the search's point of view, so
 *    it's folded into the same `fixedConversions` list trait conversions already use (applied to
 *    both the baseline and every slot's own delta).
 * 2. `optimizeFoodUtility: true` (which food/utility item wins is itself being searched) — can't be
 *    exact in one pass (the source attribute's real final value isn't known until the rest of the
 *    build is solved too), so it's credited against an assumed snapshot that `optimizeGear`'s
 *    iteration loop refines from each pass' actual result, converging the same way the
 *    `EffectivePower` linearization loop does (see `effective-power.test.ts`).
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

function consumable(overrides: Partial<Consumable> & Pick<Consumable, 'id' | 'name' | 'bonuses'>): Consumable {
  return {
    icon: '',
    kind: 'Utility',
    rarity: 'Fine',
    effectName: 'Enhancement',
    durationMs: 1800000,
    applyCount: 1,
    description: '',
    sharedBuffSource: null,
    ...overrides
  }
}

// Synthetic "Superior Sharpening Stone"-shape item: no direct attribute bonus, just a self-
// conversion. 5% is large enough to make the arithmetic below easy to reason about without needing
// realistic in-game percentages.
const SHARPENING_STONE = consumable({
  id: 9001,
  name: 'Synthetic Sharpening Stone',
  bonuses: [{ raw: 'Gain Power Equal to 5% of Your Precision', attribute: 'Power', value: 5, isPercent: false, sourceAttribute: 'Precision' }]
})

describe('Gear Optimizer credits a FIXED (not searched) consumable self-conversion during search', () => {
  // A pure-Power combo (id 1) vs. a pure-Precision combo (id 2) with a big enough multiplier that
  // 5% of its Precision contribution (Sharpening Stone's conversion) exceeds combo 1's entire direct
  // Power contribution — same "which wins" shape as trait-conversion-search-credit.test.ts's
  // Ferocity/Vitality combos.
  const POWER_COMBO: ItemStat = { id: 1, name: 'Synthetic Power', attributes: [{ attribute: 'Power', multiplier: 0.35, value: 0 }] }
  // 5% of this combo's Precision must convert to more Power than combo 1 gives directly:
  // 0.05 * 20 = 1.0 > 0.35.
  const PRECISION_COMBO: ItemStat = { id: 2, name: 'Synthetic Precision', attributes: [{ attribute: 'Precision', multiplier: 20, value: 0 }] }

  function gameData(): OptimizerInput['gameData'] {
    return {
      itemStats: [POWER_COMBO, PRECISION_COMBO],
      itemStatLegalIds: { armorWeapon: [1, 2], trinket: [1, 2] },
      professions: [PROFESSION],
      infusions: [],
      runes: [],
      sigils: [],
      food: [],
      utility: [SHARPENING_STONE],
      traits: [],
      legends: []
    }
  }

  const baseInput: Omit<OptimizerInput, 'gameData' | 'build'> = {
    combatState: DEFAULT_COMBAT_STATE,
    floors: [],
    targets: ['Power'],
    optimizeFoodUtility: false,
    optimizeRunesInfusions: false
  }

  it('prefers the Precision combo over the direct-Power combo once the Sharpening Stone is equipped', () => {
    const build = makeBuild({ utilityId: SHARPENING_STONE.id })
    const result = optimizeGear({ ...baseInput, build, gameData: gameData() })
    expect(result.feasible).toBe(true)
    const gearSlots = result.slots.filter((s) => s.kind === undefined)
    expect(gearSlots.length).toBeGreaterThan(0)
    expect(gearSlots.every((s) => s.chosenId === 2)).toBe(true)
  })

  it('never picks the Precision combo without the Sharpening Stone equipped (it contributes nothing on its own)', () => {
    const build = makeBuild() // no utility equipped
    const result = optimizeGear({ ...baseInput, build, gameData: gameData() })
    expect(result.feasible).toBe(true)
    const gearSlots = result.slots.filter((s) => s.kind === undefined)
    expect(gearSlots.length).toBeGreaterThan(0)
    expect(gearSlots.every((s) => s.chosenId === 1)).toBe(true)
  })
})

describe('Gear Optimizer credits a SEARCHED consumable self-conversion, refining toward the true value', () => {
  // Gear has exactly one legal stat combo (Precision-heavy) so its contribution to the build's
  // final Precision total is deterministic and independent of anything the food/utility slots pick —
  // isolates the test to the utility slot's own choice. No weapon in `build.equipment`/
  // `PROFESSION.weapons`, so no weapon slot is searched (same convention as the trait-conversion test).
  const PRECISION_COMBO: ItemStat = { id: 2, name: 'Synthetic Precision', attributes: [{ attribute: 'Precision', multiplier: 5, value: 0 }] }

  // Flat +51 Power: strictly beats the Sharpening Stone's conversion credit on pass 1 (seeded from
  // the build's OWN pre-search totals — base Precision 1000 only, no gear yet — 5% of 1000 = 50 <
  // 51), but strictly loses on pass 2 once the assumption is refined to the actual resulting build's
  // Precision (base 1000 + a huge gear contribution from the only legal combo, since it's forced
  // onto every one of the 12 armor/trinket slots) — so this only picks Sharpening Stone if the
  // iteration loop actually re-solves against the real result, not just a single static pass.
  const PLAIN_POWER_UTILITY = consumable({
    id: 9002,
    name: 'Synthetic Plain Power Utility',
    bonuses: [{ raw: '+51 Power', attribute: 'Power', value: 51, isPercent: false, sourceAttribute: null }]
  })

  function gameData(): OptimizerInput['gameData'] {
    return {
      itemStats: [PRECISION_COMBO],
      itemStatLegalIds: { armorWeapon: [2], trinket: [2] },
      professions: [PROFESSION],
      infusions: [],
      runes: [],
      sigils: [],
      food: [],
      utility: [PLAIN_POWER_UTILITY, SHARPENING_STONE],
      traits: [],
      legends: []
    }
  }

  const baseInput: Omit<OptimizerInput, 'gameData' | 'build'> = {
    combatState: DEFAULT_COMBAT_STATE,
    floors: [],
    targets: ['Power'],
    optimizeFoodUtility: true,
    optimizeRunesInfusions: false
  }

  it('picks the Sharpening Stone once the assumed Precision value converges to the real (gear-inflated) total', () => {
    const build = makeBuild()
    const result = optimizeGear({ ...baseInput, build, gameData: gameData() })
    expect(result.feasible).toBe(true)
    expect(result.utilityId).toBe(SHARPENING_STONE.id)
  })
})
