import { describe, expect, it } from 'vitest'
import type { Build, Trait, TraitSlot } from '../types'
import {
  combatStatePoints,
  CURATED_RELIC_DAMAGE_BONUSES,
  DEATHS_CARAPACE_TOUGHNESS_PER_STACK,
  DEFAULT_COMBAT_STATE,
  FURY_CRITICAL_CHANCE_PERCENT,
  KALLA_FERVOR_CONDITION_DAMAGE_PERCENT_PER_STACK,
  KALLA_FERVOR_IMPROVED_CONDITION_DAMAGE_PERCENT_PER_STACK,
  KALLA_FERVOR_IMPROVED_LIFE_STEAL_PERCENT_PER_STACK,
  KALLA_FERVOR_IMPROVED_STRIKE_DAMAGE_PERCENT_PER_STACK,
  KALLA_FERVOR_LIFE_STEAL_PERCENT_PER_STACK,
  KALLA_FERVOR_MAX_STACKS,
  KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK,
  kallaFervorPercentPerStack,
  LASTING_LEGACY_TRAIT_ID,
  MIGHT_CONDITION_DAMAGE_PER_STACK,
  MIGHT_POWER_PER_STACK,
  RISING_MOMENTUM_MOVEMENT_SPEED_PERCENT_PER_UPKEEP_POINT,
  RISING_MOMENTUM_TRAIT_ID,
  type CombatState,
  type HealthTier
} from './combat-state'
import { BASE_CRITICAL_CHANCE_PERCENT, computeCharacterStats } from './derived-stats'

/**
 * State-dependent bonus tests — TODO.md's "Automated testing strategy" #3 (agreed 2026-08-12,
 * the last of the 3 completeness/coverage items). Unlike the trait/sigil completeness scans (which
 * check that every candidate source was *looked at*), every family in `combat-state.ts` is a
 * runtime-parametrized formula (a per-stack multiplier, a boolean gate, a 3-way tier) that a single
 * static snapshot can't exercise — a snapshot only ever locks in one point in the state space, and
 * would happily pass even if the *scaling itself* were broken (e.g. a bonus that stopped scaling
 * past 1 stack, or a boolean gate wired backwards). These tests instead call each function across
 * 0/mid/max points of its own state dimension and assert the exact hand-computed value at each —
 * not re-verifying the underlying wiki numbers (each curated table's own comment already documents
 * that source), just locking in that the *formula* built on top of them is correct and stays
 * correct.
 */

function makeBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'test-build',
    name: 'Test',
    notes: '',
    profession: 'Revenant',
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

/** A build with the given synthetic traits (all sharing one specialization line/id) active —
 *  minors are always active once their line is equipped, majors need to be in `chosenTraitIds`
 *  (mirrors `activeTraitIds`'s own gating, see trait-attributes.ts). */
function buildWithTraits(entries: Array<{ id: number; slot: TraitSlot }>, specializationId = 900): { build: Build; traitsById: Map<number, Trait> } {
  const traitsById = new Map<number, Trait>()
  const chosenTraitIds: [number | null, number | null, number | null] = [null, null, null]
  let majorIndex = 0
  for (const { id, slot } of entries) {
    traitsById.set(id, { id, tier: 1, order: 0, name: `trait-${id}`, description: '', slot, specializationId, icon: '', facts: [], traitedFacts: [] })
    if (slot === 'Major') chosenTraitIds[majorIndex++] = id
  }
  const build = makeBuild({ specializations: [{ specializationId, chosenTraitIds }, null, null] })
  return { build, traitsById }
}

function buildWithTrait(id: number, slot: TraitSlot): { build: Build; traitsById: Map<number, Trait> } {
  return buildWithTraits([{ id, slot }])
}

const NO_TRAITS = new Map<number, Trait>()

const EMPTY_GAME_DATA = {
  itemStats: [],
  itemStatLegalIds: { armorWeapon: [], trinket: [] },
  infusions: [],
  runes: [],
  sigils: [],
  food: [],
  utility: [],
  legends: []
}

