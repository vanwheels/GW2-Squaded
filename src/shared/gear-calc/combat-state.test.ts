import { describe, expect, it } from 'vitest'
import type { Build, Trait, TraitSlot } from '../types'
import {
  AEGIS_DAMAGE_TRAIT_BONUSES,
  CELESTIAL_AVATAR_OUTGOING_HEALING_TRAIT_BONUSES,
  combatStatePoints,
  CURATED_FOOD_OUTGOING_HEALING_BONUSES,
  CURATED_RELIC_CONDITION_DAMAGE_BONUSES,
  CURATED_RELIC_DAMAGE_BONUSES,
  CURATED_RELIC_OUTGOING_HEALING_BONUSES,
  CURATED_SIGIL_CONDITION_DAMAGE_BONUSES,
  CURATED_SIGIL_DAMAGE_BONUSES,
  CURATED_SIGIL_OUTGOING_HEALING_BONUSES,
  CURATED_UTILITY_OUTGOING_HEALING_ATTRIBUTE_SCALING,
  DEATHS_CARAPACE_TOUGHNESS_PER_STACK,
  DEFAULT_COMBAT_STATE,
  FLAT_DAMAGE_TRAIT_BONUSES,
  FORCE_OF_WILL_HEALING_PERCENT_PER_100_VITALITY,
  FORCE_OF_WILL_TRAIT_ID,
  FURY_CRITICAL_CHANCE_PERCENT,
  FURY_DAMAGE_TRAIT_BONUSES,
  HIGH_HEALTH_DAMAGE_TRAIT_BONUSES,
  INVOKING_HARMONY_HEALING_PERCENT,
  INVOKING_HARMONY_TRAIT_ID,
  KALLA_FERVOR_CONDITION_DAMAGE_PERCENT_PER_STACK,
  KALLA_FERVOR_IMPROVED_CONDITION_DAMAGE_PERCENT_PER_STACK,
  KALLA_FERVOR_IMPROVED_LIFE_STEAL_PERCENT_PER_STACK,
  KALLA_FERVOR_IMPROVED_STRIKE_DAMAGE_PERCENT_PER_STACK,
  KALLA_FERVOR_LIFE_STEAL_PERCENT_PER_STACK,
  KALLA_FERVOR_MAX_STACKS,
  KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK,
  kallaFervorPercentPerStack,
  LASTING_LEGACY_TRAIT_ID,
  MECHANIC_ACTIVE_DAMAGE_TRAIT_BONUSES,
  MED_KIT_OUTGOING_HEALING_TRAIT_BONUSES,
  MED_KIT_SKILL_ID,
  MIGHT_CONDITION_DAMAGE_PER_STACK,
  MIGHT_POWER_PER_STACK,
  NOT_FULL_ENDURANCE_DAMAGE_TRAIT_BONUSES,
  NUMINOUS_GIFT_TRAIT_ID,
  PER_BOON_DAMAGE_TRAIT_BONUSES,
  resolveIncomingHealingPercent,
  resolveMovementSpeedPercent,
  resolveOutgoingConditionDamagePercent,
  resolveOutgoingDamagePercent,
  resolveOutgoingHealingPercent,
  RESOLUTION_DAMAGE_TRAIT_BONUSES,
  RIGHTEOUS_REBEL_HEALING_PERCENT,
  RIGHTEOUS_REBEL_TRAIT_ID,
  RISING_MOMENTUM_MOVEMENT_SPEED_PERCENT_PER_UPKEEP_POINT,
  RISING_MOMENTUM_TRAIT_ID,
  SERENE_REJUVENATION_BASE_HEALING_PERCENT,
  SERENE_REJUVENATION_TRAIT_ID,
  SERENE_REJUVENATION_UPGRADED_HEALING_PERCENT,
  SIGIL_OF_FORCE_DAMAGE_PERCENT,
  SIGIL_OF_FORCE_ID,
  SIGIL_OF_THE_NIGHT_ADDITIONAL_NIGHT_DAMAGE_PERCENT,
  SIGIL_OF_THE_NIGHT_BASE_DAMAGE_PERCENT,
  SIGIL_OF_THE_NIGHT_ID,
  STABILITY_DAMAGE_TRAIT_BONUSES,
  SWIFTNESS_DAMAGE_TRAIT_BONUSES,
  VIGOR_DAMAGE_TRAIT_BONUSES,
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
      outgoingHealing: 0,
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
      outgoingHealing: 0,
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

describe('resolveMovementSpeedPercent — "highest value wins" across sources, Rising Momentum additive on top', () => {
  it('is 0 with no gear/trait/relic contribution', () => {
    const build = makeBuild()
    expect(resolveMovementSpeedPercent(build, DEFAULT_COMBAT_STATE, 0, NO_TRAITS)).toBe(0)
  })

  it('takes the gear (rune) contribution alone when no trait/relic competes', () => {
    const build = makeBuild()
    expect(resolveMovementSpeedPercent(build, DEFAULT_COMBAT_STATE, 25, NO_TRAITS)).toBe(25)
  })

  it('does NOT sum an unconditional trait onto an equal gear contribution — takes the max, not the total', () => {
    const { build, traitsById } = buildWithTrait(1859, 'Minor') // Time Marches On
    expect(resolveMovementSpeedPercent(build, DEFAULT_COMBAT_STATE, 25, traitsById)).toBe(25)
  })

  it('takes the higher of two competing sources', () => {
    const { build, traitsById } = buildWithTrait(1859, 'Minor') // Time Marches On, 25%
    expect(resolveMovementSpeedPercent(build, DEFAULT_COMBAT_STATE, 10, traitsById)).toBe(25)
  })

  it('gates Zephyr\'s Speed on Air attunement specifically', () => {
    const { build, traitsById } = buildWithTrait(221, 'Minor') // Zephyr's Speed
    const onAir = makeBuild({ specializations: build.specializations, activeAttunement: 'Air' })
    const onFire = makeBuild({ specializations: build.specializations, activeAttunement: 'Fire' })
    expect(resolveMovementSpeedPercent(onAir, DEFAULT_COMBAT_STATE, 0, traitsById)).toBe(25)
    expect(resolveMovementSpeedPercent(onFire, DEFAULT_COMBAT_STATE, 0, traitsById)).toBe(0)
  })

  it('gates Furious Focus on combatState.furyActive', () => {
    const { build, traitsById } = buildWithTrait(2017, 'Major') // Furious Focus
    expect(resolveMovementSpeedPercent(build, { ...DEFAULT_COMBAT_STATE, furyActive: true }, 0, traitsById)).toBe(33)
    expect(resolveMovementSpeedPercent(build, { ...DEFAULT_COMBAT_STATE, furyActive: false }, 0, traitsById)).toBe(0)
  })

  it('gates Aggressive Onslaught on combatState.quicknessActive', () => {
    const { build, traitsById } = buildWithTrait(1440, 'Major') // Aggressive Onslaught
    expect(resolveMovementSpeedPercent(build, { ...DEFAULT_COMBAT_STATE, quicknessActive: true }, 0, traitsById)).toBe(33)
    expect(resolveMovementSpeedPercent(build, { ...DEFAULT_COMBAT_STATE, quicknessActive: false }, 0, traitsById)).toBe(0)
  })

  it('gates Warrior\'s Sprint on wielding a melee weapon (either hand, active set only)', () => {
    const { build, traitsById } = buildWithTrait(1413, 'Major') // Warrior's Sprint
    const withSword = makeBuild({
      specializations: build.specializations,
      equipment: { weaponA1: { itemStatId: null, weaponType: 'Sword' } }
    })
    const withRifle = makeBuild({
      specializations: build.specializations,
      equipment: { weaponA1: { itemStatId: null, weaponType: 'Rifle' } }
    })
    expect(resolveMovementSpeedPercent(withSword, DEFAULT_COMBAT_STATE, 0, traitsById)).toBe(25)
    expect(resolveMovementSpeedPercent(withRifle, DEFAULT_COMBAT_STATE, 0, traitsById)).toBe(0)
  })

  it('gates Relic of the Wayfinder on relicActive AND the equipped relic actually being it', () => {
    const build = makeBuild({ relicId: 101943 })
    expect(resolveMovementSpeedPercent(build, { ...DEFAULT_COMBAT_STATE, relicActive: true }, 0, NO_TRAITS)).toBe(25)
    expect(resolveMovementSpeedPercent(build, { ...DEFAULT_COMBAT_STATE, relicActive: false }, 0, NO_TRAITS)).toBe(0)
    const otherRelic = makeBuild({ relicId: 999999 })
    expect(resolveMovementSpeedPercent(otherRelic, { ...DEFAULT_COMBAT_STATE, relicActive: true }, 0, NO_TRAITS)).toBe(0)
  })

  it("adds Rising Momentum's contribution ON TOP of the highest competing source rather than competing with it", () => {
    // Both traits share one synthetic specialization line here (`buildWithTraits`'s own shape) —
    // in a real build these would be different lines (Herald/Chronomancer), but only whether each
    // trait is *active* matters for this isolated combine-logic check, not which line grants it.
    const { build, traitsById } = buildWithTraits([
      { id: RISING_MOMENTUM_TRAIT_ID, slot: 'Major' },
      { id: 1859, slot: 'Minor' } // Time Marches On, 25%
    ])
    const combatState: CombatState = { ...DEFAULT_COMBAT_STATE, upkeepPoints: 4 } // +20%
    expect(resolveMovementSpeedPercent(build, combatState, 0, traitsById)).toBe(25 + 20)
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

const ZERO_HEALING_ATTRIBUTES = { healingPower: 0, concentration: 0, vitality: 1000 } // base Vitality with no gear

describe('resolveOutgoingHealingPercent — flat trait sources', () => {
  it('is 0 with no curated trait chosen', () => {
    const build = makeBuild()
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(0)
  })

  it('sums 2 independent flat curated traits (Life from Death + Illusionary Inspiration)', () => {
    const { build, traitsById } = buildWithTraits([
      { id: 789, slot: 'Major' }, // Life from Death: +10%
      { id: 1915, slot: 'Minor' } // Illusionary Inspiration: +5%
    ])
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(15)
  })

  it("sums Stalwart Focus's own outgoing half independently of its incoming half", () => {
    const { build, traitsById } = buildWithTrait(1381, 'Major') // Stalwart Focus
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(10)
    expect(resolveIncomingHealingPercent(build, traitsById)).toBe(3)
  })
})

describe("resolveOutgoingHealingPercent — Righteous Rebel (Kalla's Fervor per-stack healing share)", () => {
  it("contributes nothing per Kalla's Fervor stack without Righteous Rebel chosen", () => {
    const build = makeBuild()
    const result = resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, kallaFervorStacks: KALLA_FERVOR_MAX_STACKS }, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)
    expect(result).toBe(0)
  })

  it.each([1, 3, KALLA_FERVOR_MAX_STACKS])('contributes the same flat %% at any stack count ≥ 1 once Righteous Rebel is chosen (%i stacks)', (stacks) => {
    const { build, traitsById } = buildWithTrait(RIGHTEOUS_REBEL_TRAIT_ID, 'Major')
    const result = resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, kallaFervorStacks: stacks }, traitsById, ZERO_HEALING_ATTRIBUTES)
    expect(result).toBe(RIGHTEOUS_REBEL_HEALING_PERCENT)
  })

  it('contributes nothing at 0 stacks even with Righteous Rebel chosen', () => {
    const { build, traitsById } = buildWithTrait(RIGHTEOUS_REBEL_TRAIT_ID, 'Major')
    const result = resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, kallaFervorStacks: 0 }, traitsById, ZERO_HEALING_ATTRIBUTES)
    expect(result).toBe(0)
  })
})

