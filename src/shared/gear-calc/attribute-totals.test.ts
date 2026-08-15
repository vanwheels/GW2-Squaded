import { describe, expect, it } from 'vitest'
import type { AttributeBonusText, Build, Consumable, GameData, ItemStat, ItemStatLegalIds, Rune } from '../types'
import {
  ALL_CORE_ATTRIBUTE_KEYS,
  addBonus,
  addPoints,
  applyConversions,
  boonDurationPercent,
  computeGearAttributeTotals,
  conditionDurationPercent,
  emptyTotals,
  isActiveWeaponSlot,
  magicFindPercent,
  resolveItemStatId,
  statComboContribution,
  type AttributeConversion
} from './attribute-totals'

/**
 * Tier 1 value-correctness tests (TODO.md's "Automated testing strategy" secondary priority,
 * picked up 2026-08-12) — pure formula/arithmetic tests needing no external oracle. Unlike the
 * completeness scans (which check every candidate source was *looked at*) or the combat-state
 * state-dependent tests (which lock in a runtime-parametrized formula's shape), these hand-compute
 * an expected number from the same wiki-quoted constants the source already cites in its own
 * comments, and assert the code reproduces it exactly — catching an arithmetic slip (wrong divisor,
 * dropped term, compounding where the game doesn't) that a completeness scan can't see because it
 * never looks at values, only presence.
 */

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

function bonus(overrides: Partial<AttributeBonusText>): AttributeBonusText {
  return { raw: '', attribute: null, value: null, isPercent: false, sourceAttribute: null, ...overrides }
}

const EMPTY_GAME_DATA: Pick<GameData, 'itemStats' | 'itemStatLegalIds' | 'infusions' | 'runes' | 'sigils' | 'food' | 'utility'> = {
  itemStats: [],
  itemStatLegalIds: { armorWeapon: [], trinket: [] },
  infusions: [],
  runes: [],
  sigils: [],
  food: [],
  utility: []
}

describe('statComboContribution', () => {
  // wiki-quoted ascended adjustment constants (see ATTRIBUTE_ADJUSTMENT's own comment) —
  // hand-computed against `adjustment * multiplier + value`.
  it('applies the ascended armorHelm adjustment (179.256) to a major/minor split combo', () => {
    const stat: ItemStat = { id: 1, name: 'Berserker', attributes: [{ attribute: 'Power', multiplier: 1, value: 0 }, { attribute: 'Precision', multiplier: 0.15, value: 0 }] }
    const totals = statComboContribution(stat, 'armorHelm')
    expect(totals.points.Power).toBeCloseTo(179.256, 5)
    expect(totals.points.Precision).toBeCloseTo(179.256 * 0.15, 5)
  })

  it('applies the ascended trinketAmulet adjustment (358.512) plus a flat value term', () => {
    const stat: ItemStat = { id: 2, name: "Minstrel's", attributes: [{ attribute: 'Toughness', multiplier: 0.3, value: 25 }] }
    const totals = statComboContribution(stat, 'trinketAmulet')
    expect(totals.points.Toughness).toBeCloseTo(358.512 * 0.3 + 25, 5)
  })

  it('applies the ascended weaponTwoHanded adjustment (717.024)', () => {
    const stat: ItemStat = { id: 3, name: 'Berserker', attributes: [{ attribute: 'Power', multiplier: 1, value: 0 }] }
    const totals = statComboContribution(stat, 'weaponTwoHanded')
    expect(totals.points.Power).toBeCloseTo(717.024, 5)
  })

  it('weaponOneHanded doubled equals weaponTwoHanded exactly (the mirrored-slot assumption computeGearAttributeTotals relies on)', () => {
    const stat: ItemStat = { id: 4, name: 'Berserker', attributes: [{ attribute: 'Power', multiplier: 1, value: 0 }] }
    const oneHanded = statComboContribution(stat, 'weaponOneHanded')
    const twoHanded = statComboContribution(stat, 'weaponTwoHanded')
    expect(oneHanded.points.Power! * 2).toBeCloseTo(twoHanded.points.Power!, 5)
  })
})

describe('addPoints', () => {
  it('accumulates repeated calls on the same attribute', () => {
    const totals = emptyTotals()
    addPoints(totals, 'Power', 100)
    addPoints(totals, 'Power', 50)
    expect(totals.points.Power).toBe(150)
  })
})