describe('combatStatePoints — mightStacks', () => {
  it.each([0, 12, 25])('scales the flat Power/ConditionDamage grant linearly at %i stacks, no trait', (stacks) => {
    const build = makeBuild()
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, mightStacks: stacks }, NO_TRAITS)
    expect(points.Power ?? 0).toBe(stacks * MIGHT_POWER_PER_STACK)
    expect(points.ConditionDamage ?? 0).toBe(stacks * MIGHT_CONDITION_DAMAGE_PER_STACK)
  })

  it.each([0, 12, 25])('adds a curated per-stack trait bonus on top of the flat grant at %i stacks (Awaken the Pain)', (stacks) => {
    const { build, traitsById } = buildWithTrait(915, 'Minor') // Awaken the Pain: +10 Power/stack
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, mightStacks: stacks }, traitsById)
    expect(points.Power ?? 0).toBe(stacks * (MIGHT_POWER_PER_STACK + 10))
    expect(points.ConditionDamage ?? 0).toBe(stacks * MIGHT_CONDITION_DAMAGE_PER_STACK)
  })

  it('never applies the curated trait bonus when the trait is not active, regardless of stack count', () => {
    const build = makeBuild() // no specializations chosen
    const traitsById = new Map<number, Trait>([[915, { id: 915, tier: 1, order: 0, name: 'Awaken the Pain', description: '', slot: 'Minor', specializationId: 900, icon: '', facts: [], traitedFacts: [] }]])
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, mightStacks: 25 }, traitsById)
    expect(points.Power).toBe(25 * MIGHT_POWER_PER_STACK)
  })
})

describe("combatStatePoints — deathsCarapaceStacks (Death's Carapace)", () => {
  it.each([0, 15, 30])('grants the baseline Toughness at %i stacks, no trait', (stacks) => {
    const build = makeBuild()
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, deathsCarapaceStacks: stacks }, NO_TRAITS)
    expect(points.Toughness ?? 0).toBe(stacks * DEATHS_CARAPACE_TOUGHNESS_PER_STACK)
    expect(points.Power ?? 0).toBe(0)
    expect(points.ConditionDamage ?? 0).toBe(0)
  })

  it.each([0, 15, 30])('adds Deadly Strength\'s per-stack Power/ConditionDamage on top of the baseline Toughness at %i stacks', (stacks) => {
    const { build, traitsById } = buildWithTrait(855, 'Major') // Deadly Strength: +10 Power/+10 ConditionDamage per stack
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, deathsCarapaceStacks: stacks }, traitsById)
    expect(points.Toughness ?? 0).toBe(stacks * DEATHS_CARAPACE_TOUGHNESS_PER_STACK)
    expect(points.Power ?? 0).toBe(stacks * 10)
    expect(points.ConditionDamage ?? 0).toBe(stacks * 10)
  })

  it('never applies the Deadly Strength bonus when the trait is not active, regardless of stack count', () => {
    const build = makeBuild()
    const traitsById = new Map<number, Trait>([[855, { id: 855, tier: 2, order: 0, name: 'Deadly Strength', description: '', slot: 'Major', specializationId: 900, icon: '', facts: [], traitedFacts: [] }]])
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, deathsCarapaceStacks: 30 }, traitsById)
    expect(points.Toughness).toBe(30 * DEATHS_CARAPACE_TOUGHNESS_PER_STACK)
    expect(points.Power ?? 0).toBe(0)
  })
})

describe('combatStatePoints — might-threshold + attunement-doubled trait bonus (Power Overwhelming)', () => {
  it('contributes nothing on top of the base per-stack Might grant below the threshold, even with Fire attuned', () => {
    const { build, traitsById } = buildWithTrait(334, 'Major')
    const points = combatStatePoints({ ...build, activeAttunement: 'Fire' }, { ...DEFAULT_COMBAT_STATE, mightStacks: 7 }, traitsById)
    expect(points.Power).toBe(7 * MIGHT_POWER_PER_STACK) // no +150/+300 — below the 8-stack threshold
  })

  it('adds the flat 150 Power on top of the base per-stack grant at/above the threshold while NOT attuned to Fire', () => {
    const { build, traitsById } = buildWithTrait(334, 'Major')
    const points = combatStatePoints({ ...build, activeAttunement: 'Water' }, { ...DEFAULT_COMBAT_STATE, mightStacks: 8 }, traitsById)
    expect(points.Power).toBe(8 * MIGHT_POWER_PER_STACK + 150)
  })

  it('doubles the bonus to 300 Power at/above the threshold while attuned to Fire', () => {
    const { build, traitsById } = buildWithTrait(334, 'Major')
    const points = combatStatePoints({ ...build, activeAttunement: 'Fire' }, { ...DEFAULT_COMBAT_STATE, mightStacks: 25 }, traitsById)
    expect(points.Power).toBe(25 * MIGHT_POWER_PER_STACK + 300)
  })

  it('never applies when the trait is not active, regardless of stacks or attunement', () => {
    const build = makeBuild({ activeAttunement: 'Fire' })
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, mightStacks: 25 }, NO_TRAITS)
    expect(points.Power).toBe(25 * MIGHT_POWER_PER_STACK) // only the base grant, no trait bonus
  })
})

