import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Fact, Skill } from '../types'
import {
  boonConditionFactsForSkill,
  namedFactsForSkill,
  CONTROL_MATCHERS,
  MISCELLANEOUS_MATCHERS,
  BOON_STRIP_CORRUPT_MATCHERS,
  NAMED_FACT_TARGET_COUNT_TABLES
} from '../boon-calc/sources'
import { skillFactLines } from './skill-fact-lines'
import { ADDITIVE_FLIP_PAIRS, ADDITIVE_FLIP_PAIR_TARGET_IDS } from './additive-flip-pairs'
import { flipTargetSkills } from './multi-effect'

/**
 * Regression guard for `ADDITIVE_FLIP_PAIRS`/`SkillsEditor.tsx`'s `additiveEnhancementFacts` — same
 * "lock in what's already known-correct" purpose as `coefficient-snapshots.test.ts`'s Tier 2 tests,
 * scoped to this table instead. Reads `data/game-data/skills.json` + `synthetic-facts.json` directly
 * and merges them the same way `load-game-data.ts`'s `withSyntheticFacts` does (see that test file's
 * own doc comment for why a plain vitest run can't import the Electron-`app`-path-dependent loader).
 *
 * Two things this guards against:
 * 1. A future `skills.json` refresh making a target id's facts collapse to exactly the base's own
 *    (e.g. a balance patch removing the enhancement) — `additiveEnhancementFacts` fails open by
 *    rendering nothing rather than an empty "When Enhanced" divider, which would silently regress to
 *    looking like the pair was never wired up. Asserted here instead, at zero player-visible cost.
 * 2. A future edit accidentally re-adding one of the Elementalist familiar pairs `additive-flip-
 *    pairs.ts`'s own doc comment explains are deliberately excluded (the base id's own facts are
 *    incomplete for that family — see that file for the full explanation) without re-verifying the
 *    wiki split first.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const rawSkills = readJson<Skill[]>('skills.json')
const syntheticFacts = readJson<Record<string, Fact[]>>('synthetic-facts.json')
const skills = rawSkills.map((s) => (syntheticFacts[s.id] ? { ...s, facts: [...s.facts, ...syntheticFacts[s.id]] } : s))
const byId = new Map(skills.map((s) => [s.id, s]))

const activeIds = new Set<number>()
const legendIds = new Set<string>()
const durationPercent = { boon: 0, condition: 0 }

function namedFactsFor(skill: Skill) {
  return [
    ...namedFactsForSkill(skill, activeIds, legendIds, undefined, CONTROL_MATCHERS),
    ...namedFactsForSkill(skill, activeIds, legendIds, undefined, MISCELLANEOUS_MATCHERS),
    ...namedFactsForSkill(skill, activeIds, legendIds, undefined, BOON_STRIP_CORRUPT_MATCHERS, NAMED_FACT_TARGET_COUNT_TABLES)
  ]
}

describe('ADDITIVE_FLIP_PAIRS', () => {
  it('has exactly the 6 hand-verified pairs (Revenant Band Together x4, Guardian Crashing Courage x2)', () => {
    expect(ADDITIVE_FLIP_PAIRS.size).toBe(6)
  })

  it('never re-includes an Elementalist Evoker familiar id (base id incomplete, see file doc comment)', () => {
    const evokerFamiliarIds = new Set([76711, 77282, 77190, 76563, 77320, 77247, 77038, 76583])
    for (const [sourceId, pair] of ADDITIVE_FLIP_PAIRS) {
      expect(evokerFamiliarIds.has(sourceId)).toBe(false)
      expect(evokerFamiliarIds.has(pair.targetId)).toBe(false)
    }
  })

  it.each(Array.from(ADDITIVE_FLIP_PAIRS.entries()))('%s -> target %o carries at least one fact the base skill does not', (sourceId, pair) => {
    const base = byId.get(sourceId)
    const target = byId.get(pair.targetId)
    expect(base, `source id ${sourceId} missing from skills.json`).toBeDefined()
    expect(target, `target id ${pair.targetId} missing from skills.json`).toBeDefined()
    if (!base || !target) return

    const baseNumericKeys = new Set(skillFactLines(base, activeIds, 1000, 1000, 2597).map((l) => l.text))
    const targetNumericLines = skillFactLines(target, activeIds, 1000, 1000, 2597)

    const boonKey = (f: ReturnType<typeof boonConditionFactsForSkill>[number]) =>
      [f.category, f.boonOrConditionName, f.isCondition, f.scaledDurationSeconds, f.applyCount, f.requiresTraitId, f.targetCount, f.instanceLabel ?? ''].join('|')
    const baseBoonKeys = new Set(boonConditionFactsForSkill(base, activeIds, legendIds, durationPercent, undefined, []).map(boonKey))
    const targetBoonFacts = boonConditionFactsForSkill(target, activeIds, legendIds, durationPercent, undefined, [])

    const namedKey = (f: ReturnType<typeof namedFactsForSkill>[number]) => [f.name, f.detail ?? '', f.targetCount].join('|')
    const baseNamedKeys = new Set(namedFactsFor(base).map(namedKey))
    const targetNamedFacts = namedFactsFor(target)

    const deltaCount =
      targetNumericLines.filter((l) => !baseNumericKeys.has(l.text)).length +
      targetBoonFacts.filter((f) => !baseBoonKeys.has(boonKey(f))).length +
      targetNamedFacts.filter((f) => !baseNamedKeys.has(namedKey(f))).length

    expect(deltaCount).toBeGreaterThan(0)
  })

  it('flipTargetSkills stops at every additive-pair target instead of showing it as a 2nd stacked icon', () => {
    for (const [sourceId] of ADDITIVE_FLIP_PAIRS) {
      const base = byId.get(sourceId)
      expect(base).toBeDefined()
      if (!base) continue
      const flips = flipTargetSkills(base, byId)
      for (const f of flips) {
        expect(ADDITIVE_FLIP_PAIR_TARGET_IDS.has(f.skill.id)).toBe(false)
      }
    }
  })
})