describe('addBonus', () => {
  it('adds a flat single-attribute bonus via its free-text alias', () => {
    const totals = emptyTotals()
    addBonus(totals, bonus({ attribute: 'Ferocity', value: 25, isPercent: false }))
    expect(totals.points.CritDamage).toBe(25)
  })

  it('adds a percent bonus to its bonusPercent bucket, not points', () => {
    const totals = emptyTotals()
    addBonus(totals, bonus({ attribute: 'Boon Duration', value: 5, isPercent: true }))
    expect(totals.bonusPercent.boonDuration).toBe(5)
    expect(totals.points.BoonDuration).toBeUndefined()
  })

  it('distributes a "to all stats" bonus across all 9 core attributes', () => {
    const totals = emptyTotals()
    addBonus(totals, bonus({ attribute: 'to all stats', value: 10, isPercent: false }))
    for (const attr of ALL_CORE_ATTRIBUTE_KEYS) expect(totals.points[attr]).toBe(10)
  })

  it('no-ops on a sourceAttribute conversion line (needs the final-value pass, not a single-pass add)', () => {
    const totals = emptyTotals()
    addBonus(totals, bonus({ attribute: 'Power', value: 10, sourceAttribute: 'Precision' }))
    expect(totals.points.Power).toBeUndefined()
  })

  it('no-ops on an unmapped attribute name (e.g. flavor-only "Magic Find" as a flat, non-percent line)', () => {
    const totals = emptyTotals()
    addBonus(totals, bonus({ attribute: 'Gold from Monsters', value: 10, isPercent: false }))
    expect(Object.keys(totals.points)).toHaveLength(0)
  })

  it('no-ops when attribute or value is null (unparsed flavor text)', () => {
    const totals = emptyTotals()
    addBonus(totals, bonus({ attribute: null, value: null }))
    expect(Object.keys(totals.points)).toHaveLength(0)
  })
})

describe('applyConversions', () => {
  it('resolves every conversion against the pre-conversion snapshot (simultaneous, not chained)', () => {
    const totals = emptyTotals()
    addPoints(totals, 'Power', 1000)
    addPoints(totals, 'Precision', 1000)
    // Two conversions both reading Power's *original* 1000, not compounding off each other.
    const conversions: AttributeConversion[] = [
      { source: 'Power', target: 'Precision', percent: 10 },
      { source: 'Power', target: 'Vitality', percent: 5 }
    ]
    applyConversions(totals, conversions)
    expect(totals.points.Precision).toBe(1000 + 100) // 10% of 1000, not 10% of a Power already changed
    expect(totals.points.Vitality).toBe(50)
    expect(totals.points.Power).toBe(1000) // source itself is untouched by being read
  })

  it('sums multiple conversions that target the same attribute', () => {
    const totals = emptyTotals()
    addPoints(totals, 'Power', 200)
    addPoints(totals, 'Healing', 400)
    const conversions: AttributeConversion[] = [
      { source: 'Power', target: 'Vitality', percent: 10 },
      { source: 'Healing', target: 'Vitality', percent: 25 }
    ]
    applyConversions(totals, conversions)
    expect(totals.points.Vitality).toBe(20 + 100)
  })
})

describe('boonDurationPercent / conditionDurationPercent', () => {
  // wiki-quoted: 15 points of Concentration/Expertise = 1% boon/condition duration.
  it('converts raw Concentration points at 15-per-1%, plus any already-percent bonus', () => {
    const totals = emptyTotals()
    addPoints(totals, 'BoonDuration', 300)
    totals.bonusPercent.boonDuration = 5
    expect(boonDurationPercent(totals)).toBe(300 / 15 + 5)
  })

  it('converts raw Expertise points at 15-per-1%, plus any already-percent bonus', () => {
    const totals = emptyTotals()
    addPoints(totals, 'ConditionDuration', 150)
    totals.bonusPercent.conditionDuration = 10
    expect(conditionDurationPercent(totals)).toBe(150 / 15 + 10)
  })

  it('is 0 with no points and no bonus', () => {
    expect(boonDurationPercent(emptyTotals())).toBe(0)
    expect(conditionDurationPercent(emptyTotals())).toBe(0)
  })
})

describe('magicFindPercent', () => {
  it('passes bonusPercent.magicFind through unconverted (no equippable core-attribute form)', () => {
    const totals = emptyTotals()
    totals.bonusPercent.magicFind = 37
    expect(magicFindPercent(totals)).toBe(37)
  })
})

