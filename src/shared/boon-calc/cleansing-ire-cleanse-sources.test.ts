import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact, Skill } from '../types/game-data'
import { BOON_STRIP_CORRUPT_MATCHERS, CLEANSING_IRE_CLEANSE_FACTS, namedFactsForSkill } from './sources'

/**
 * Completeness scan for TODO.md's Known Exceptions Sweep "Cleansing Ire Cleanse Count" item —
 * sibling to `corrupt-missing-fact-sources.test.ts`, but the candidate net is exact rather than a
 * text regex: every skill carrying a `requires_trait: 1649` fact IS a Cleansing Ire candidate by
 * construction (no false positives to filter the way a free-text scan would have). Each of the 66
 * raw ids must be either the canonical id `CLEANSING_IRE_CLEANSE_FACTS` curates for its weapon/spec,
 * or a non-canonical duplicate/orphan id this app's build calculator never actually equips (listed
 * in `EXCLUDED_IDS` below with which canonical id supersedes it).
 */

type SkillDataFile = Pick<Skill, 'id' | 'name' | 'facts' | 'traitedFacts' | 'professions' | 'slot'>

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, '../../../data/game-data')
const skills: SkillDataFile[] = JSON.parse(readFileSync(resolve(dataDir, 'skills.json'), 'utf-8'))

function skillFacts(skill: SkillDataFile): Fact[] {
  return [...(skill.facts ?? []), ...(skill.traitedFacts ?? [])]
}

function isCleansingIreCandidate(skill: SkillDataFile): boolean {
  return skillFacts(skill).some((f) => f.requires_trait === 1649)
}

/** Non-canonical duplicate/orphan ids — never the id `profession-mechanic.ts`'s `professionMechanicBar`
 *  resolution actually equips for any weapon/spec combination, so `CLEANSING_IRE_CLEANSE_FACTS`
 *  correctly omits them. Each note names its superseding canonical id. */
const EXCLUDED_IDS: Record<number, string> = {
  // Eviscerate (Axe) — core id group, superseded by canonical 14353.
  14422: 'Eviscerate duplicate/tier id, superseded by canonical 14353.',
  14423: 'Eviscerate duplicate/tier id, superseded by canonical 14353.',
  14424: 'Eviscerate duplicate/tier id, superseded by canonical 14353.',
  // Skull Crack (Mace) — core id group, superseded by canonical 14414.
  14425: 'Skull Crack duplicate/tier id, superseded by canonical 14414.',
  14426: 'Skull Crack duplicate/tier id, superseded by canonical 14414.',
  14427: 'Skull Crack duplicate/tier id, superseded by canonical 14414.',
  // Forceful Shot (Speargun) — core id group, superseded by canonical 14544.
  14469: 'Forceful Shot duplicate/tier id, superseded by canonical 14544.',
  14470: 'Forceful Shot duplicate/tier id, superseded by canonical 14544.',
  14471: 'Forceful Shot duplicate/tier id, superseded by canonical 14544.',
  // Kill Shot (Rifle) — core id group, superseded by canonical 14396.
  14473: 'Kill Shot duplicate/tier id, superseded by canonical 14396.',
  14474: 'Kill Shot duplicate/tier id, superseded by canonical 14396.',
  14475: 'Kill Shot duplicate/tier id, superseded by canonical 14396.',
  // Earthshaker (Hammer) — core id group, superseded by canonical 14387.
  14512: 'Earthshaker duplicate/tier id, superseded by canonical 14387.',
  14513: 'Earthshaker duplicate/tier id, superseded by canonical 14387.',
  14514: 'Earthshaker duplicate/tier id, superseded by canonical 14387.',
  // Combustive Shot (Longbow) — core id group, superseded by canonical 14506.
  14520: 'Combustive Shot duplicate/tier id, superseded by canonical 14506.',
  14521: 'Combustive Shot duplicate/tier id, superseded by canonical 14506.',
  14522: 'Combustive Shot duplicate/tier id, superseded by canonical 14506.',
  // Arcing Slice (Greatsword) — core id group, superseded by canonical 14375.
  14545: 'Arcing Slice duplicate/tier id, superseded by canonical 14375.',
  14546: 'Arcing Slice duplicate/tier id, superseded by canonical 14375.',
  14547: 'Arcing Slice duplicate/tier id, superseded by canonical 14375.',
  // Whirling Strike (Spear, underwater) — core id group, superseded by canonical 14443.
  14549: 'Whirling Strike duplicate/tier id, superseded by canonical 14443.',
  14550: 'Whirling Strike duplicate/tier id, superseded by canonical 14443.',
  14551: 'Whirling Strike duplicate/tier id, superseded by canonical 14443.',
  // Spellbreaker Profession_2 pre-rework leftover ids — `profession-mechanic.ts`'s own
  // `EXCLUDED_MECHANIC_SKILL_IDS` already drops these 6 as orphaned duplicates of Full Counter
  // (44165), so they're never a build's equipped skill either.
  39972: 'Silencer — Spellbreaker Profession_2 orphan, excluded from professionMechanicBar candidates; superseded by canonical Full Counter (44165).',
  41283: 'Boon Crusher — Spellbreaker Profession_2 orphan, superseded by canonical Full Counter (44165).',
  41543: 'Wounding Strike — Spellbreaker Profession_2 orphan, superseded by canonical Full Counter (44165).',
  43488: 'Fleeting Stability — Spellbreaker Profession_2 orphan, superseded by canonical Full Counter (44165).',
  44397: 'Dissonance — Spellbreaker Profession_2 orphan, superseded by canonical Full Counter (44165).',
  46044: 'Magehunter Strike — Spellbreaker Profession_2 orphan, superseded by canonical Full Counter (44165).',
  // Breaching Strike (Dagger) — core id group, superseded by canonical 45252.
  69245: 'Breaching Strike duplicate id, superseded by canonical 45252.',
  69392: 'Breaching Strike duplicate id, superseded by canonical 45252.',
  69433: 'Breaching Strike duplicate id, superseded by canonical 45252.',
  // Path to Victory (Staff) — core id group, superseded by canonical 71932.
  71922: 'Path to Victory duplicate id, superseded by canonical 71932.',
  71950: 'Path to Victory duplicate id, superseded by canonical 71932.',
  72029: "Path to Victory — 71932's own flipSkill target, superseded by canonical 71932.",
  // Harrier's Toss (Spear, land) — core id group, superseded by canonical 72911.
  73006: "Harrier's Toss duplicate id, superseded by canonical 72911.",
  73024: "Harrier's Toss duplicate id, superseded by canonical 72911.",
  73042: "Harrier's Toss duplicate id, superseded by canonical 72911."
}

