import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Build } from '../types'
import { computeAuraSources, computeBoonConditionSources } from './sources'

/**
 * Regression tests for leg 2 of TODO.md's "Relic proc integration sweep" (`RELIC_TRIGGER_GATES` in
 * `sources.ts`): the equipped relic's boon/condition/aura facts now reach
 * `computeBoonConditionSources`/`computeAuraSources` when the relic is one of the curated
 * candidates AND its trigger gate is satisfied — and, just as importantly, stay silent for every
 * relic and gate state `RELIC_TRIGGER_GATES`'s own doc comment says to leave unwired.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
function loadGameData<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/' + name), 'utf-8')) as T
}

const gameData = {
  skills: loadGameData('skills.json'),
  traits: loadGameData('traits.json'),
  itemStats: loadGameData('itemstats.json'),
  itemStatLegalIds: loadGameData('itemstat-legal-ids.json'),
  infusions: loadGameData('infusions.json'),
  runes: loadGameData('runes.json'),
  sigils: loadGameData('sigils.json'),
  food: loadGameData('food.json'),
  utility: loadGameData('utility.json'),
  wvwFactOverrides: loadGameData('wvw-fact-overrides.json'),
  legends: loadGameData('legends.json'),
  pets: loadGameData('pets.json'),
  professions: loadGameData('professions.json'),
  tomeChapters: loadGameData('tome-chapters.json'),
  soulbeastBeastmode: loadGameData('soulbeast-beastmode.json'),
  familiars: loadGameData('familiars.json'),
  relics: loadGameData('relics.json'),
  relicEffects: loadGameData('relic-effects.json')
} as Parameters<typeof computeBoonConditionSources>[1]

function baseBuild(overrides: Partial<Build>): Build {
  return {
    id: 'relic-sources-test',
    name: 'relic sources test',
    notes: '',
    profession: 'Necromancer',
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

const NECRO_ELITE_ID = 10549 // Plaguelands
const WELL_OF_BLOOD_ID = 10527 // Necromancer Heal, carries the 'Well' category

describe('Relic of the Earth (100435) — elite-skill gate, boon + aura payload', () => {
  it('contributes Protection + Magnetic Aura once an Elite skill is equipped', () => {
    const build = baseBuild({
      relicId: 100435,
      skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: NECRO_ELITE_ID }
    })
    const boonSources = computeBoonConditionSources(build, gameData)
    const auraSources = computeAuraSources(build, gameData)
    expect(boonSources.some((s) => s.sourceKind === 'relic' && s.boonOrConditionName === 'Protection' && s.targetCount === 5)).toBe(true)
    expect(auraSources.some((s) => s.sourceKind === 'relic' && s.boonOrConditionName === 'Magnetic Aura' && s.targetCount === 5)).toBe(true)
  })

  it('contributes nothing when no Elite skill is equipped', () => {
    const build = baseBuild({ relicId: 100435 })
    expect(computeBoonConditionSources(build, gameData).some((s) => s.sourceKind === 'relic')).toBe(false)
    expect(computeAuraSources(build, gameData).some((s) => s.sourceKind === 'relic')).toBe(false)
  })
})

describe('Relic of the Chronomancer (100450) — ability-category gate', () => {
  it('contributes Quickness when an equipped Heal/Utility/Elite skill carries the Well category', () => {
    const build = baseBuild({
      relicId: 100450,
      skills: { kind: 'standard', heal: WELL_OF_BLOOD_ID, utility: [null, null, null], elite: null }
    })
    const sources = computeBoonConditionSources(build, gameData)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.boonOrConditionName === 'Quickness')).toBe(true)
  })

  it('contributes nothing when no equipped skill carries the Well category (Elite alone is not enough)', () => {
    const build = baseBuild({
      relicId: 100450,
      skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: NECRO_ELITE_ID }
    })
    expect(computeBoonConditionSources(build, gameData).some((s) => s.sourceKind === 'relic')).toBe(false)
  })
})

describe('Relics deliberately left out of RELIC_TRIGGER_GATES', () => {
  // Zephyrite (stepped duration still uncurated), Leadership (no literal boon name), Sorrow
  // (custom effect misread as "Protection" by leg 1's gloss), Firebrand (a % modifier, not a
  // discrete boon) — every gate gets maximally satisfied (Elite equipped) so a false wiring would
  // show up immediately rather than being masked by an unmet trigger.
  const deferredRelicIds = [100893, 100625, 103424, 100453]

  it.each(deferredRelicIds)('relic %i contributes nothing to computeBoonConditionSources/computeAuraSources', (relicId) => {
    const build = baseBuild({
      relicId,
      skills: { kind: 'standard', heal: WELL_OF_BLOOD_ID, utility: [null, null, null], elite: NECRO_ELITE_ID }
    })
    expect(computeBoonConditionSources(build, gameData).some((s) => s.sourceKind === 'relic')).toBe(false)
    expect(computeAuraSources(build, gameData).some((s) => s.sourceKind === 'relic')).toBe(false)
  })
})

describe('Revenant — elite/heal gates are trivially satisfied whenever any legend is equipped', () => {
  it('Relic of the Centaur (heal-skill gate) grants Stability with no explicit heal-skill pick', () => {
    const legends = loadGameData<{ id: string }[]>('legends.json')
    const anyLegendId = legends[0]?.id
    expect(anyLegendId).toBeDefined()
    const build = baseBuild({
      profession: 'Revenant',
      relicId: 100385,
      skills: { kind: 'revenant', legends: [anyLegendId ?? null, null], activeLegendIndex: 0 }
    })
    const sources = computeBoonConditionSources(build, gameData)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.boonOrConditionName === 'Stability')).toBe(true)
  })
})