describe('combatStatePoints — stacking sigil', () => {
  function buildWithSigil(sigilId: number, weaponSet: 'A' | 'B' = 'A'): Build {
    return makeBuild({
      activeWeaponSet: 'A',
      equipment: { weaponA1: { itemStatId: null, sigilIds: [sigilId] } },
      ...(weaponSet === 'B' ? { activeWeaponSet: 'B' } : {})
    })
  }

  it.each([0, 12, 25])('scales the single-attribute sigil bonus linearly at %i stacks (Bloodlust)', (stacks) => {
    const build = buildWithSigil(24575) // Superior Sigil of Bloodlust: Power, 10/stack
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, stackingSigilStacks: stacks }, NO_TRAITS)
    expect(points.Power ?? 0).toBe(stacks * 10)
  })

  it('expands the "all stats" sigil to every core attribute (Superior Sigil of the Stars)', () => {
    const build = buildWithSigil(86170)
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, stackingSigilStacks: 10 }, NO_TRAITS)
    for (const attribute of ['Power', 'Precision', 'Toughness', 'Vitality', 'CritDamage', 'Healing', 'ConditionDamage', 'BoonDuration', 'ConditionDuration']) {
      expect(points[attribute]).toBe(20) // 10 stacks * 2/stack
    }
  })

  it('still applies a stacking sigil equipped on the inactive weapon set — stacks persist across swap', () => {
    const build = buildWithSigil(24575, 'B') // sigil lives on weaponA1, but set B is active
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, stackingSigilStacks: 25 }, NO_TRAITS)
    expect(points.Power ?? 0).toBe(25 * 10)
  })
})

describe('combatStatePoints — boolean-gated conditional families', () => {
  const cases: Array<{
    name: string
    stateKey: keyof Pick<CombatState, 'furyActive' | 'regenerationActive' | 'quicknessActive' | 'mechanicActive' | 'revealedActive'>
    traitId: number
    slot: TraitSlot
    expected: Record<string, number>
  }> = [
    { name: 'furyActive (No Scope)', stateKey: 'furyActive', traitId: 1923, slot: 'Major', expected: { CritDamage: 150 } },
    { name: 'regenerationActive (Energy Amplifier)', stateKey: 'regenerationActive', traitId: 519, slot: 'Minor', expected: { Power: 250, Healing: 250 } },
    { name: 'quicknessActive (Be Quick or Be Killed)', stateKey: 'quicknessActive', traitId: 2093, slot: 'Major', expected: { Power: 200, Precision: 200 } },
    { name: 'mechanicActive (Fatal Frenzy)', stateKey: 'mechanicActive', traitId: 2046, slot: 'Minor', expected: { Power: 300, ConditionDamage: 300 } },
    { name: 'revealedActive (Revealed Training)', stateKey: 'revealedActive', traitId: 1704, slot: 'Major', expected: { Power: 150 } }
  ]

  for (const { name, stateKey, traitId, slot, expected } of cases) {
    it(`${name}: bonus is absent when the gate is off`, () => {
      const { build, traitsById } = buildWithTrait(traitId, slot)
      const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, [stateKey]: false }, traitsById)
      for (const attribute of Object.keys(expected)) expect(points[attribute] ?? 0).toBe(0)
    })

    it(`${name}: bonus applies exactly once when the gate is on`, () => {
      const { build, traitsById } = buildWithTrait(traitId, slot)
      const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, [stateKey]: true }, traitsById)
      for (const [attribute, value] of Object.entries(expected)) expect(points[attribute]).toBe(value)
    })
  }
})