describe('resolveItemStatId', () => {
  const statsById = new Map<number, ItemStat>([
    [1, { id: 1, name: "Minstrel's", attributes: [{ attribute: 'Toughness', multiplier: 0.3, value: 0 }] }],
    [2, { id: 2, name: "Minstrel's", attributes: [{ attribute: 'Toughness', multiplier: 0.3, value: 25 }] }],
    [3, { id: 3, name: 'Berserker', attributes: [{ attribute: 'Power', multiplier: 1, value: 0 }] }]
  ])
  const legalIds: ItemStatLegalIds = { armorWeapon: [1], trinket: [2] }

  it('passes an already-legal id through unchanged', () => {
    expect(resolveItemStatId(1, statsById, legalIds, 'armorWeapon')).toBe(1)
  })

  it('corrects an armor/weapon slot holding the trinket-flavored id of the same-named combo', () => {
    expect(resolveItemStatId(2, statsById, legalIds, 'armorWeapon')).toBe(1)
  })

  it('corrects a trinket slot holding the armor/weapon-flavored id of the same-named combo', () => {
    expect(resolveItemStatId(1, statsById, legalIds, 'trinket')).toBe(2)
  })

  it('passes through unchanged when no same-named counterpart exists in the target category', () => {
    expect(resolveItemStatId(3, statsById, legalIds, 'trinket')).toBe(3)
  })

  it('passes through unchanged when the id is unknown', () => {
    expect(resolveItemStatId(999, statsById, legalIds, 'armorWeapon')).toBe(999)
  })
})

describe('isActiveWeaponSlot', () => {
  it('non-weapon slots are always active', () => {
    expect(isActiveWeaponSlot('helm', makeBuild())).toBe(true)
  })

  it('land weapon set A slots are active only when activeWeaponSet is A', () => {
    const build = makeBuild({ activeWeaponSet: 'A' })
    expect(isActiveWeaponSlot('weaponA1', build)).toBe(true)
    expect(isActiveWeaponSlot('weaponB1', build)).toBe(false)
  })

  it('land weapon set B slots are active only when activeWeaponSet is B', () => {
    const build = makeBuild({ activeWeaponSet: 'B' })
    expect(isActiveWeaponSlot('weaponB2', build)).toBe(true)
    expect(isActiveWeaponSlot('weaponA2', build)).toBe(false)
  })

  it('underwater slots gate on environment + activeUnderwaterSet, ignoring the land set', () => {
    const build = makeBuild({ environment: 'underwater', activeUnderwaterSet: 'U2', activeWeaponSet: 'A' })
    expect(isActiveWeaponSlot('weaponU1', build)).toBe(false)
    expect(isActiveWeaponSlot('weaponU2', build)).toBe(true)
    // Land slots are never active while underwater.
    expect(isActiveWeaponSlot('weaponA1', build)).toBe(false)
  })
})