describe('resolveOutgoingHealingPercent — Serene Rejuvenation (auto-active minor, Numinous-Gift-upgraded)', () => {
  it('grants the base % once Salvation is equipped, with no other trait chosen', () => {
    const { build, traitsById } = buildWithTrait(SERENE_REJUVENATION_TRAIT_ID, 'Minor')
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(SERENE_REJUVENATION_BASE_HEALING_PERCENT)
  })

  it('upgrades to the higher % once Numinous Gift is also chosen', () => {
    const { build, traitsById } = buildWithTraits([
      { id: SERENE_REJUVENATION_TRAIT_ID, slot: 'Minor' },
      { id: NUMINOUS_GIFT_TRAIT_ID, slot: 'Major' }
    ])
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(SERENE_REJUVENATION_UPGRADED_HEALING_PERCENT)
  })
})

describe('resolveOutgoingHealingPercent — Invoking Harmony (proc-window gated)', () => {
  it('contributes nothing while the proc window is off, even with the trait chosen', () => {
    const { build, traitsById } = buildWithTrait(INVOKING_HARMONY_TRAIT_ID, 'Major')
    expect(resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, invokingHarmonyActive: false }, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(0)
  })

  it('contributes its flat % while the proc window is on and the trait is chosen', () => {
    const { build, traitsById } = buildWithTrait(INVOKING_HARMONY_TRAIT_ID, 'Major')
    expect(resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, invokingHarmonyActive: true }, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(
      INVOKING_HARMONY_HEALING_PERCENT
    )
  })

  it('never contributes when the toggle is on but the trait is not actually chosen', () => {
    const build = makeBuild()
    expect(resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, invokingHarmonyActive: true }, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(0)
  })
})

