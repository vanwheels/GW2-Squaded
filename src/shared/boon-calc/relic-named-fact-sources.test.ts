import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Build } from '../types'
import { CONTROL_MATCHERS, MISCELLANEOUS_MATCHERS, BOON_STRIP_CORRUPT_MATCHERS, RELIC_NAMED_FACT_SOURCES, computeNamedFactSources } from './sources'

/**
 * Regression tests for leg 5 of TODO.md's "Relic proc integration sweep" — the "Smaller follow-up"
 * item: 8 relics whose only real payload is a `computeNamedFactSources` name (Superspeed/Cleanse/
 * Corrupt/Daze/Pull), not a boon/aura, now reach `computeNamedFactSources` via
 * `RELIC_NAMED_FACT_SOURCES`/`computeRelicNamedFactSources` — gated by the same `RELIC_TRIGGER_GATES`
 * trigger classification `relicSources` uses for the boon/aura pipeline. See
 * `docs/relic-trigger-classification.md`'s "Leg 5" section for the full per-relic writeup. Leg 6
 * (2026-08-16) added a 9th: Relic of the Citadel (100448), whose Stun turned out to be a
 * deterministic function of the triggering elite skill's own recharge after all — see
 * `citadelStunDurationSeconds`'s doc comment in `sources.ts`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
function loadGameData<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, '../../../data/game-data/' + name), 'utf-8')) as T
}

const gameData = {
  skills: loadGameData('skills.json'),
  traits: loadGameData('traits.json'),
  sigils: loadGameData('sigils.json'),
  wvwFactOverrides: loadGameData('wvw-fact-overrides.json'),
  legends: loadGameData('legends.json'),
  pets: loadGameData('pets.json'),
  professions: loadGameData('professions.json'),
  tomeChapters: loadGameData('tome-chapters.json'),
  soulbeastBeastmode: loadGameData('soulbeast-beastmode.json'),
  familiars: loadGameData('familiars.json'),
  relics: loadGameData('relics.json'),
  relicEffects: loadGameData('relic-effects.json')
} as Parameters<typeof computeNamedFactSources>[1]

function baseBuild(overrides: Partial<Build>): Build {
  return {
    id: 'relic-named-fact-sources-test',
    name: 'relic named fact sources test',
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
const NECRO_HEAL_ID = 10527 // Well of Blood — also carries the 'Well' category, not used for that here
const WARRIOR_SHOUT_ID = 14575 // "On My Mark!" — Warrior Shout
const WARRIOR_STANCE_ID = 14412 // Balanced Stance — Warrior Stance

const ALL_MATCHERS = { ...CONTROL_MATCHERS, ...MISCELLANEOUS_MATCHERS, ...BOON_STRIP_CORRUPT_MATCHERS }

describe('Relic of the Pack (100752) — elite-skill gate, Superspeed', () => {
  it('contributes Superspeed once an Elite skill is equipped', () => {
    const build = baseBuild({ relicId: 100752, skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: NECRO_ELITE_ID } })
    const sources = computeNamedFactSources(build, gameData, MISCELLANEOUS_MATCHERS)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.name === 'Superspeed')).toBe(true)
  })

  it('contributes nothing when no Elite skill is equipped', () => {
    const build = baseBuild({ relicId: 100752 })
    expect(computeNamedFactSources(build, gameData, MISCELLANEOUS_MATCHERS).some((s) => s.sourceKind === 'relic')).toBe(false)
  })
})

describe('Relic of Febe (101116) — heal-skill gate, Cleanse with a real target count', () => {
  it('contributes Cleanse with targetCount 5 once a Heal skill is equipped', () => {
    const build = baseBuild({ relicId: 101116, skills: { kind: 'standard', heal: NECRO_HEAL_ID, utility: [null, null, null], elite: null } })
    const sources = computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS)
    const cleanse = sources.find((s) => s.sourceKind === 'relic' && s.name === 'Cleanse')
    expect(cleanse?.targetCount).toBe(5)
  })

  it('contributes nothing when no Heal skill is equipped', () => {
    const build = baseBuild({ relicId: 101116 })
    expect(computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS).some((s) => s.sourceKind === 'relic')).toBe(false)
  })
})

describe('Relic of Cerus (100074) — elite-skill gate, Corrupt', () => {
  it('contributes Corrupt once an Elite skill is equipped', () => {
    const build = baseBuild({ relicId: 100074, skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: NECRO_ELITE_ID } })
    const sources = computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.name === 'Corrupt')).toBe(true)
  })
})

describe('Relic of Dagda (100942) — elite-skill gate, Daze', () => {
  it('contributes Daze once an Elite skill is equipped', () => {
    const build = baseBuild({ relicId: 100942, skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: NECRO_ELITE_ID } })
    const sources = computeNamedFactSources(build, gameData, CONTROL_MATCHERS)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.name === 'Daze')).toBe(true)
  })
})

describe("Relic of the Wizard's Tower (100557) — elite-skill gate, Pull", () => {
  it('contributes Pull once an Elite skill is equipped', () => {
    const build = baseBuild({ relicId: 100557, skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: NECRO_ELITE_ID } })
    const sources = computeNamedFactSources(build, gameData, CONTROL_MATCHERS)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.name === 'Pull')).toBe(true)
  })
})

describe('Relic of the Water (100659) — heal-skill gate, Cleanse with no target count (self-only)', () => {
  it('contributes Cleanse with a null targetCount once a Heal skill is equipped', () => {
    const build = baseBuild({ relicId: 100659, skills: { kind: 'standard', heal: NECRO_HEAL_ID, utility: [null, null, null], elite: null } })
    const sources = computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS)
    const cleanse = sources.find((s) => s.sourceKind === 'relic' && s.name === 'Cleanse')
    expect(cleanse).toBeDefined()
    expect(cleanse?.targetCount).toBeNull()
  })
})

describe('Relic of the Trooper (100411) — ability-category gate (Shout), Cleanse', () => {
  it('contributes Cleanse when an equipped skill carries the Shout category', () => {
    const build = baseBuild({
      profession: 'Warrior',
      relicId: 100411,
      skills: { kind: 'standard', heal: null, utility: [WARRIOR_SHOUT_ID, null, null], elite: null }
    })
    const sources = computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.name === 'Cleanse')).toBe(true)
  })

  it('contributes nothing when no equipped skill carries the Shout category', () => {
    const build = baseBuild({
      profession: 'Warrior',
      relicId: 100411,
      skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: NECRO_ELITE_ID }
    })
    expect(computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS).some((s) => s.sourceKind === 'relic')).toBe(false)
  })
})

describe('Relic of Bava Nisos (104848) — ability-category gate (Stance), Cleanse', () => {
  it('contributes Cleanse when an equipped skill carries the Stance category', () => {
    const build = baseBuild({
      profession: 'Warrior',
      relicId: 104848,
      skills: { kind: 'standard', heal: null, utility: [WARRIOR_STANCE_ID, null, null], elite: null }
    })
    const sources = computeNamedFactSources(build, gameData, BOON_STRIP_CORRUPT_MATCHERS)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.name === 'Cleanse')).toBe(true)
  })
})

describe("Relic of the Citadel (100448) — elite-skill gate, Stun duration computed from the triggering elite skill's own recharge", () => {
  const PLAGUELANDS_ID = 10549 // Necromancer Elite, 90s recharge -> 1.5s stun (linear between the 60s/1s and 180s/3s endpoints)
  const MASS_INVISIBILITY_ID = 10245 // Mesmer Elite, 35s recharge -> below the 60s floor -> 1s stun

  it('contributes Stun with a duration scaled to the equipped elite skill\'s recharge (90s -> 1.5s)', () => {
    const build = baseBuild({ relicId: 100448, skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: PLAGUELANDS_ID } })
    const sources = computeNamedFactSources(build, gameData, CONTROL_MATCHERS)
    const stun = sources.find((s) => s.sourceKind === 'relic' && s.name === 'Stun')
    expect(stun?.detail).toBe('1.5s (on Elite skill use, 30s CD)')
  })

  it('floors at 1s for a short-recharge elite skill (35s)', () => {
    const build = baseBuild({
      profession: 'Mesmer',
      relicId: 100448,
      skills: { kind: 'standard', heal: null, utility: [null, null, null], elite: MASS_INVISIBILITY_ID }
    })
    const sources = computeNamedFactSources(build, gameData, CONTROL_MATCHERS)
    expect(sources.find((s) => s.sourceKind === 'relic' && s.name === 'Stun')?.detail).toBe('1.0s (on Elite skill use, 30s CD)')
  })

  it('contributes nothing when no Elite skill is equipped', () => {
    const build = baseBuild({ relicId: 100448 })
    expect(computeNamedFactSources(build, gameData, CONTROL_MATCHERS).some((s) => s.sourceKind === 'relic')).toBe(false)
  })
})

describe('Relics deliberately left out of RELIC_NAMED_FACT_SOURCES', () => {
  // Astral Ward (rides the already-deferred 2-step signet mechanic), Unseen Invasion/Wayfinder
  // (non-deterministic trigger), Founding/Mists Tide (combo-gated, non-deterministic), Mosyn
  // (dodge-gated, already excluded).
  const excludedRelicIds = [100388, 100694, 101943, 101737, 103901, 101801]

  it.each(excludedRelicIds)('relic %i contributes nothing to computeNamedFactSources', (relicId) => {
    const build = baseBuild({
      relicId,
      skills: { kind: 'standard', heal: NECRO_HEAL_ID, utility: [null, null, null], elite: NECRO_ELITE_ID }
    })
    expect(computeNamedFactSources(build, gameData, ALL_MATCHERS).some((s) => s.sourceKind === 'relic')).toBe(false)
  })
})

describe('Revenant — elite/heal gates are trivially satisfied whenever any legend is equipped', () => {
  it('Relic of the Pack grants Superspeed with no explicit elite-skill pick', () => {
    const legends = loadGameData<{ id: string }[]>('legends.json')
    const anyLegendId = legends[0]?.id
    expect(anyLegendId).toBeDefined()
    const build = baseBuild({
      profession: 'Revenant',
      relicId: 100752,
      skills: { kind: 'revenant', legends: [anyLegendId ?? null, null], activeLegendIndex: 0 }
    })
    const sources = computeNamedFactSources(build, gameData, MISCELLANEOUS_MATCHERS)
    expect(sources.some((s) => s.sourceKind === 'relic' && s.name === 'Superspeed')).toBe(true)
  })
})

describe('RELIC_NAMED_FACT_SOURCES table integrity', () => {
  const ALL_MATCHER_NAMES = new Set(Object.keys(ALL_MATCHERS))

  it('every entry names a real matcher-table key', () => {
    const badNames = Object.entries(RELIC_NAMED_FACT_SOURCES)
      .filter(([, entry]) => !ALL_MATCHER_NAMES.has(entry.name))
      .map(([id, entry]) => `${id}: "${entry.name}"`)
    expect(badNames, 'RELIC_NAMED_FACT_SOURCES entry names a string that is not a key of CONTROL_MATCHERS/MISCELLANEOUS_MATCHERS/BOON_STRIP_CORRUPT_MATCHERS.').toEqual([])
  })

  it('every entry id still exists in relics.json', () => {
    const relics = loadGameData<{ id: number }[]>('relics.json')
    const relicIds = new Set(relics.map((r) => r.id))
    const stale = Object.keys(RELIC_NAMED_FACT_SOURCES)
      .map(Number)
      .filter((id) => !relicIds.has(id))
    expect(stale, 'RELIC_NAMED_FACT_SOURCES id(s) that no longer exist in relics.json — a balance patch likely removed/renumbered them.').toEqual([])
  })
})
