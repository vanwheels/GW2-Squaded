import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Build, GameData, RevenantSkillSelection, TraitLineSelection } from '../types'
import { buildGameData } from '../game-data/build-game-data'
import { decodeBuildTemplate, encodeBuildTemplate } from './build-template-codec'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../../../data/game-data')

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(resolve(DATA_DIR, fileName), 'utf-8')) as T
}

// Real, currently-loaded game data (same assembly `loadGameData()`/the web-preview use) — round-
// trip tests below pick real ids out of this rather than hardcoding any, so they never need
// updating just because a future balance patch changes which specific skills/traits exist.
const gameData: GameData = await buildGameData(readJson)

function makeBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'test',
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
    vindicatorAspectFlipped: false,
    familiarId: null,
    activeAttunement: 'Fire',
    weaverPreviousAttunement: null,
    thiefStolenSkillId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedAtGw2Build: null,
    tags: [],
    order: 0,
    favorite: false,
    ...overrides
  }
}

/** A real, currently-loaded specialization + one real major trait per tier, for `professionId`. */
function pickSpecializationLine(professionId: string, elite = false): TraitLineSelection {
  const spec = gameData.specializations.find((s) => s.profession === professionId && s.elite === elite)
  if (!spec) throw new Error(`no ${elite ? 'elite' : 'core'} specialization found for ${professionId}`)
  const traitsForTier = (tier: number) =>
    gameData.traits.find((t) => t.specializationId === spec.id && t.slot === 'Major' && t.tier === tier && t.order === 0)
  const chosenTraitIds: [number | null, number | null, number | null] = [
    traitsForTier(1)?.id ?? null,
    traitsForTier(2)?.id ?? null,
    traitsForTier(3)?.id ?? null
  ]
  return { specializationId: spec.id, chosenTraitIds }
}

/** A real skill id this profession can actually encode (has a palette-id mapping) for `slot`. */
function pickSkillId(professionId: string, slot: 'Heal' | 'Utility' | 'Elite'): number {
  const profession = gameData.professions.find((p) => p.id === professionId)!
  const paletteSkillIds = new Set(profession.skillPalette.map(([, skillId]) => skillId))
  const skill = gameData.skills.find(
    (s) => s.slot === slot && s.professions.includes(professionId) && paletteSkillIds.has(s.id)
  )
  if (!skill) throw new Error(`no encodable ${slot} skill found for ${professionId}`)
  return skill.id
}

describe('encodeBuildTemplate / decodeBuildTemplate — real game-data round trip', () => {
  it('round-trips a Guardian build (profession, specializations, standard skills)', () => {
    const build = makeBuild({
      profession: 'Guardian',
      specializations: [pickSpecializationLine('Guardian'), pickSpecializationLine('Guardian', true), null],
      skills: {
        kind: 'standard',
        heal: pickSkillId('Guardian', 'Heal'),
        utility: [pickSkillId('Guardian', 'Utility'), null, null],
        elite: pickSkillId('Guardian', 'Elite')
      }
    })

    const { code, warnings } = encodeBuildTemplate(build, gameData)
    expect(warnings).toHaveLength(0)
    expect(code).toMatch(/^\[&[A-Za-z0-9+/]+=*\]$/)

    const { patch, warnings: decodeWarnings } = decodeBuildTemplate(code, gameData)
    expect(decodeWarnings).toHaveLength(0)
    expect(patch.profession).toBe('Guardian')
    expect(patch.specializations).toEqual(build.specializations)
    expect(patch.skills).toEqual(build.skills)
  })

  it('round-trips a Ranger build, including its 2 equipped pets', () => {
    const [pet0, pet1] = gameData.pets
    const build = makeBuild({
      profession: 'Ranger',
      specializations: [pickSpecializationLine('Ranger'), null, null],
      skills: {
        kind: 'standard',
        heal: pickSkillId('Ranger', 'Heal'),
        utility: [null, null, null],
        elite: null
      },
      equippedPetIds: [pet0.id, pet1.id]
    })

    const { code, warnings } = encodeBuildTemplate(build, gameData)
    expect(warnings).toHaveLength(0)

    const { patch, warnings: decodeWarnings } = decodeBuildTemplate(code, gameData)
    expect(decodeWarnings).toHaveLength(0)
    expect(patch.profession).toBe('Ranger')
    expect(patch.equippedPetIds).toEqual([pet0.id, pet1.id])
    expect(patch.activePetIndex).toBe(0)
  })

  it('round-trips a Revenant build via its active legend (kit-derived skills, not independently chosen)', () => {
    const [legendA, legendB] = gameData.legends
    const build = makeBuild({
      profession: 'Revenant',
      specializations: [pickSpecializationLine('Revenant'), null, null],
      skills: { kind: 'revenant', legends: [legendA.id, legendB.id], activeLegendIndex: 0 } satisfies RevenantSkillSelection
    })

    const { code, warnings } = encodeBuildTemplate(build, gameData)
    expect(warnings).toHaveLength(0)

    const { patch, warnings: decodeWarnings } = decodeBuildTemplate(code, gameData)
    expect(decodeWarnings).toHaveLength(0)
    expect(patch.profession).toBe('Revenant')
    expect(patch.skills).toEqual({ kind: 'revenant', legends: [legendA.id, legendB.id], activeLegendIndex: 0 })
  })

  it('recovers the OTHER (inactive) legend and its utility skills from the profession-specific tail', () => {
    const [legendA, legendB] = gameData.legends
    // activeLegendIndex 1 -> legendB is active (drives the main skill block), legendA is inactive
    // (only reachable via the tail's "inactive legend" bytes) — round-tripping legendA at all
    // proves the tail offsets are right, not just the shared main block.
    const build = makeBuild({
      profession: 'Revenant',
      skills: { kind: 'revenant', legends: [legendA.id, legendB.id], activeLegendIndex: 1 } satisfies RevenantSkillSelection
    })

    const { code, warnings } = encodeBuildTemplate(build, gameData)
    expect(warnings).toHaveLength(0)
    const { patch } = decodeBuildTemplate(code, gameData)
    // Decode always normalizes to activeLegendIndex 0 (display-only field — see the codec's own
    // doc comment), so the active legend (legendB) should now be at index 0.
    expect(patch.skills).toEqual({ kind: 'revenant', legends: [legendB.id, legendA.id], activeLegendIndex: 0 })
  })

  it('mirrors a Standard skill selection into the aquatic half rather than leaving it blank', () => {
    const heal = pickSkillId('Guardian', 'Heal')
    const build = makeBuild({ profession: 'Guardian', skills: { kind: 'standard', heal, utility: [null, null, null], elite: null } })
    const { code } = encodeBuildTemplate(build, gameData)
    const bytes = Buffer.from(code.slice(2, -1), 'base64')
    const terrestrialHeal = bytes[8] + (bytes[9] << 8)
    const aquaticHeal = bytes[10] + (bytes[11] << 8)
    expect(terrestrialHeal).toBe(aquaticHeal)
    expect(terrestrialHeal).toBeGreaterThan(0)
  })
})