describe('resolveOutgoingHealingPercent — Lingering Light (Celestial Avatar form gated)', () => {
  it('contributes nothing outside Celestial Avatar form', () => {
    const { build, traitsById } = buildWithTrait(2058, 'Major') // Lingering Light
    expect(resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, celestialAvatarActive: false }, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(0)
  })

  it('contributes its flat % while in Celestial Avatar form', () => {
    const { build, traitsById } = buildWithTrait(2058, 'Major')
    expect(resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, celestialAvatarActive: true }, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(
      CELESTIAL_AVATAR_OUTGOING_HEALING_TRAIT_BONUSES[2058]
    )
  })
})

describe('resolveOutgoingHealingPercent — Force of Will (continuous per-100-Vitality scaling)', () => {
  it('is 0 without the trait chosen, regardless of Vitality', () => {
    const build = makeBuild()
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS, { healingPower: 0, concentration: 0, vitality: 2500 })).toBe(0)
  })

  it.each([1000, 1500, 2500])('scales continuously (not stepped) at %i Vitality once chosen', (vitality) => {
    const { build, traitsById } = buildWithTrait(FORCE_OF_WILL_TRAIT_ID, 'Major')
    const result = resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, traitsById, { healingPower: 0, concentration: 0, vitality })
    expect(result).toBeCloseTo((vitality / 100) * FORCE_OF_WILL_HEALING_PERCENT_PER_100_VITALITY)
  })
})

