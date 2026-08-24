import { describe, expect, it } from 'vitest'
import type { Build, ItemStat, Profession } from '../types'
import { DEFAULT_COMBAT_STATE } from './combat-state'
import { optimizeGear, type OptimizerInput } from './gear-optimize'

/**
 * Coverage for the "shared weapon prefix across all sets" change made 2026-08-23, following the
 * user's real in-game example: a Spellbreaker whose Greatsword (Set A) is Marauder but whose
 * Sword+Axe (Set B) are Berserker/Assassin's loses Health the instant they weapon-swap, since only
 * the currently-drawn set contributes to stats (`isActiveWeaponSlot`). Every weapon slot — main
 * hand, off hand, and both sets, active or not — should now receive the SAME chosen stat prefix.
 */

function makeBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'test-build',
    name: 'Test',
    notes: '',
    profession: 'Warrior',
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
  id: 'Warrior',
  name: 'Warrior',
  icon: '',
  iconBig: '',
  tangoIcon: '',
  specializationIds: [],
  weapons: {
    Greatsword: { flags: ['TwoHand'], specializationId: null, skills: [] },
    Sword: { flags: ['Mainhand'], specializationId: null, skills: [] },
    Axe: { flags: ['Offhand'], specializationId: null, skills: [] }
  },
  professionSkills: []
}

// Two synthetic stat combos with different shapes (one pure Power, one Power+Precision+CritDamage)
// so a search with freedom to mix would have a real incentive to split them across slots.
const POWER_COMBO: ItemStat = { id: 1, name: 'Synthetic Power', attributes: [{ attribute: 'Power', multiplier: 1, value: 0 }] }
const CRIT_COMBO: ItemStat = {
  id: 2,
  name: 'Synthetic Crit',
  attributes: [
    { attribute: 'Power', multiplier: 0.6, value: 0 },
    { attribute: 'Precision', multiplier: 0.2, value: 0 },
    { attribute: 'CritDamage', multiplier: 0.2, value: 0 }
  ]
}

const GAME_DATA: OptimizerInput['gameData'] = {
  itemStats: [POWER_COMBO, CRIT_COMBO],
  itemStatLegalIds: { armorWeapon: [1, 2], trinket: [1, 2] },
  professions: [PROFESSION],
  infusions: [],
  runes: [],
  sigils: [],
  food: [],
  utility: [],
  traits: [],
  legends: []
}

describe('Gear Optimizer weapon slots share one stat prefix across sets', () => {
  it("locks a one-handed main/off pair to the same prefix (no independent split)", () => {
    const build = makeBuild({
      equipment: {
        weaponA1: { itemStatId: null, weaponType: 'Sword' },
        weaponA2: { itemStatId: null, weaponType: 'Axe' }
      }
    })
    const input: OptimizerInput = {
      build,
      gameData: GAME_DATA,
      combatState: DEFAULT_COMBAT_STATE,
      floors: [{ metric: 'CriticalChancePercent', value: 10 }],
      targets: ['Power'],
      optimizeFoodUtility: false,
      optimizeRunesInfusions: false
    }
    const result = optimizeGear(input)
    expect(result.feasible).toBe(true)
    expect(result.build.equipment.weaponA1?.itemStatId).not.toBeNull()
    expect(result.build.equipment.weaponA1?.itemStatId).toBe(result.build.equipment.weaponA2?.itemStatId)
  })

  it('fills the currently-inactive set with the same prefix as the active set, across a 2h <-> 1h+1h swap', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: {
        // Set A (active): Greatsword, two-handed.
        weaponA1: { itemStatId: null, weaponType: 'Greatsword' },
        // Set B (inactive): Sword + Axe, one-handed pair.
        weaponB1: { itemStatId: null, weaponType: 'Sword' },
        weaponB2: { itemStatId: null, weaponType: 'Axe' }
      }
    })
    const input: OptimizerInput = {
      build,
      gameData: GAME_DATA,
      combatState: DEFAULT_COMBAT_STATE,
      floors: [],
      targets: ['CriticalChancePercent'],
      optimizeFoodUtility: false,
      optimizeRunesInfusions: false
    }
    const result = optimizeGear(input)
    expect(result.feasible).toBe(true)

    const chosen = result.build.equipment.weaponA1?.itemStatId
    expect(chosen).not.toBeNull()
    // The inactive set's items (never independently searched, since they can't affect any tracked
    // metric) still land on the exact same prefix the active set's search picked.
    expect(result.build.equipment.weaponB1?.itemStatId).toBe(chosen)
    expect(result.build.equipment.weaponB2?.itemStatId).toBe(chosen)

    // Sanity: the reported CriticalChancePercent matches what only the ACTIVE (Greatsword) set
    // contributes — picking the crit-leaning combo should raise it above baseline.
    expect(result.metricValues.CriticalChancePercent ?? 0).toBeGreaterThan(5)
  })

  it('mirrors a two-handed weapon\'s chosen id onto both its main and off-hand equipment keys', () => {
    const build = makeBuild({
      equipment: {
        weaponA1: { itemStatId: null, weaponType: 'Greatsword' }
      }
    })
    const input: OptimizerInput = {
      build,
      gameData: GAME_DATA,
      combatState: DEFAULT_COMBAT_STATE,
      floors: [],
      targets: ['Power'],
      optimizeFoodUtility: false,
      optimizeRunesInfusions: false
    }
    const result = optimizeGear(input)
    expect(result.feasible).toBe(true)
    expect(result.build.equipment.weaponA2?.itemStatId).toBe(result.build.equipment.weaponA1?.itemStatId)
  })
})
