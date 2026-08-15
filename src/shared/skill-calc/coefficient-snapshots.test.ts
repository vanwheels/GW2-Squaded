import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact, Skill } from '../types'
import { TARGET_ARMOR_VALUES } from '../gear-calc/combat-state'
import { CURATED_HEALING_COEFFICIENTS, healingLinesForSkill, type HealingLine } from './healing-calc'
import { CURATED_DAMAGE_COEFFICIENTS, damageLinesForSkill, type DamageLine } from './damage-calc'
import { CURATED_BARRIER_COEFFICIENTS, barrierLinesForSkill, type BarrierLine } from './barrier-calc'
import { GUNSABER_SKILLS } from './gunsaber-skills'
import { DRAGON_SLASH_SKILLS } from './dragon-slash-skills'

/**
 * Tier 2 golden snapshot fixtures — TODO.md's "Automated testing strategy" (agreed 2026-08-12): pay
 * the wiki-verification cost once (already done, 150+ sessions of curation across `healing-calc.ts`/
 * `damage-calc.ts`/`barrier-calc.ts`, see each file's own header comment), then lock the *computed*
 * output of every curated coefficient in as a snapshot so any future regression — a typo'd edit to a
 * curated entry, a `skills.json` refresh silently changing which real fact a `factText` matches
 * against, an arithmetic change in `healingLinesForSkill`/`damageLinesForSkill`/`barrierLinesForSkill`
 * — shows up as a snapshot diff instead of shipping silently. This does NOT re-verify any value
 * against the wiki (that's each curated entry's own inline comment); it only protects a value already
 * known-correct from drifting later. Distinct from the completeness scans (trait-attribute-
 * completeness.test.ts, sigil-named-fact-completeness.test.ts, combat-state.test.ts) which check that
 * every *candidate* was looked at — this checks that every *curated* entry keeps producing the number
 * it produced when it was verified.
 *
 * Reads `data/game-data/skills.json` + `synthetic-facts.json` directly (same pattern as
 * `trait-attribute-completeness.test.ts` reading `traits.json`) and merges them the same way
 * `load-game-data.ts`'s `withSyntheticFacts` does, since that merge is Electron-`app`-path-dependent
 * and can't be imported directly into a plain vitest run — several curated entries (e.g. every
 * Legendary Stance skill's "Rapid Flow Healing" line) only resolve against a synthetic fact, not a
 * real API one, so skipping the merge would silently snapshot an incomplete/wrong picture. Also
 * merges in `GUNSABER_SKILLS`/`DRAGON_SLASH_SKILLS` (plain data, no Electron dependency, so these
 * import cleanly here unlike `load-game-data.ts`) — Bladesworn's Dragon Slash chain (see
 * `dragon-slash-skills.ts`) is the first hand-authored-id source to actually get a
 * `CURATED_DAMAGE_COEFFICIENTS` entry, so `snapshotFor`'s "fail loudly if missing" lookup needs to
 * find these ids too, the same way `game-data-store.tsx` merges them for the real app.
 *
 * All three tables are evaluated at one fixed, documented reference point rather than a real build —
 * the specific numbers don't matter (they're not meant to represent any particular meta build, that's
 * Tier 3's job), only that they're the same every run. `REFERENCE_TARGET_ARMOR` reuses
 * `TARGET_ARMOR_VALUES.Medium`, the gw2skills.net WvW-golem constant `combat-state.ts` already cites,
 * rather than inventing a new number. `ALL_REFERENCE_TRAIT_IDS` activates every `requiresTrait` any
 * curated entry names across all three tables at once, so both a skill's untraited line and its
 * trait-boosted variant (e.g. Mesmer's Phantasmal Whaler, ungated 0.6 vs. Empowered Illusions-gated
 * 0.69) render into the same snapshot in one pass instead of needing a run per trait.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../../../data/game-data')

interface SkillDataFile {
  id: number
  facts: Fact[]
  traitedFacts: Fact[]
}

const rawSkills: SkillDataFile[] = JSON.parse(readFileSync(resolve(DATA_DIR, 'skills.json'), 'utf-8'))
const syntheticFacts: Record<string, Fact[]> = JSON.parse(readFileSync(resolve(DATA_DIR, 'synthetic-facts.json'), 'utf-8'))

const skillsById = new Map<number, Skill>(
  rawSkills.map((skill) => {
    const extra = syntheticFacts[String(skill.id)]
    const merged = extra ? { ...skill, facts: [...skill.facts, ...extra] } : skill
    return [skill.id, merged as unknown as Skill]
  })
)
// Hand-authored ids absent from `skills.json` entirely (see each file's own doc comment) — only
// `DRAGON_SLASH_SKILLS` currently has any `CURATED_DAMAGE_COEFFICIENTS` entries, but `GUNSABER_SKILLS`
// is merged in too for consistency/future-proofing, same set `game-data-store.tsx` merges for real.
for (const skill of [...GUNSABER_SKILLS, ...DRAGON_SLASH_SKILLS]) skillsById.set(skill.id, skill)

const REFERENCE_POWER = 2500
const REFERENCE_HEALING_POWER = 1500
const REFERENCE_TARGET_ARMOR = TARGET_ARMOR_VALUES.Medium

function traitIdsIn(table: Record<number, { requiresTrait?: number }[]>): number[] {
  return Object.values(table)
    .flatMap((entries) => entries.map((entry) => entry.requiresTrait))
    .filter((id): id is number => id != null)
}

const ALL_REFERENCE_TRAIT_IDS = new Set<number>([
  ...traitIdsIn(CURATED_HEALING_COEFFICIENTS),
  ...traitIdsIn(CURATED_DAMAGE_COEFFICIENTS),
  ...traitIdsIn(CURATED_BARRIER_COEFFICIENTS)
])

/** Looks up every curated id in `skills.json`, failing loudly (not silently skipping) if one is
 *  missing — a curated id that no longer resolves to a real skill is itself a regression a snapshot
 *  test should catch, not paper over. */