describe('resolveOutgoingHealingPercent — Health Insurance (Med Kit heal-skill gated)', () => {
  it('contributes its flat incoming % regardless of Med Kit, but 0 outgoing without Med Kit equipped', () => {
    const { build, traitsById } = buildWithTrait(521, 'Major') // Health Insurance
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(0)
    expect(resolveIncomingHealingPercent(build, traitsById)).toBe(10)
  })

  it('adds the Med-Kit-gated outgoing % once Med Kit is the equipped Heal skill', () => {
    const { build, traitsById } = buildWithTrait(521, 'Major')
    const withMedKit: Build = { ...build, skills: { kind: 'standard', heal: MED_KIT_SKILL_ID, utility: [null, null, null], elite: null } }
    expect(resolveOutgoingHealingPercent(withMedKit, DEFAULT_COMBAT_STATE, traitsById, ZERO_HEALING_ATTRIBUTES)).toBe(MED_KIT_OUTGOING_HEALING_TRAIT_BONUSES[521])
  })
})

describe('resolveOutgoingHealingPercent — curated relic (Relic of Castora, health-threshold-proc gated)', () => {
  it('contributes nothing while relicActive is off', () => {
    const build = makeBuild({ relicId: 105652 })
    expect(resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, relicActive: false }, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(0)
  })

  it('contributes the curated bonus while relicActive is on and the relic is equipped', () => {
    const build = makeBuild({ relicId: 105652 })
    expect(resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, relicActive: true }, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(
      CURATED_RELIC_OUTGOING_HEALING_BONUSES[105652]
    )
  })
})

describe('resolveOutgoingHealingPercent — curated sigil (Superior Sigil of Transference, active-set-only, doubles on dual 1h)', () => {
  const sigilId = 74326

  it('contributes nothing when equipped only on the inactive weapon set', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: { weaponB1: { itemStatId: null, sigilIds: [sigilId] } }
    })
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(0)
  })

  it('contributes once when equipped on one active-set weapon', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: { weaponA1: { itemStatId: null, sigilIds: [sigilId] } }
    })
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(CURATED_SIGIL_OUTGOING_HEALING_BONUSES[sigilId])
  })

  it('doubles when equipped on both active-set main-hand and off-hand weapons', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: {
        weaponA1: { itemStatId: null, sigilIds: [sigilId] },
        weaponA2: { itemStatId: null, sigilIds: [sigilId] }
      }
    })
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(2 * CURATED_SIGIL_OUTGOING_HEALING_BONUSES[sigilId])
  })
})

describe("resolveOutgoingHealingPercent — Superior Sigil of Benevolence (stacking sigil, reuses stackingSigilStacks)", () => {
  const sigilId = 24584

  it('contributes nothing at 0 stacks even when equipped', () => {
    const build = makeBuild({ equipment: { weaponA1: { itemStatId: null, sigilIds: [sigilId] } } })
    expect(resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, stackingSigilStacks: 0 }, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(0)
  })

  it.each([5, 25])('scales at 0.5%% per stack, at %i stacks', (stacks) => {
    const build = makeBuild({ equipment: { weaponA1: { itemStatId: null, sigilIds: [sigilId] } } })
    const result = resolveOutgoingHealingPercent(build, { ...DEFAULT_COMBAT_STATE, stackingSigilStacks: stacks }, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)
    expect(result).toBeCloseTo(stacks * 0.5)
  })

  it("does not feed OutgoingHealingPercent into combatStatePoints's core-attribute totals", () => {
    const build = makeBuild({ equipment: { weaponA1: { itemStatId: null, sigilIds: [sigilId] } } })
    const points = combatStatePoints(build, { ...DEFAULT_COMBAT_STATE, stackingSigilStacks: 25 }, NO_TRAITS)
    expect(points.OutgoingHealingPercent).toBeUndefined()
  })
})

