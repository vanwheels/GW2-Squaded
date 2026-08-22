import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Build } from '../types'
import { computeAuraSources, computeBoonConditionSources } from './sources'

/**
 * Regression guard for the 2026-08-19 fix to the "Light Aura shows in the Squad Builder's Boons row
 * but not the Build Editor's Auras row" bug (TODO.md, flagged 2026-08-16): Radiant Resolve's
 * `countsTowardTotals`-flagged "Activate" branch (`radiantResolveSections` in
 * `branch-conditional-facts.ts`) grants Light Aura, but `computeBoonConditionSources`'s branch loop
 * used to push every branch fact unfiltered — including this aura one — while `computeAuraSources`
 * had no equivalent branch loop at all, so the aura fact only ever reached the (wrong) boon/condition
 * stream. Confirms the fact now lands in exactly one of the two functions, matching each function's
 * own documented contract (`BoonConditionSource.category`'s doc comment).
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
  rechargeWvwOverrides: loadGameData('recharge-wvw-overrides.json'),
  legends: loadGameData('legends.json'),
  pets: loadGameData('pets.json'),
  professions: loadGameData('professions.json'),
  tomeChapters: loadGameData('tome-chapters.json'),
  soulbeastBeastmode: loadGameData('soulbeast-beastmode.json'),
  familiars: loadGameData('familiars.json'),
  relics: loadGameData('relics.json'),
  relicEffects: loadGameData('relic-effects.json')
} as Parameters<typeof computeBoonConditionSources>[1]

const LUMINARY_SPEC_ID = 81
const RADIANT_RESOLVE_ID = 78604

function baseBuild(overrides: Partial<Build>): Build {
  return {
    id: 'radiant-resolve-aura-routing-test',
    name: 'radiant resolve aura routing test',
    notes: '',
    profession: 'Guardian',
    specializations: [null, null, { specializationId: LUMINARY_SPEC_ID, chosenTraitIds: [null, null, null] }],
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

describe('Radiant Resolve (Luminary F2) — Light Aura routing', () => {
  it('computeAuraSources includes Light Aura', () => {
    const build = baseBuild({})
    const auraSources = computeAuraSources(build, gameData)
    expect(auraSources.some((s) => s.boonOrConditionName === 'Light Aura' && s.category === 'aura')).toBe(true)
  })

  it('computeBoonConditionSources does NOT include Light Aura (or any aura-category fact)', () => {
    const build = baseBuild({})
    const boonSources = computeBoonConditionSources(build, gameData)
    expect(boonSources.some((s) => s.boonOrConditionName === 'Light Aura')).toBe(false)
    expect(boonSources.every((s) => s.category !== 'aura')).toBe(true)
  })

  it('does not count the Empowered Staff branch\'s Regeneration (not countsTowardTotals, unlike Activate)', () => {
    const build = baseBuild({})
    const boonSources = computeBoonConditionSources(build, gameData)
    expect(boonSources.some((s) => s.sourceId === RADIANT_RESOLVE_ID && s.boonOrConditionName === 'Regeneration')).toBe(false)
  })
})