describe('computeGearAttributeTotals', () => {
  const berserkerArmorWeapon: ItemStat = {
    id: 10,
    name: 'Berserker',
    attributes: [
      { attribute: 'Power', multiplier: 1, value: 0 },
      { attribute: 'Precision', multiplier: 0.15, value: 0 }
    ]
  }

  function gameDataWith(overrides: Partial<typeof EMPTY_GAME_DATA>) {
    return { ...EMPTY_GAME_DATA, itemStats: [berserkerArmorWeapon], ...overrides }
  }

  it('sums a single armor slot at the armorHelm adjustment', () => {
    const build = makeBuild({ equipment: { helm: { itemStatId: 10 } } })
    const totals = computeGearAttributeTotals(build, gameDataWith({}))
    expect(totals.points.Power).toBeCloseTo(179.256, 5)
    expect(totals.points.Precision).toBeCloseTo(179.256 * 0.15, 5)
  })

  it('mirrors a two-handed weapon across both slot keys, summing to the two-handed total', () => {
    const build = makeBuild({
      equipment: {
        weaponA1: { itemStatId: 10, weaponType: 'Greatsword' },
        weaponA2: { itemStatId: 10, weaponType: 'Greatsword' }
      }
    })
    const totals = computeGearAttributeTotals(build, gameDataWith({}))
    // Two mirrored one-handed-adjustment slots should sum to the two-handed constant, per
    // weaponAdjustmentKey's doc comment.
    expect(totals.points.Power).toBeCloseTo(717.024, 5)
  })

  it('does not credit a stowed weapon set', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: {
        weaponA1: { itemStatId: 10, weaponType: 'Sword' },
        weaponB1: { itemStatId: 10, weaponType: 'Axe' }
      }
    })
    const totals = computeGearAttributeTotals(build, gameDataWith({}))
    // Only set A's one-handed contribution, not set B's.
    expect(totals.points.Power).toBeCloseTo(358.512, 5)
  })

  it('does not credit an empty weapon slot even when itemStatId is set (no weaponType = nothing equipped)', () => {
    const build = makeBuild({ equipment: { weaponA1: { itemStatId: 10, weaponType: null } } })
    const totals = computeGearAttributeTotals(build, gameDataWith({}))
    expect(totals.points.Power).toBeUndefined()
  })

  it('applies an underwater weapon at the two-handed adjustment even though it is a single slot', () => {
    const build = makeBuild({ environment: 'underwater', activeUnderwaterSet: 'U1', equipment: { weaponU1: { itemStatId: 10, weaponType: 'Spear' } } })
    const totals = computeGearAttributeTotals(build, gameDataWith({}))
    expect(totals.points.Power).toBeCloseTo(717.024, 5)
  })

  it('sums flat infusion attribute points on the active weapon slot', () => {
    const build = makeBuild({ equipment: { weaponA1: { itemStatId: null, weaponType: 'Sword', infusionIds: [50] } } })
    const totals = computeGearAttributeTotals(
      build,
      gameDataWith({ infusions: [{ id: 50, name: 'Mighty WvW Infusion', icon: '', description: '', attribute: 'Power', value: 5 }] })
    )
    expect(totals.points.Power).toBe(5)
  })

  it('does not credit a sigil stat bonus on an inactive weapon set', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: { weaponB1: { itemStatId: null, weaponType: 'Axe', sigilIds: [77] } }
    })
    const totals = computeGearAttributeTotals(
      build,
      gameDataWith({ sigils: [{ id: 77, name: 'Superior Sigil of Concentration', icon: '', description: '', weaponTypes: ['Axe'], bonuses: [bonus({ attribute: 'Boon Duration', value: 10, isPercent: true })] }] })
    )
    expect(totals.bonusPercent.boonDuration).toBe(0)
  })

  it('credits a sigil stat bonus on the active weapon set', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: { weaponA1: { itemStatId: null, weaponType: 'Axe', sigilIds: [77] } }
    })
    const totals = computeGearAttributeTotals(
      build,
      gameDataWith({ sigils: [{ id: 77, name: 'Superior Sigil of Concentration', icon: '', description: '', weaponTypes: ['Axe'], bonuses: [bonus({ attribute: 'Boon Duration', value: 10, isPercent: true })] }] })
    )
    expect(totals.bonusPercent.boonDuration).toBe(10)
  })

  it('unlocks exactly N rune stages for N armor pieces carrying the same rune id', () => {
    const rune: Rune = {
      id: 90,
      name: 'Superior Rune of Test',
      icon: '',
      bonuses: [
        bonus({ attribute: 'Power', value: 10 }),
        bonus({ attribute: 'Precision', value: 20 }),
        bonus({ attribute: 'Toughness', value: 30 }),
        bonus({ attribute: 'Vitality', value: 999 }) // stage 4 — must NOT apply with only 3 pieces
      ]
    }
    const build = makeBuild({
      equipment: {
        helm: { itemStatId: null, runeId: 90 },
        shoulders: { itemStatId: null, runeId: 90 },
        chest: { itemStatId: null, runeId: 90 }
      }
    })
    const totals = computeGearAttributeTotals(build, gameDataWith({ runes: [rune] }))
    expect(totals.points.Power).toBe(10)
    expect(totals.points.Precision).toBe(20)
    expect(totals.points.Toughness).toBe(30)
    expect(totals.points.Vitality).toBeUndefined()
  })

  it('sums the active food and utility bonus lines', () => {
    const food: Consumable = { id: 200, name: 'Test Food', icon: '', kind: 'Food', effectName: null, durationMs: null, applyCount: null, description: '', bonuses: [bonus({ attribute: 'Condition Damage', value: 100 })], sharedBuffSource: null }
    const utility: Consumable = { id: 201, name: 'Test Utility', icon: '', kind: 'Utility', effectName: null, durationMs: null, applyCount: null, description: '', bonuses: [bonus({ attribute: 'Concentration', value: 100 })], sharedBuffSource: null }
    const build = makeBuild({ foodId: 200, utilityId: 201 })
    const totals = computeGearAttributeTotals(build, gameDataWith({ food: [food], utility: [utility] }))
    expect(totals.points.ConditionDamage).toBe(100)
    expect(totals.points.BoonDuration).toBe(100)
  })
})