describe('resolveOutgoingHealingPercent — curated food/utility', () => {
  it('sums a flat curated food bonus (Bowl of Tapioca Pudding)', () => {
    const build = makeBuild({ foodId: 76840 })
    expect(resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS, ZERO_HEALING_ATTRIBUTES)).toBe(CURATED_FOOD_OUTGOING_HEALING_BONUSES[76840])
  })

  it('scales the Bountiful Maintenance Oil family continuously by Healing Power and Concentration', () => {
    const build = makeBuild({ utilityId: 67528 })
    const scaling = CURATED_UTILITY_OUTGOING_HEALING_ATTRIBUTE_SCALING[67528]
    const attributes = { healingPower: 300, concentration: 200, vitality: 1000 }
    const result = resolveOutgoingHealingPercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS, attributes)
    expect(result).toBeCloseTo((300 / 100) * scaling.perHealingPower + (200 / 100) * scaling.perConcentration)
  })
})

describe('resolveIncomingHealingPercent', () => {
  it('is 0 with no curated trait chosen', () => {
    expect(resolveIncomingHealingPercent(makeBuild(), NO_TRAITS)).toBe(0)
  })

  it('sums 2 independent flat curated traits (Health Insurance + Vital Persistence)', () => {
    const { build, traitsById } = buildWithTraits([
      { id: 521, slot: 'Major' }, // Health Insurance: +10%
      { id: 861, slot: 'Major' } // Vital Persistence: +10%
    ])
    expect(resolveIncomingHealingPercent(build, traitsById)).toBe(20)
  })
})

describe('computeCharacterStats — outgoingHealingPercent/incomingHealingPercent end to end', () => {
  it('reflects a flat trait bonus through the full attribute/derived-stats pipeline', () => {
    const { build, traitsById } = buildWithTrait(789, 'Major') // Life from Death
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [...traitsById.values()] }, DEFAULT_COMBAT_STATE)
    expect(derived.outgoingHealingPercent).toBe(10)
    expect(derived.incomingHealingPercent).toBe(0)
  })
})

// 2026-08-22 "Outgoing Damage % full pass" — mirrors the resolveOutgoingHealingPercent test suite
// above, same "0/mid/max points of the state space" reasoning.

describe('resolveOutgoingDamagePercent — curated relic, proc-window gated (Relic of Isgarren)', () => {
  it('contributes nothing while relicActive is off', () => {
    const build = makeBuild({ relicId: 99997 })
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, relicActive: false }, NO_TRAITS)).toBe(0)
  })

  it('contributes the curated bonus while relicActive is on and the relic is equipped', () => {
    const build = makeBuild({ relicId: 99997 })
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, relicActive: true }, NO_TRAITS)).toBe(CURATED_RELIC_DAMAGE_BONUSES[99997])
  })
})

describe('resolveOutgoingDamagePercent — curated relic, modeled at its per-stack max (Relic of the Thief)', () => {
  it('contributes the max-stack value (5 stacks * 1%), not a single stack', () => {
    const build = makeBuild({ relicId: 100916 })
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, relicActive: true }, NO_TRAITS)).toBe(5)
  })
})

describe("resolveOutgoingDamagePercent/resolveOutgoingConditionDamagePercent — Relic of Nourys's split strike/condition halves", () => {
  it('contributes its strike-damage half to outgoingDamagePercent and condition-damage half to outgoingConditionDamagePercent', () => {
    const build = makeBuild({ relicId: 101191 })
    const state = { ...DEFAULT_COMBAT_STATE, relicActive: true }
    expect(resolveOutgoingDamagePercent(build, state, NO_TRAITS)).toBe(CURATED_RELIC_DAMAGE_BONUSES[101191])
    expect(resolveOutgoingConditionDamagePercent(build, state, NO_TRAITS)).toBe(CURATED_RELIC_CONDITION_DAMAGE_BONUSES[101191])
  })
})

describe("resolveOutgoingDamagePercent — Kalla's Fervor per-stack strike-damage share (0/mid/max stacks)", () => {
  it.each([0, 3, KALLA_FERVOR_MAX_STACKS])('scales at %i stacks', (stacks) => {
    const build = makeBuild()
    const result = resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, kallaFervorStacks: stacks }, NO_TRAITS)
    expect(result).toBe(stacks * KALLA_FERVOR_STRIKE_DAMAGE_PERCENT_PER_STACK)
  })
})

describe('resolveOutgoingDamagePercent — Superior Sigil of Force (single application, does NOT double on dual weapons)', () => {
  it('contributes the flat bonus once when equipped on one active-set weapon', () => {
    const build = makeBuild({ activeWeaponSet: 'A', equipment: { weaponA1: { itemStatId: null, sigilIds: [SIGIL_OF_FORCE_ID] } } })
    expect(resolveOutgoingDamagePercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS)).toBe(SIGIL_OF_FORCE_DAMAGE_PERCENT)
  })

  it('still contributes only once when equipped on both active-set main-hand and off-hand weapons', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: {
        weaponA1: { itemStatId: null, sigilIds: [SIGIL_OF_FORCE_ID] },
        weaponA2: { itemStatId: null, sigilIds: [SIGIL_OF_FORCE_ID] }
      }
    })
    expect(resolveOutgoingDamagePercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS)).toBe(SIGIL_OF_FORCE_DAMAGE_PERCENT)
  })

  it('contributes nothing when equipped only on the inactive weapon set', () => {
    const build = makeBuild({ activeWeaponSet: 'A', equipment: { weaponB1: { itemStatId: null, sigilIds: [SIGIL_OF_FORCE_ID] } } })
    expect(resolveOutgoingDamagePercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS)).toBe(0)
  })
})

