import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact, Skill, Trait } from '../types/game-data'
import { BOON_STRIP_CORRUPT_MATCHERS, CORRUPT_MISSING_FACT_SKILLS, namedFactsForSkill } from './sources'

/**
 * Completeness scan for TODO.md's "Corruption stat undercounts real 'boon corrupt' sources" —
 * sibling to `sigil-named-fact-completeness.test.ts`/`relic-named-fact-completeness.test.ts`, but
 * for skills/traits whose own `Fact[]` normally *does* reach `BOON_STRIP_CORRUPT_MATCHERS.Corrupt`
 * and just occasionally omits the one fact it needs (`CORRUPT_MISSING_FACT_SKILLS` in `sources.ts`
 * fills the gap by hand). Candidate net is a loose "convert/corrupt near boon(s)" regex over every
 * skill/trait description (catches both directions — genuine Corrupt sources and the much more
 * common condition-to-boon support skills, which the exclusion list below rules out by name); every
 * hit must be either already covered by the real `Number` fact `Corrupt`'s own regex matches, in
 * `CORRUPT_MISSING_FACT_SKILLS`, or in this file's own `EXCLUDED_IDS` with a stated reason.
 */

type SkillDataFile = Pick<Skill, 'id' | 'name' | 'description' | 'facts' | 'traitedFacts' | 'professions' | 'slot'>
type TraitDataFile = Pick<Trait, 'id' | 'name' | 'description' | 'facts'>

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, '../../../data/game-data')
const skills: SkillDataFile[] = JSON.parse(readFileSync(resolve(dataDir, 'skills.json'), 'utf-8'))
const traits: TraitDataFile[] = JSON.parse(readFileSync(resolve(dataDir, 'traits.json'), 'utf-8'))

