import { describe, expect, it } from 'vitest'
import type { Build, GameData, ItemStat } from '../types'
import {
  BASE_ATTRIBUTES,
  BASE_CRITICAL_CHANCE_PERCENT,
  BASE_CRITICAL_DAMAGE_PERCENT,
  BASE_HEALTH_BY_PROFESSION,
  computeCharacterStats,
  FEROCITY_PER_CRITICAL_DAMAGE_PERCENT,
  fullArmorDefense,
  HEALTH_PER_VITALITY,
  PRECISION_PER_CRITICAL_CHANCE_PERCENT,
  WEIGHT_CLASS_BY_PROFESSION
} from './derived-stats'
import { DEFAULT_COMBAT_STATE, FURY_CRITICAL_CHANCE_PERCENT, type CombatState } from './combat-state'

/**
 * Tier 1 value-correctness tests, continued from attribute-totals.test.ts — the derived formulas
 * `computeCharacterStats` applies on top of raw attribute totals (crit chance/damage, health,
 * armor), hand-computed against the same wiki-quoted constants the source cites.
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

const EMPTY_GAME_DATA: Pick<GameData, 'itemStats' | 'itemStatLegalIds' | 'infusions' | 'runes' | 'sigils' | 'food' | 'utility' | 'traits'> = {
  itemStats: [],
  itemStatLegalIds: { armorWeapon: [], trinket: [] },
  infusions: [],
  runes: [],
  sigils: [],
  food: [],
  utility: [],
  traits: []
}

describe('computeCharacterStats — with no equipment (base attributes only)', () => {
  const build = makeBuild()
  const stats = computeCharacterStats(build, EMPTY_GAME_DATA)

  it('attributes match BASE_ATTRIBUTES exactly', () => {
    expect(stats.attributes.power).toBe(BASE_ATTRIBUTES.Power)
    expect(stats.attributes.precision).toBe(BASE_ATTRIBUTES.Precision)
    expect(stats.attributes.toughness).toBe(BASE_ATTRIBUTES.Toughness)
    expect(stats.attributes.vitality).toBe(BASE_ATTRIBUTES.Vitality)
    expect(stats.attributes.ferocity).toBe(0)
    expect(stats.attributes.concentration).toBe(0)
    expect(stats.attributes.expertise).toBe(0)
  })

  it('critical chance is the 5% base with no Precision above 1000 and no Fury', () => {
    expect(stats.derived.criticalChance).toBe(BASE_CRITICAL_CHANCE_PERCENT)
  })

  it('critical damage is the 150% base with no Ferocity', () => {
    expect(stats.derived.criticalDamage).toBe(BASE_CRITICAL_DAMAGE_PERCENT)
  })

  it('health is the profession baseline with no Vitality above the 1000 base', () => {
    expect(stats.derived.health).toBe(BASE_HEALTH_BY_PROFESSION.Guardian + 1000 * HEALTH_PER_VITALITY)
  })

  it('armor is just base Toughness with no armor pieces equipped (0 Defense)', () => {
    expect(stats.derived.armor).toBe(1000)
  })

  it('boon/condition duration and magic find are all 0', () => {
    expect(stats.derived.boonDuration).toBe(0)
    expect(stats.derived.conditionDuration).toBe(0)
    expect(stats.derived.magicFind).toBe(0)
  })
})

describe('computeCharacterStats — critical chance formula', () => {
  // wiki: "Critical Chance (%) = 5 + [ (Precision - 1000) / 21 ]"
  it('scales 1% per 21 Precision above the 1000 base', () => {
    const stat: ItemStat = { id: 1, name: 'Precise', attributes: [{ attribute: 'Precision', multiplier: 0, value: 210 }] }
    const build = makeBuild({ equipment: { helm: { itemStatId: 1 } } })
    const gameData = { ...EMPTY_GAME_DATA, itemStats: [stat] }
    const stats = computeCharacterStats(build, gameData)
    expect(stats.attributes.precision).toBe(1210)
    expect(stats.derived.criticalChance).toBeCloseTo(5 + 210 / PRECISION_PER_CRITICAL_CHANCE_PERCENT, 10)
  })

  it('adds the flat Fury bonus on top when furyActive, with no trait bonus present', () => {
    const build = makeBuild()
    const combatState: CombatState = { ...DEFAULT_COMBAT_STATE, furyActive: true }
    const stats = computeCharacterStats(build, EMPTY_GAME_DATA, combatState)
    expect(stats.derived.criticalChance).toBe(BASE_CRITICAL_CHANCE_PERCENT + FURY_CRITICAL_CHANCE_PERCENT)
  })

  it('Fury bonus is absent when furyActive is false, even with elevated Precision', () => {
    const stat: ItemStat = { id: 2, name: 'Precise', attributes: [{ attribute: 'Precision', multiplier: 0, value: 21 }] }
    const build = makeBuild({ equipment: { helm: { itemStatId: 2 } } })
    const gameData = { ...EMPTY_GAME_DATA, itemStats: [stat] }
    const stats = computeCharacterStats(build, gameData, { ...DEFAULT_COMBAT_STATE, furyActive: false })
    expect(stats.derived.criticalChance).toBe(BASE_CRITICAL_CHANCE_PERCENT + 1)
  })
})

describe('computeCharacterStats — critical damage formula', () => {
  // wiki: base 150%, "every 15 points of ferocity adds 1% to critical damage"
  it('scales 1% per 15 Ferocity', () => {
    // ItemStat.attributes use the raw ItemStat/API key convention (CritDamage), not the display
    // name "Ferocity" — see AttributeTotals' doc comment in attribute-totals.ts.
    const stat: ItemStat = { id: 3, name: 'Ferocious', attributes: [{ attribute: 'CritDamage', multiplier: 0, value: 150 }] }
    const build = makeBuild({ equipment: { helm: { itemStatId: 3 } } })
    const gameData = { ...EMPTY_GAME_DATA, itemStats: [stat] }
    const stats = computeCharacterStats(build, gameData)
    expect(stats.attributes.ferocity).toBe(150)
    expect(stats.derived.criticalDamage).toBeCloseTo(150 + 150 / FEROCITY_PER_CRITICAL_DAMAGE_PERCENT, 10)
  })
})

describe('computeCharacterStats — health formula', () => {
  it('adds 10 Health per point of Vitality above the profession baseline', () => {
    const stat: ItemStat = { id: 4, name: 'Vital', attributes: [{ attribute: 'Vitality', multiplier: 0, value: 500 }] }
    const build = makeBuild({ profession: 'Warrior', equipment: { helm: { itemStatId: 4 } } })
    const gameData = { ...EMPTY_GAME_DATA, itemStats: [stat] }
    const stats = computeCharacterStats(build, gameData)
    expect(stats.attributes.vitality).toBe(1500)
    expect(stats.derived.health).toBe(BASE_HEALTH_BY_PROFESSION.Warrior + 1500 * HEALTH_PER_VITALITY)
  })

  it('differs by profession baseline for the same Vitality', () => {
    const eleStats = computeCharacterStats(makeBuild({ profession: 'Elementalist' }), EMPTY_GAME_DATA)
    const warStats = computeCharacterStats(makeBuild({ profession: 'Warrior' }), EMPTY_GAME_DATA)
    expect(eleStats.derived.health).toBe(BASE_HEALTH_BY_PROFESSION.Elementalist + 1000 * HEALTH_PER_VITALITY)
    expect(warStats.derived.health).toBe(BASE_HEALTH_BY_PROFESSION.Warrior + 1000 * HEALTH_PER_VITALITY)
    expect(eleStats.derived.health).not.toBe(warStats.derived.health)
  })
})

describe('computeCharacterStats — armor formula', () => {
  it('armor = Toughness + Defense, Defense gated per-piece on itemStatId being set', () => {
    const stat: ItemStat = { id: 5, name: 'Empty', attributes: [] }
    // Only helm equipped (a Heavy-class piece, Guardian) — Defense should be just that one piece's
    // rating, not the full 6-piece set's.
    const build = makeBuild({ profession: 'Guardian', equipment: { helm: { itemStatId: 5 }, shoulders: { itemStatId: null } } })
    const gameData = { ...EMPTY_GAME_DATA, itemStats: [stat] }
    const stats = computeCharacterStats(build, gameData)
    // fullArmorDefense sums every piece unconditionally — with only helm active, actual Defense
    // must be less than that (a partial sum), proving the per-piece itemStatId gate is real.
    expect(WEIGHT_CLASS_BY_PROFESSION.Guardian).toBe('Heavy')
    expect(stats.derived.armor).toBeLessThan(1000 + fullArmorDefense('Heavy'))
    expect(stats.derived.armor).toBeGreaterThan(1000)
  })

  it('armor is exactly base Toughness plus the full 6-piece Defense total when every armor slot is filled', () => {
    const stat: ItemStat = { id: 6, name: 'Empty', attributes: [] }
    const build = makeBuild({
      profession: 'Thief',
      equipment: {
        helm: { itemStatId: 6 },
        shoulders: { itemStatId: 6 },
        chest: { itemStatId: 6 },
        gloves: { itemStatId: 6 },
        leggings: { itemStatId: 6 },
        boots: { itemStatId: 6 }
      }
    })
    const gameData = { ...EMPTY_GAME_DATA, itemStats: [stat] }
    const stats = computeCharacterStats(build, gameData)
    expect(WEIGHT_CLASS_BY_PROFESSION.Thief).toBe('Medium')
    expect(stats.derived.armor).toBe(1000 + fullArmorDefense('Medium'))
  })
})