describe("resolveOutgoingDamagePercent — Slaying-family sigil's unconditional +3% baseline (Superior Sigil of Undead Slaying)", () => {
  const sigilId = 24642

  it('contributes the flat baseline once when equipped on one active-set weapon', () => {
    const build = makeBuild({ activeWeaponSet: 'A', equipment: { weaponA1: { itemStatId: null, sigilIds: [sigilId] } } })
    expect(resolveOutgoingDamagePercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS)).toBe(CURATED_SIGIL_DAMAGE_BONUSES[sigilId])
  })

  it('doubles when equipped on both active-set main-hand and off-hand weapons', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: {
        weaponA1: { itemStatId: null, sigilIds: [sigilId] },
        weaponA2: { itemStatId: null, sigilIds: [sigilId] }
      }
    })
    expect(resolveOutgoingDamagePercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS)).toBe(2 * CURATED_SIGIL_DAMAGE_BONUSES[sigilId])
  })
})

describe('resolveOutgoingDamagePercent — Superior Sigil of the Night (day/night-gated, doubles per slot)', () => {
  it('contributes only its always-on base share during the day', () => {
    const build = makeBuild({ activeWeaponSet: 'A', equipment: { weaponA1: { itemStatId: null, sigilIds: [SIGIL_OF_THE_NIGHT_ID] } } })
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, nightActive: false }, NO_TRAITS)).toBe(SIGIL_OF_THE_NIGHT_BASE_DAMAGE_PERCENT)
  })

  it('adds the additional night share on top when nightActive is on', () => {
    const build = makeBuild({ activeWeaponSet: 'A', equipment: { weaponA1: { itemStatId: null, sigilIds: [SIGIL_OF_THE_NIGHT_ID] } } })
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, nightActive: true }, NO_TRAITS)).toBe(
      SIGIL_OF_THE_NIGHT_BASE_DAMAGE_PERCENT + SIGIL_OF_THE_NIGHT_ADDITIONAL_NIGHT_DAMAGE_PERCENT
    )
  })

  it('doubles both shares when equipped on both active-set weapons at night', () => {
    const build = makeBuild({
      activeWeaponSet: 'A',
      equipment: {
        weaponA1: { itemStatId: null, sigilIds: [SIGIL_OF_THE_NIGHT_ID] },
        weaponA2: { itemStatId: null, sigilIds: [SIGIL_OF_THE_NIGHT_ID] }
      }
    })
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, nightActive: true }, NO_TRAITS)).toBe(
      2 * (SIGIL_OF_THE_NIGHT_BASE_DAMAGE_PERCENT + SIGIL_OF_THE_NIGHT_ADDITIONAL_NIGHT_DAMAGE_PERCENT)
    )
  })
})

describe('resolveOutgoingConditionDamagePercent — curated sigil (Superior Sigil of Bursting) + Kalla\'s Fervor', () => {
  it('sums the flat curated sigil bonus with 0 combat-state contribution', () => {
    const build = makeBuild({ activeWeaponSet: 'A', equipment: { weaponA1: { itemStatId: null, sigilIds: [44944] } } })
    expect(resolveOutgoingConditionDamagePercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS)).toBe(CURATED_SIGIL_CONDITION_DAMAGE_BONUSES[44944])
  })

  it("adds Kalla's Fervor's per-stack condition-damage share on top", () => {
    const build = makeBuild({ activeWeaponSet: 'A', equipment: { weaponA1: { itemStatId: null, sigilIds: [44944] } } })
    const result = resolveOutgoingConditionDamagePercent(build, { ...DEFAULT_COMBAT_STATE, kallaFervorStacks: 3 }, NO_TRAITS)
    expect(result).toBe(CURATED_SIGIL_CONDITION_DAMAGE_BONUSES[44944] + 3 * KALLA_FERVOR_CONDITION_DAMAGE_PERCENT_PER_STACK)
  })
})

describe('resolveOutgoingDamagePercent — Furious Focus (Fury-gated trait)', () => {
  it('contributes nothing when the trait is not chosen, even with Fury active', () => {
    const build = makeBuild()
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, furyActive: true }, NO_TRAITS)).toBe(0)
  })

  it('contributes nothing while chosen but Fury is inactive', () => {
    const { build, traitsById } = buildWithTrait(2017, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, furyActive: false }, traitsById)).toBe(0)
  })

  it('contributes the flat bonus once chosen and Fury is active', () => {
    const { build, traitsById } = buildWithTrait(2017, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, furyActive: true }, traitsById)).toBe(FURY_DAMAGE_TRAIT_BONUSES[2017])
  })
})