describe('combatStatePoints — healthTier (always-on 3-way tier, no separate gate)', () => {
  it.each<[HealthTier, Record<string, number>]>([
    ['above75', { Power: 240, Healing: 150 }],
    ['between50and75', { Power: 240, Healing: 300 }],
    ['below50', { Healing: 690 }] // Empire Divided's 240 + Last Rites' 450, both Healing at this tier
  ])('sums every curated trait bonus for tier %s', (tier, expected) => {
    const { build, traitsById } = buildWithTraits([
      { id: 2229, slot: 'Minor' }, // Empire Divided
      { id: 1931, slot: 'Major' } // Last Rites
    ])
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, healthTier: tier }, traitsById)
    expect(points.Power ?? 0).toBe(expected.Power ?? 0)
    expect(points.Healing ?? 0).toBe(expected.Healing ?? 0)
  })
})

describe('combatStatePoints — combined state accumulates additively rather than overwriting', () => {
  it('sums Might-stack scaling and health-threshold bonuses that target the same attribute (Power)', () => {
    const { build, traitsById } = buildWithTraits([
      { id: 915, slot: 'Minor' }, // Awaken the Pain: +10 Power/might-stack
      { id: 2229, slot: 'Minor' } // Empire Divided: +240 Power at/above 50% health
    ])
    const above75 = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, mightStacks: 10, healthTier: 'above75' }, traitsById)
    expect(above75.Power).toBe(10 * (MIGHT_POWER_PER_STACK + 10) + 240)
    expect(above75.ConditionDamage).toBe(10 * MIGHT_CONDITION_DAMAGE_PER_STACK)

    const below50 = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, mightStacks: 10, healthTier: 'below50' }, traitsById)
    expect(below50.Power).toBe(10 * (MIGHT_POWER_PER_STACK + 10)) // Empire Divided's Power bonus no longer applies
    expect(below50.Healing).toBe(240) // ...replaced by its Healing bonus in this tier
  })
})

describe('kallaFervorPercentPerStack', () => {
  it('returns the base 2%/2%/2% per-stack values with Lasting Legacy not chosen', () => {
    const build = makeBuild()
    const result = kallaFervorPercentPerStack(build, NO_TRAITS)
    expect(result).toEqual({
      strikeDamage: KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK,
      conditionDamage: KALLA_FERVOR_CONDITION_DAMAGE_PERCENT_PER_STACK,
      lifeSteal: KALLA_FERVOR_LIFE_STEAL_PERCENT_PER_STACK,
      improved: false
    })
  })

  it('overrides to the improved 3%/3%/3% per-stack values with Lasting Legacy chosen', () => {
    const { build, traitsById } = buildWithTrait(LASTING_LEGACY_TRAIT_ID, 'Major')
    const result = kallaFervorPercentPerStack(build, traitsById)
    expect(result).toEqual({
      strikeDamage: KALLA_FERVOR_IMPROVED_STRIKE_DAMAGE_PERCENT_PER_STACK,
      conditionDamage: KALLA_FERVOR_IMPROVED_CONDITION_DAMAGE_PERCENT_PER_STACK,
      lifeSteal: KALLA_FERVOR_IMPROVED_LIFE_STEAL_PERCENT_PER_STACK,
      improved: true
    })
  })
})