function snapshotFor<TLine>(table: Record<number, unknown[]>, computeLines: (skill: Skill) => TLine[]): Record<number, TLine[]> {
  const result: Record<number, TLine[]> = {}
  const ids = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)
  for (const id of ids) {
    const skill = skillsById.get(id)
    if (!skill) throw new Error(`Curated coefficient id ${id} has no matching skill in data/game-data/skills.json — stale id?`)
    result[id] = computeLines(skill)
  }
  return result
}

describe('golden snapshot fixtures — wiki-verified coefficient tables (TODO.md Tier 2)', () => {
  it('CURATED_HEALING_COEFFICIENTS produces stable healing lines at a fixed reference build', () => {
    const snapshot = snapshotFor<HealingLine>(CURATED_HEALING_COEFFICIENTS, (skill) =>
      healingLinesForSkill(skill, REFERENCE_HEALING_POWER, ALL_REFERENCE_TRAIT_IDS)
    )
    expect(snapshot).toMatchSnapshot()
  })

  it('CURATED_DAMAGE_COEFFICIENTS produces stable damage lines at a fixed reference build', () => {
    const snapshot = snapshotFor<DamageLine>(CURATED_DAMAGE_COEFFICIENTS, (skill) =>
      damageLinesForSkill(skill, REFERENCE_POWER, REFERENCE_TARGET_ARMOR, ALL_REFERENCE_TRAIT_IDS)
    )
    expect(snapshot).toMatchSnapshot()
  })

  it('CURATED_BARRIER_COEFFICIENTS produces stable Barrier lines at a fixed reference build', () => {
    const snapshot = snapshotFor<BarrierLine>(CURATED_BARRIER_COEFFICIENTS, (skill) =>
      barrierLinesForSkill(skill, REFERENCE_HEALING_POWER, ALL_REFERENCE_TRAIT_IDS)
    )
    expect(snapshot).toMatchSnapshot()
  })
})