const CANONICAL_IDS = new Set<number>(Object.keys(CLEANSING_IRE_CLEANSE_FACTS).map(Number))

describe('Cleansing Ire cleanse-count completeness (trait 1649)', () => {
  it('accounts for every requires_trait:1649 skill in CLEANSING_IRE_CLEANSE_FACTS or EXCLUDED_IDS', () => {
    const uncovered: string[] = []
    for (const skill of skills) {
      if (!isCleansingIreCandidate(skill)) continue
      if (CANONICAL_IDS.has(skill.id)) continue
      if (skill.id in EXCLUDED_IDS) continue
      uncovered.push(`${skill.id} (${skill.name})`)
    }
    expect(uncovered, 'New/previously-missed requires_trait:1649 skill(s) — add to CLEANSING_IRE_CLEANSE_FACTS or this test\'s EXCLUDED_IDS in sources.ts.').toEqual([])
  })

  it('has no exclusion entry for an id that is already curated (dead/redundant entry)', () => {
    const redundant = Object.keys(EXCLUDED_IDS)
      .map(Number)
      .filter((id) => CANONICAL_IDS.has(id))
    expect(redundant, 'Id(s) covered by CLEANSING_IRE_CLEANSE_FACTS AND listed in EXCLUDED_IDS — remove the now-redundant exclusion entry.').toEqual([])
  })

  it('has no stale exclusion entry for an id that no longer exists or is no longer requires_trait:1649-gated', () => {
    const skillsById = new Map(skills.map((s) => [s.id, s]))
    const stale = Object.keys(EXCLUDED_IDS)
      .map(Number)
      .filter((id) => {
        const skill = skillsById.get(id)
        return !skill || !isCleansingIreCandidate(skill)
      })
    expect(stale, 'Id(s) in EXCLUDED_IDS that no longer exist or are no longer requires_trait:1649-gated — a balance patch likely reworked them; remove the stale entry.').toEqual([])
  })

  it('every CLEANSING_IRE_CLEANSE_FACTS id still exists in skills.json', () => {
    const skillIds = new Set(skills.map((s) => s.id))
    const missing = [...CANONICAL_IDS].filter((id) => !skillIds.has(id))
    expect(missing, 'CLEANSING_IRE_CLEANSE_FACTS id(s) that no longer exist in skills.json — a balance patch likely removed/renumbered them.').toEqual([])
  })
})

describe('Cleansing Ire cleanse row — behavior', () => {
  const fullSkills: Skill[] = JSON.parse(readFileSync(resolve(dataDir, 'skills.json'), 'utf-8'))
  const eviscerate = fullSkills.find((s) => s.id === 14353) as Skill // core, genuinely tiered
  const decapitate = fullSkills.find((s) => s.id === 30851) as Skill // Berserker Primal Burst, fixed
  const fullCounter = fullSkills.find((s) => s.id === 44165) as Skill // Spellbreaker, fixed

  it('shows nothing when Cleansing Ire is not equipped', () => {
    const sources = namedFactsForSkill(eviscerate, new Set(), new Set(), undefined, BOON_STRIP_CORRUPT_MATCHERS)
    expect(sources.filter((s) => s.name === 'Cleanse')).toHaveLength(0)
  })

  it('Eviscerate (core, genuinely tiered) shows the adrenaline-scaled range, not a single stale number', () => {
    const sources = namedFactsForSkill(eviscerate, new Set([1649]), new Set(), undefined, BOON_STRIP_CORRUPT_MATCHERS)
    const cleanse = sources.filter((s) => s.name === 'Cleanse')
    expect(cleanse).toHaveLength(1)
    expect(cleanse[0].detail).toBe('2 / 3 / 4 (adrenaline tier 1/2/3)')
    expect(cleanse[0].targetCount).toBeNull()
  })

  it('Decapitate (Berserker Primal Burst) shows the fixed tier-1 value, not its own stale raw value', () => {
    const sources = namedFactsForSkill(decapitate, new Set([1649]), new Set(), undefined, BOON_STRIP_CORRUPT_MATCHERS)
    const cleanse = sources.filter((s) => s.name === 'Cleanse')
    expect(cleanse).toHaveLength(1)
    expect(cleanse[0].detail).toBe('2')
  })

  it('Full Counter (Spellbreaker) shows the fixed level-1-cap value', () => {
    const sources = namedFactsForSkill(fullCounter, new Set([1649]), new Set(), undefined, BOON_STRIP_CORRUPT_MATCHERS)
    const cleanse = sources.filter((s) => s.name === 'Cleanse')
    expect(cleanse).toHaveLength(1)
    expect(cleanse[0].detail).toBe('2')
  })
})
