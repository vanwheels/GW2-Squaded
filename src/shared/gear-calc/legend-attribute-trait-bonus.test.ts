import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Build, Legend, Trait } from '../types'
import { activeLegendAttributeTraitBonus, LEGEND_ATTRIBUTE_TRAIT_BONUSES } from './trait-attributes'

/** Regression guard for Bolstered Bonds' real character-stat contribution (2026-08-20, flagged by
 *  the user right after the trait's tooltip-only fix: "I want that built too") — same "lock in
 *  what's already known-correct against the real game data" purpose as `evoker-familiar-facts.test.ts`. */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}
const legends = readJson<Legend[]>('legends.json')

const BOLSTERED_BONDS_ID = 2331
const CONDUIT_SPEC_ID = 79

function makeBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'test-build',
    name: 'Test',
    notes: '',
    profession: 'Revenant',
    specializations: [{ specializationId: CONDUIT_SPEC_ID, chosenTraitIds: [null, null, null] }, null, null],
    skills: { kind: 'revenant', legends: [null, null], activeLegendIndex: 0 },
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

const traitsById = new Map<number, Trait>([
  [
    BOLSTERED_BONDS_ID,
    {
      id: BOLSTERED_BONDS_ID,
      tier: 2,
      order: 0,
      name: 'Bolstered Bonds',
      description: '',
      slot: 'Minor',
      specializationId: CONDUIT_SPEC_ID,
      icon: '',
      facts: [],
      traitedFacts: []
    }
  ]
])

describe('LEGEND_ATTRIBUTE_TRAIT_BONUSES', () => {
  it('every curated legend name matches a real Legend.name in legends.json', () => {
    const realNames = new Set(legends.map((l) => l.name))
    for (const [traitId, byLegendName] of Object.entries(LEGEND_ATTRIBUTE_TRAIT_BONUSES)) {
      for (const legendName of Object.keys(byLegendName)) {
        expect(realNames.has(legendName), `trait ${traitId}: "${legendName}" doesn't match any Legend.name`).toBe(true)
      }
    }
  })
})

describe('activeLegendAttributeTraitBonus', () => {
  it('is a no-op for a non-Revenant build (empty equipped-legend set)', () => {
    const build = makeBuild({ profession: 'Guardian', skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: null } })
    expect(activeLegendAttributeTraitBonus(build, traitsById, legends)).toEqual({})
  })

  it('is a no-op when Bolstered Bonds is not active (spec not equipped)', () => {
    const build = makeBuild({
      specializations: [null, null, null],
      skills: { kind: 'revenant', legends: ['Legend2', 'Legend3'], activeLegendIndex: 0 }
    })
    expect(activeLegendAttributeTraitBonus(build, traitsById, legends)).toEqual({})
  })

  it('sums both equipped legends\' bonuses (Assassin + Dwarf), not just the currently-active one', () => {
    const build = makeBuild({ skills: { kind: 'revenant', legends: ['Legend2', 'Legend3'], activeLegendIndex: 0 } })
    expect(activeLegendAttributeTraitBonus(build, traitsById, legends)).toEqual({
      Power: 75,
      CritDamage: 75,
      Toughness: 75,
      Vitality: 75
    })
  })

  it('does not change when the *active* legend index flips (a permanent passive from both equipped legends, not a swap)', () => {
    const buildActive0 = makeBuild({ skills: { kind: 'revenant', legends: ['Legend2', 'Legend3'], activeLegendIndex: 0 } })
    const buildActive1 = makeBuild({ skills: { kind: 'revenant', legends: ['Legend2', 'Legend3'], activeLegendIndex: 1 } })
    expect(activeLegendAttributeTraitBonus(buildActive0, traitsById, legends)).toEqual(activeLegendAttributeTraitBonus(buildActive1, traitsById, legends))
  })

  it('Legendary Entity Stance grants +50 to all 9 core attributes', () => {
    const build = makeBuild({ skills: { kind: 'revenant', legends: ['Legend8', null], activeLegendIndex: 0 } })
    const bonus = activeLegendAttributeTraitBonus(build, traitsById, legends)
    expect(Object.keys(bonus)).toHaveLength(9)
    for (const value of Object.values(bonus)) expect(value).toBe(50)
  })
})