describe('decodeBuildTemplate — malformed input', () => {
  it('rejects a string with no chat-link shape at all', () => {
    expect(() => decodeBuildTemplate('not a chat link', gameData)).toThrow()
  })

  it('rejects a chat link of a different type (e.g. an item link, type 0x02)', () => {
    const itemLinkBytes = [0x02, 0x01, 0x00, 0x00, 0x00, 0x00]
    const code = `[&${Buffer.from(itemLinkBytes).toString('base64')}]`
    expect(() => decodeBuildTemplate(code, gameData)).toThrow(/Build Template/)
  })

  it('rejects a truncated Build Template code', () => {
    const tooShort = [0x0d, 1, 0, 0, 0, 0]
    const code = `[&${Buffer.from(tooShort).toString('base64')}]`
    expect(() => decodeBuildTemplate(code, gameData)).toThrow(/too short/)
  })

  it('rejects an unrecognized profession code', () => {
    const bytes = [0x0d, 99, ...new Array(42).fill(0)]
    const code = `[&${Buffer.from(bytes).toString('base64')}]`
    expect(() => decodeBuildTemplate(code, gameData)).toThrow(/profession code/)
  })
})

describe('decodeBuildTemplate — real, currently-published chat links', () => {
  // 3 real Revenant Build Template codes copied from MetaBattle 2026-08-28 (Core Condi Ventari /
  // Core Power Revenant / Core Support) — used here only to confirm decoding a real, independently-
  // authored code doesn't throw and yields a structurally sane result. NOT asserted against exact
  // skill/legend content: these particular codes are old enough that some of their skill-palette
  // ids likely no longer resolve the way they did when captured (GW2 has been observed reusing
  // freed palette ids for unrelated new skills after a rework) — see this module's own doc comment.
  const REAL_CODES = [
    '[&DQkOFgMbCS3cEdwRBhIGEisSKxLUEdQRyhHKEQQGAgAGEisS1BEAAAAAAAADNQBXAFkAAA==]',
    '[&DQkDPg8+CR/cEdwRKxIGEgYSKxLUEdQRyhHKEQIDAgMGEisS1BEGEisS1BEDWgBXAFkAAA==]',
    '[&DQkJJwwbAxfcEQAAKxIAAAYSAADUEQAAyhEAAAYDAAArEgYS1BEAAAAAAAA=]'
  ]

  it.each(REAL_CODES)('decodes %s without throwing, as a Revenant build', (code) => {
    const { patch } = decodeBuildTemplate(code, gameData)
    expect(patch.profession).toBe('Revenant')
    expect(patch.specializations).toHaveLength(3)
    expect(patch.skills?.kind).toBe('revenant')
  })
})