describe('resolveOutgoingDamagePercent — Retribution (Resolution-gated trait)', () => {
  it('contributes nothing while chosen but Resolution is inactive', () => {
    const { build, traitsById } = buildWithTrait(565, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, resolutionActive: false }, traitsById)).toBe(0)
  })

  it('contributes the flat bonus once chosen and Resolution is active', () => {
    const { build, traitsById } = buildWithTrait(565, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, resolutionActive: true }, traitsById)).toBe(
      RESOLUTION_DAMAGE_TRAIT_BONUSES[565]
    )
  })
})

describe('resolveOutgoingDamagePercent — Inspired Virtue (per-active-boon trait)', () => {
  it.each([0, 4, 10])('scales linearly with activeBoonCount at %i boons', (boons) => {
    const { build, traitsById } = buildWithTrait(621, 'Minor')
    const result = resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, activeBoonCount: boons }, traitsById)
    expect(result).toBe(boons * PER_BOON_DAMAGE_TRAIT_BONUSES[621])
  })

  it('contributes nothing when the trait is not chosen, even with boons active', () => {
    const build = makeBuild()
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, activeBoonCount: 8 }, NO_TRAITS)).toBe(0)
  })
})

describe('resolveOutgoingDamagePercent — Empowered (per-active-boon trait, shares PER_BOON_DAMAGE_TRAIT_BONUSES with Inspired Virtue)', () => {
  it.each([0, 3, 6])('scales linearly with activeBoonCount at %i boons', (boons) => {
    const { build, traitsById } = buildWithTrait(1485, 'Minor')
    const result = resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, activeBoonCount: boons }, traitsById)
    expect(result).toBe(boons * PER_BOON_DAMAGE_TRAIT_BONUSES[1485])
  })
})

describe("resolveOutgoingDamagePercent — Warrior's Sprint (Swiftness-gated trait)", () => {
  it('contributes nothing while chosen but Swiftness is inactive', () => {
    const { build, traitsById } = buildWithTrait(1413, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, swiftnessActive: false }, traitsById)).toBe(0)
  })

  it('contributes the flat bonus once chosen and Swiftness is active', () => {
    const { build, traitsById } = buildWithTrait(1413, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, swiftnessActive: true }, traitsById)).toBe(
      SWIFTNESS_DAMAGE_TRAIT_BONUSES[1413]
    )
  })

  it('contributes nothing when the trait is not chosen, even with Swiftness active', () => {
    const build = makeBuild()
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, swiftnessActive: true }, NO_TRAITS)).toBe(0)
  })
})

describe('resolveOutgoingDamagePercent — Stalwart Strength (Stability-gated trait)', () => {
  it('contributes nothing while chosen but Stability is inactive', () => {
    const { build, traitsById } = buildWithTrait(1708, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, stabilityActive: false }, traitsById)).toBe(0)
  })

  it('contributes the flat bonus once chosen and Stability is active', () => {
    const { build, traitsById } = buildWithTrait(1708, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, stabilityActive: true }, traitsById)).toBe(
      STABILITY_DAMAGE_TRAIT_BONUSES[1708]
    )
  })
})

describe('resolveOutgoingDamagePercent — Bloody Roar (mechanic-active-gated trait)', () => {
  it('contributes nothing while chosen but the mechanic is inactive', () => {
    const { build, traitsById } = buildWithTrait(1928, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, mechanicActive: false }, traitsById)).toBe(0)
  })

  it('contributes the flat bonus once chosen and the mechanic is active', () => {
    const { build, traitsById } = buildWithTrait(1928, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, mechanicActive: true }, traitsById)).toBe(
      MECHANIC_ACTIVE_DAMAGE_TRAIT_BONUSES[1928]
    )
  })
})

describe('resolveOutgoingDamagePercent — Peak Performance (flat, unconditional baseline)', () => {
  it('contributes the flat bonus once chosen, no combat-state gating needed', () => {
    const { build, traitsById } = buildWithTrait(1444, 'Major')
    expect(resolveOutgoingDamagePercent(build, DEFAULT_COMBAT_STATE, traitsById)).toBe(FLAT_DAMAGE_TRAIT_BONUSES[1444])
  })

  it('contributes nothing when the trait is not chosen', () => {
    const build = makeBuild()
    expect(resolveOutgoingDamagePercent(build, DEFAULT_COMBAT_STATE, NO_TRAITS)).toBe(0)
  })
})