describe('computeCharacterStats — Kalla\'s Fervor stacks (0/mid/max), end to end', () => {
  it.each([0, 3, KALLA_FERVOR_MAX_STACKS])('scales outgoing/condition-damage/life-steal %% linearly at %i stacks, base rate', (stacks) => {
    const build = makeBuild()
    const combatState: CombatState = { ...DEFAULT_COMBAT_STATE, kallaFervorStacks: stacks }
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [] }, combatState)
    expect(derived.outgoingDamagePercent).toBe(stacks * KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK)
    expect(derived.outgoingConditionDamagePercent).toBe(stacks * KALLA_FERVOR_CONDITION_DAMAGE_PERCENT_PER_STACK)
    expect(derived.lifeStealPercent).toBe(stacks * KALLA_FERVOR_LIFE_STEAL_PERCENT_PER_STACK)
  })

  it.each([0, 3, KALLA_FERVOR_MAX_STACKS])('scales at the improved 3%%/stack rate at %i stacks once Lasting Legacy is chosen', (stacks) => {
    const { build, traitsById } = buildWithTrait(LASTING_LEGACY_TRAIT_ID, 'Major')
    const combatState: CombatState = { ...DEFAULT_COMBAT_STATE, kallaFervorStacks: stacks }
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [...traitsById.values()] }, combatState)
    expect(derived.outgoingDamagePercent).toBe(stacks * KALLA_FERVOR_IMPROVED_STRIKE_DAMAGE_PERCENT_PER_STACK)
    expect(derived.outgoingConditionDamagePercent).toBe(stacks * KALLA_FERVOR_IMPROVED_CONDITION_DAMAGE_PERCENT_PER_STACK)
    expect(derived.lifeStealPercent).toBe(stacks * KALLA_FERVOR_IMPROVED_LIFE_STEAL_PERCENT_PER_STACK)
  })

  it('adds the curated relic bonus onto outgoingDamagePercent only while relicActive is on, combined with Kalla\'s Fervor', () => {
    const relicId = 100262 // Relic of Fireworks
    const build = makeBuild({ relicId })
    const withRelicOff = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [] }, { ...DEFAULT_COMBAT_STATE, relicActive: false, kallaFervorStacks: 5 })
    expect(withRelicOff.derived.outgoingDamagePercent).toBe(5 * KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK)

    const withRelicOn = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [] }, { ...DEFAULT_COMBAT_STATE, relicActive: true, kallaFervorStacks: 5 })
    expect(withRelicOn.derived.outgoingDamagePercent).toBe(CURATED_RELIC_DAMAGE_BONUSES[relicId] + 5 * KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK)
  })
})

describe('computeCharacterStats — Rising Momentum movement speed (upkeepPoints, trait-gated)', () => {
  it('stays 0 regardless of upkeepPoints when Rising Momentum is not chosen', () => {
    const build = makeBuild()
    const combatState: CombatState = { ...DEFAULT_COMBAT_STATE, upkeepPoints: 11 }
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [] }, combatState)
    expect(derived.movementSpeedPercent).toBe(0)
  })

  it.each([0, 6, 11])('scales linearly at %i points of upkeep once Rising Momentum is chosen', (upkeepPoints) => {
    const { build, traitsById } = buildWithTrait(RISING_MOMENTUM_TRAIT_ID, 'Major')
    const combatState: CombatState = { ...DEFAULT_COMBAT_STATE, upkeepPoints }
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [...traitsById.values()] }, combatState)
    expect(derived.movementSpeedPercent).toBe(upkeepPoints * RISING_MOMENTUM_MOVEMENT_SPEED_PERCENT_PER_UPKEEP_POINT)
  })
})

describe('computeCharacterStats — furyActive critical chance (off / on / on with curated trait)', () => {
  it('adds nothing while Fury is off', () => {
    const build = makeBuild()
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [] }, { ...DEFAULT_COMBAT_STATE, furyActive: false })
    expect(derived.criticalChance).toBe(BASE_CRITICAL_CHANCE_PERCENT)
  })

  it('adds the flat Fury critical-chance bonus while Fury is on', () => {
    const build = makeBuild()
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [] }, { ...DEFAULT_COMBAT_STATE, furyActive: true })
    expect(derived.criticalChance).toBe(BASE_CRITICAL_CHANCE_PERCENT + FURY_CRITICAL_CHANCE_PERCENT)
  })

  it('stacks a curated Fury-gated crit-chance trait on top (Roiling Mists)', () => {
    const { build, traitsById } = buildWithTrait(1719, 'Major')
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [...traitsById.values()] }, { ...DEFAULT_COMBAT_STATE, furyActive: true })
    expect(derived.criticalChance).toBe(BASE_CRITICAL_CHANCE_PERCENT + FURY_CRITICAL_CHANCE_PERCENT + 20)
  })
})
