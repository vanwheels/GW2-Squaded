import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Build } from '../types'
import { computeBoonConditionSources } from './sources'

/**
 * Regression test for the 2026-08-16 fix: `skillIdsForBuild`'s standard-profession (non-Revenant)
 * branch never walked an equipped skill's own `flipSkill` chain at all (every OTHER category folded
 * into the aggregate Boon/Condition totals already did — weapon skills, Revenant's legends, the
 * mechanic bar), found investigating a user report that Engineer Supply Crate's flip skills weren't
 * showing up anywhere. Two real, previously-silent gaps this closes:
 * 1. Engineer Turrets — `TURRET_SUB_ABILITY_IDS` (the raw API's own `flipSkill` link is missing or
 *    inconsistent per-turret, see that table's doc comment) now always contributes both sub-abilities.
 * 2. Firebrand Mantras — a mantra's regular-charge skill (reachable via the ordinary `flipSkill`
 *    chain, e.g. Mantra of Solace -> Restoring Reprieve) was ALSO silently missing before this fix
 *    (not just its `MANTRA_FINAL_CHARGE_IDS`-appended Final Charge sibling), since the whole chain
 *    walk never ran for standard professions.
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
  familiars: loadGameData('familiars.json')
} as Parameters<typeof computeBoonConditionSources>[1]

function baseBuild(overrides: Partial<Build>): Build {
  return {
    id: 'flip-chain-test',
    name: 'flip chain test',
    notes: '',
    profession: 'Engineer',
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

describe('Engineer Rifle Turret (5818) — raw flipSkill is null on the equipped id', () => {
  const build = baseBuild({
    profession: 'Engineer',
    skills: { kind: 'standard', heal: null, utility: [5818, null, null], elite: null }
  })

  // Detonate Rifle Turret (5957) carries no Buff fact of its own (Damage/ComboFinisher only), so
  // it's correctly absent from `computeBoonConditionSources`' output — not a 2nd gap left open.
  it("contributes Automatic Fire's Buff fact to the aggregate Boon/Condition totals", () => {
    const sources = computeBoonConditionSources(build, gameData)
    expect(sources.some((s) => s.sourceId === 5874)).toBe(true) // Automatic Fire (Overcharge)
  })
})

describe('Guardian Firebrand Mantra of Solace (41714)', () => {
  const build = baseBuild({
    profession: 'Guardian',
    specializations: [null, null, { specializationId: 62, chosenTraitIds: [null, null, null] }], // Firebrand
    skills: { kind: 'standard', heal: 41714, utility: [null, null, null], elite: null }
  })

  it('contributes both the regular-charge (Restoring Reprieve) and Final Charge (Rejuvenating Respite) facts', () => {
    const sources = computeBoonConditionSources(build, gameData)
    expect(sources.some((s) => s.sourceId === 41475)).toBe(true) // Restoring Reprieve (regular charge)
    expect(sources.some((s) => s.sourceId === 42960)).toBe(true) // Rejuvenating Respite (Final Charge)
  })
})