function plainText(text: string | undefined): string {
  return (text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Deliberately direction-agnostic (catches condition-to-boon support skills too, ruled out below
 *  by name) — narrower than a bare `/boon/` substring (which would also flag every flat
 *  Boon-Duration stat item) but broad enough not to miss a real Corrupt source's wording. */
const CANDIDATE_PATTERN = /(convert|corrupt).{0,40}\bboons?\b|\bboons?\b.{0,40}(convert|corrupt)/i

function isCandidate(name: string, description: string | undefined): boolean {
  return CANDIDATE_PATTERN.test(`${plainText(name)} ${plainText(description)}`)
}

function skillFacts(skill: SkillDataFile): Fact[] {
  return [...(skill.facts ?? []), ...(skill.traitedFacts ?? [])]
}

function hasCorruptFact(facts: Fact[]): boolean {
  return facts.some((f) => BOON_STRIP_CORRUPT_MATCHERS.Corrupt(f))
}

/** Reviewed-and-excluded candidates (see this file's header comment for how each was decided). */
const EXCLUDED_IDS: Record<string, string> = {
  'skill:5860': 'Elixir C — converts conditions on self INTO boons, the opposite direction from Corrupt.',
  'skill:5969': 'Toss Elixir C — converts conditions on allies into boons, opposite direction.',
  'skill:6077': 'Toss Elixir C — converts conditions on allies into boons, opposite direction.',
  'skill:6078': 'Detonate Elixir C — converts conditions into boons, opposite direction.',
  'skill:10545': "Well of Corruption's auto-target duplicate id — visibleSkillsForSlot strips it before a skill bar can ever reference it (10671 is curated in CORRUPT_MISSING_FACT_SKILLS).",
  'skill:10609': 'Well of Power — converts conditions on allies into boons, opposite direction.',
  'skill:10673': 'Well of Power — converts conditions on allies into boons, opposite direction.',
  'skill:12569': 'Spirit of Nature — converts conditions on allies into boons, opposite direction.',
  'skill:29666': '"Nothing Can Save You!" converts boons into Vulnerability, but its own API fact already labels that "Boons Removed" (Strip) — already surfaced correctly on the Strip row, not double-counted onto Corrupt.',
  'skill:34431': 'Vulnerable Spit — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:34488': 'Poison Spatter — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:39801': 'Corrupted Ground — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:47572': 'Fingers of the Dead — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:49097': 'Lesser Elixir C — converts conditions into boons, opposite direction.',
  'skill:62514': 'Elixir of Bliss auto-target duplicate id — visibleSkillsForSlot strips it before a skill bar can ever reference it (68132 is curated in CORRUPT_MISSING_FACT_SKILLS).',
  'skill:65423': 'Enhanced Destructive Aura — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:69300': 'Spirit of Nature — converts conditions on allies into boons, opposite direction.',
  'skill:71667': 'Corrupted Ground — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:74829': 'Noxious Blight — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:74843': 'Noxious Blight — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:74867': 'Wave of Corruption — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:75026': 'Noxious Blight — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:75103': 'Noxious Blight — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:75417': 'Wave of Corruption — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:75481': 'Noxious Blight — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:75559': 'Noxious Blight — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:75774': 'Noxious Blight — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'skill:75966': 'Noxious Blight — empty professions/slot, NPC-only skill structurally unreachable from any build.',
  'trait:553': 'Pure of Voice — converts conditions to boons on allies, opposite direction.',
  'trait:673': 'Auspicious Anguish — converts damaging conditions to boons on self, opposite direction.',
  'trait:2059': 'Feed from Corruption — reactive ("when you remove or corrupt a boon"), grants barrier; does not itself corrupt anything.',
  'trait:2102': 'Nourishing Ashes — reactive ("when you ... remove or corrupt a boon"), grants life force; does not itself corrupt anything.',
  'trait:2157': 'Prismatic Converter — converts conditions into boons, opposite direction.',
  'trait:2366': 'Stainless Steel — converts conditions to boons, opposite direction.'
}

const COVERED_SKILL_IDS = new Set<number>(Object.keys(CORRUPT_MISSING_FACT_SKILLS).map(Number))

describe('Corrupt-row completeness (skills/traits that convert/corrupt boons)', () => {
  it('accounts for every candidate skill in a real Number fact, CORRUPT_MISSING_FACT_SKILLS, or the exclusion list', () => {
    const uncovered: string[] = []
    for (const skill of skills) {
      if (!isCandidate(skill.name, skill.description)) continue
      if (hasCorruptFact(skillFacts(skill))) continue
      if (COVERED_SKILL_IDS.has(skill.id)) continue
      if (`skill:${skill.id}` in EXCLUDED_IDS) continue
      uncovered.push(`${skill.id} (${skill.name})`)
    }
    expect(uncovered, 'New/previously-missed candidate skill(s) — add to CORRUPT_MISSING_FACT_SKILLS in sources.ts, or to this test\'s EXCLUDED_IDS with a reason.').toEqual([])
  })

  it('accounts for every candidate trait in a real Number fact or the exclusion list', () => {
    const uncovered: string[] = []
    for (const trait of traits) {
      if (!isCandidate(trait.name, trait.description)) continue
      if (hasCorruptFact(trait.facts ?? [])) continue
      if (`trait:${trait.id}` in EXCLUDED_IDS) continue
      uncovered.push(`${trait.id} (${trait.name})`)
    }
    expect(uncovered, "New/previously-missed candidate trait(s) — add a reason to this test's EXCLUDED_IDS (no trait-level override table exists yet).").toEqual([])
  })

  it('has no exclusion entry for an id that is already curated (dead/redundant entry)', () => {
    const redundant = Object.keys(EXCLUDED_IDS).filter((key) => key.startsWith('skill:') && COVERED_SKILL_IDS.has(Number(key.slice('skill:'.length))))
    expect(redundant, 'Id(s) covered by CORRUPT_MISSING_FACT_SKILLS AND listed in EXCLUDED_IDS — remove the now-redundant exclusion entry.').toEqual([])
  })

  it('has no stale exclusion entry for an id that no longer exists or no longer matches a candidate pattern', () => {
    const skillsById = new Map(skills.map((s) => [s.id, s]))
    const traitsById = new Map(traits.map((t) => [t.id, t]))
    const stale: string[] = []
    for (const key of Object.keys(EXCLUDED_IDS)) {
      const [kind, idStr] = key.split(':')
      const id = Number(idStr)
      if (kind === 'skill') {
        const skill = skillsById.get(id)
        if (!skill || !isCandidate(skill.name, skill.description)) stale.push(key)
      } else {
        const trait = traitsById.get(id)
        if (!trait || !isCandidate(trait.name, trait.description)) stale.push(key)
      }
    }
    expect(stale, 'Id(s) in EXCLUDED_IDS that no longer exist or no longer match the candidate pattern — a balance patch likely reworked them; remove the stale entry.').toEqual([])
  })

  it('every CORRUPT_MISSING_FACT_SKILLS id still exists in skills.json', () => {
    const skillIds = new Set(skills.map((s) => s.id))
    const stale = Object.keys(CORRUPT_MISSING_FACT_SKILLS)
      .map(Number)
      .filter((id) => !skillIds.has(id))
    expect(stale, 'CORRUPT_MISSING_FACT_SKILLS id(s) that no longer exist in skills.json — a balance patch likely removed/renumbered them.').toEqual([])
  })
})

describe('Well of Corruption (10671)', () => {
  const skill = skills.find((s) => s.id === 10671) as unknown as Skill

  it('now contributes a Corrupt entry via the missing-fact override', () => {
    expect(skill).toBeDefined()
    const sources = namedFactsForSkill(skill, new Set(), new Set(), undefined, BOON_STRIP_CORRUPT_MATCHERS)
    const corrupt = sources.filter((s) => s.name === 'Corrupt')
    expect(corrupt).toHaveLength(1)
    expect(corrupt[0].detail).toBe('6')
    expect(corrupt[0].targetCount).toBeNull()
  })
})

describe('Elixir of Bliss (68132)', () => {
  const skill = skills.find((s) => s.id === 68132) as unknown as Skill

  it('now contributes a Corrupt entry via the missing-fact override', () => {
    expect(skill).toBeDefined()
    const sources = namedFactsForSkill(skill, new Set(), new Set(), undefined, BOON_STRIP_CORRUPT_MATCHERS)
    const corrupt = sources.filter((s) => s.name === 'Corrupt')
    expect(corrupt).toHaveLength(1)
    expect(corrupt[0].detail).toBe('1')
    expect(corrupt[0].targetCount).toBeNull()
  })
})