describe('resolveOutgoingDamagePercent — Unscathed Contender (Aegis-gated + health-threshold-gated halves)', () => {
  it('contributes nothing when neither Aegis nor the health threshold is met', () => {
    const { build, traitsById } = buildWithTrait(624, 'Major')
    expect(
      resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, aegisActive: false, healthTier: 'below50' }, traitsById)
    ).toBe(0)
  })

  it('contributes the Aegis-gated half while Aegis is active', () => {
    const { build, traitsById } = buildWithTrait(624, 'Major')
    expect(
      resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, aegisActive: true, healthTier: 'below50' }, traitsById)
    ).toBe(AEGIS_DAMAGE_TRAIT_BONUSES[624])
  })

  it('contributes the health-threshold-gated half while above the threshold', () => {
    const { build, traitsById } = buildWithTrait(624, 'Major')
    expect(
      resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, aegisActive: false, healthTier: 'above75' }, traitsById)
    ).toBe(HIGH_HEALTH_DAMAGE_TRAIT_BONUSES[624].aboveThreshold)
  })

  it('stacks both halves when Aegis is active and above the health threshold', () => {
    const { build, traitsById } = buildWithTrait(624, 'Major')
    expect(
      resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, aegisActive: true, healthTier: 'above75' }, traitsById)
    ).toBe(AEGIS_DAMAGE_TRAIT_BONUSES[624] + HIGH_HEALTH_DAMAGE_TRAIT_BONUSES[624].aboveThreshold)
  })
})

describe('resolveOutgoingDamagePercent — Flow like Water (baseline + health-threshold-gated halves)', () => {
  it('contributes only the baseline when below the health threshold', () => {
    const { build, traitsById } = buildWithTrait(349, 'Major')
    expect(
      resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, healthTier: 'below50' }, traitsById)
    ).toBe(HIGH_HEALTH_DAMAGE_TRAIT_BONUSES[349].otherwise)
  })

  it('contributes the full above-threshold bonus when above the health threshold', () => {
    const { build, traitsById } = buildWithTrait(349, 'Major')
    expect(
      resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, healthTier: 'above75' }, traitsById)
    ).toBe(HIGH_HEALTH_DAMAGE_TRAIT_BONUSES[349].aboveThreshold)
  })

  it('contributes nothing when the trait is not chosen', () => {
    const build = makeBuild()
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, healthTier: 'above75' }, NO_TRAITS)).toBe(0)
  })
})

describe('resolveOutgoingDamagePercent — Glass Cannon (health-threshold-gated, no baseline)', () => {
  it('contributes nothing when below the health threshold', () => {
    const { build, traitsById } = buildWithTrait(1882, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, healthTier: 'below50' }, traitsById)).toBe(0)
  })

  it('contributes the flat bonus when above the health threshold', () => {
    const { build, traitsById } = buildWithTrait(1882, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, healthTier: 'above75' }, traitsById)).toBe(
      HIGH_HEALTH_DAMAGE_TRAIT_BONUSES[1882].aboveThreshold
    )
  })
})

describe('resolveOutgoingDamagePercent — Takedown Round (Not-Full-Endurance-gated trait)', () => {
  it('contributes nothing while endurance is full', () => {
    const { build, traitsById } = buildWithTrait(1832, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, fullEnduranceActive: true }, traitsById)).toBe(0)
  })

  it('contributes the flat bonus once endurance is not full', () => {
    const { build, traitsById } = buildWithTrait(1832, 'Major')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, fullEnduranceActive: false }, traitsById)).toBe(
      NOT_FULL_ENDURANCE_DAMAGE_TRAIT_BONUSES[1832]
    )
  })
})

describe('resolveOutgoingDamagePercent — Excessive Energy (Vigor-gated trait)', () => {
  it('contributes nothing while chosen but Vigor is inactive', () => {
    const { build, traitsById } = buildWithTrait(1936, 'Minor')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, vigorActive: false }, traitsById)).toBe(0)
  })

  it('contributes the flat bonus once chosen and Vigor is active', () => {
    const { build, traitsById } = buildWithTrait(1936, 'Minor')
    expect(resolveOutgoingDamagePercent(build, { ...DEFAULT_COMBAT_STATE, vigorActive: true }, traitsById)).toBe(
      VIGOR_DAMAGE_TRAIT_BONUSES[1936]
    )
  })
})

describe('computeCharacterStats — outgoingDamagePercent/outgoingConditionDamagePercent end to end', () => {
  it('reflects a curated relic bonus through the full attribute/derived-stats pipeline', () => {
    const build = makeBuild({ relicId: 104241 }) // Relic of the Eagle
    const { derived } = computeCharacterStats(build, { ...EMPTY_GAME_DATA, traits: [] }, { ...DEFAULT_COMBAT_STATE, relicActive: true })
    expect(derived.outgoingDamagePercent).toBe(CURATED_RELIC_DAMAGE_BONUSES[104241])
    expect(derived.outgoingConditionDamagePercent).toBe(0)
  })
})
