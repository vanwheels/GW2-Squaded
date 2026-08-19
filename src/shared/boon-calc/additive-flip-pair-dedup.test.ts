import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Build, Fact, Skill } from '../types'
import { computeBoonConditionSources, computeNamedFactSources, CONTROL_MATCHERS } from './sources'

/**
 * Regression test for "debuffs and boons are being generated twice ... because it's counting the
 * base skill and the band-together version as 2 separate skills" (flagged 2026-08-19, screenshot of
 * a doubled "Daze — Darkrazor's Daring 2s" row in the Control section). Root cause: `withFlipChain`
 * deliberately walks past every `ADDITIVE_FLIP_PAIR_TARGET_IDS` id (see that constant's own doc
 * comment — the target carries real new content that must count toward totals), but its facts are a
 * SUPERSET of its base skill's, not a disjoint addition — every one of Legendary Renegade Stance's 4
 * "Band Together" pairs (Icerazor's Ire/Darkrazor's Daring/Razorclaw's Rage/Breakrazor's Bastion)
 * shares at least one identical fact with its own enhanced-cast id, and every `skillIds`-driven
 * aggregate (`computeBoonConditionSources`/`computeAuraSources`/`computeComboSources`/
 * `computeNamedFactSources`) was pushing both ids' facts unfiltered. Fixed via
 * `extractSkillSourcesWithAdditiveDedup`, shared by all 4.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
function loadGameData<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/' + name), 'utf-8')) as T
}

// Every Band Together skill's real content (Vulnerability/Torment/Immobile/Stability/Resistance/
// Barrier/etc.) lives entirely in synthetic-facts.json, not raw skills.json (confirmed — see
// COMPLETED.md's "Legendary Renegade Stance skills are missing on-cast effects" curation) — must be
// merged in the same way `load-game-data.ts`'s `withSyntheticFacts` does, or none of it is testable.
const rawSkills = loadGameData<Skill[]>('skills.json')
const syntheticFacts = loadGameData<Record<string, Fact[]>>('synthetic-facts.json')
const skillsWithSynthetics = rawSkills.map((s) => (syntheticFacts[s.id] ? { ...s, facts: [...s.facts, ...syntheticFacts[s.id]] } : s))

const gameData = {
  skills: skillsWithSynthetics,
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
    id: 'additive-flip-dedup-test',
    name: 'additive flip dedup test',
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

// Legend5 = Legendary Renegade Stance: heal 45686 (Breakrazor's Bastion), utilities [42949
// Razorclaw's Rage, 40485 Icerazor's Ire, 41220 Darkrazor's Daring] — all 4 Band Together pairs.
const renegadeBuild = baseBuild({
  skills: { kind: 'revenant', legends: ['Legend5', null], activeLegendIndex: 0 }
})

describe('Legendary Renegade Stance — Band Together additive-flip-pair dedup', () => {
  it('Darkrazor\'s Daring\'s Daze appears once in the Control named-fact totals, not twice', () => {
    const control = computeNamedFactSources(renegadeBuild, gameData, CONTROL_MATCHERS)
    const daze = control.filter((f) => f.name === 'Daze' && (f.sourceId === 41220 || f.sourceId === 72366))
    expect(daze).toHaveLength(1)
  })

  it('Icerazor\'s Ire\'s shared facts (Vulnerability x2, Torment, Immobile) each appear once, not duplicated by the enhanced cast', () => {
    const sources = computeBoonConditionSources(renegadeBuild, gameData)
    const fromIcerazor = sources.filter((s) => s.sourceId === 40485 || s.sourceId === 72359)
    const counts = new Map<string, number>()
    for (const s of fromIcerazor) {
      const key = `${s.boonOrConditionName}|${s.scaledDurationSeconds}|${s.applyCount}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    for (const [key, count] of counts) {
      expect(count, `duplicate row for ${key}`).toBe(1)
    }
  })

  it('but the enhanced cast\'s genuinely NEW content (Resistance from Darkrazor\'s Daring) still counts', () => {
    const sources = computeBoonConditionSources(renegadeBuild, gameData)
    const resistance = sources.filter(
      (s) => (s.sourceId === 41220 || s.sourceId === 72366) && s.boonOrConditionName === 'Resistance'
    )
    expect(resistance).toHaveLength(1)
  })
})
