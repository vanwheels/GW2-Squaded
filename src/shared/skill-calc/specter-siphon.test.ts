import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { branchConditionalFacts } from './branch-conditional-facts'
import { numericFactLines } from './fact-numbers'
import { boonConditionFactsForSkill } from '../boon-calc/sources'

/**
 * Regression guard for the 2026-09-20 "Specter Siphon F1 Effects" fix (TODO.md Leg 2):
 * `siphonSections` in `branch-conditional-facts.ts` for the skill's own base Enemy/Ally facts, plus
 * the `synthetic-facts.json`/`BUFF_INSTANCE_VALUE_OVERRIDES.skill` follow-up that fills in every
 * Steal-modifying Thief trait's own bonus (Kleptomaniac/Sleight of Hand/Thrill of the Crime/Even the
 * Odds/Serpent's Touch/Bountiful Theft). Same "lock in what's already known-correct" purpose as
 * `luminary.test.ts`. Core Steal (13014) gets the same trait coverage — spot-checked here too since
 * the follow-up fix isn't Specter-specific.
 */

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../../../data/game-data')
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8'))
}

const skills = readJson<Skill[]>('skills.json')
const byId = new Map(skills.map((s) => [s.id, s]))
const syntheticFacts = readJson<Record<string, Skill['facts']>>('synthetic-facts.json')
function withSynthetic(skill: Skill): Skill {
  const extra = syntheticFacts[String(skill.id)] ?? []
  return { ...skill, facts: [...skill.facts, ...extra] }
}

const SIPHON_ID = 63067
const STEAL_ID = 13014
const DEADEYES_MARK_ID = 43390
const SKRITT_SWIPE_ID = 77397
const KLEPTOMANIAC_ID = 1137
const SLEIGHT_OF_HAND_ID = 1158
const THRILL_OF_THE_CRIME_ID = 1163
const EVEN_THE_ODDS_ID = 1169
const BOUNTIFUL_THEFT_ID = 1277
const SERPENTS_TOUCH_ID = 1279

describe('Specter Siphon (F1) branch-conditional facts', () => {
  const durationPercent = { boon: 0, condition: 0 }

  it('Enemy Target grants Slow and shows Shadow Force Gain', () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect(branches).not.toBeNull()
    const enemyBranch = (branches ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyBranch).toBeDefined()
    expect(enemyBranch?.facts.map((f) => f.boonOrConditionName)).toContain('Slow')
    expect(enemyBranch?.numericLines.some((l) => l.text === 'Shadow Force Gain: 25%')).toBe(true)
  })

  it('Ally Target shows a Healing-Power-scaled Barrier and cooldown reduction, with no boon/condition facts', () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 1000)
    expect(branches).not.toBeNull()
    const allyBranch = (branches ?? []).find((b) => b.label === 'Ally Target')
    expect(allyBranch).toBeDefined()
    expect(allyBranch?.facts).toEqual([])
    expect(allyBranch?.numericLines.some((l) => l.text.includes('Barrier: 1,928'))).toBe(true) // 1428 + 0.5*1000
    expect(allyBranch?.numericLines.some((l) => l.text === 'Ally Target Recharge Reduction: 50%')).toBe(true)
  })

  it('neither branch counts toward aggregate boon/condition totals (a per-cast target choice)', () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const branches = branchConditionalFacts(skill, durationPercent, 0)
    expect((branches ?? []).some((b) => b.countsTowardTotals)).toBe(false)
  })

  it('Enemy Target shows Daze only when Sleight of Hand is active', () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const without = branchConditionalFacts(skill, durationPercent, 0, new Set())
    const withTrait = branchConditionalFacts(skill, durationPercent, 0, new Set([SLEIGHT_OF_HAND_ID]))
    const enemyWithout = (without ?? []).find((b) => b.label === 'Enemy Target')
    const enemyWith = (withTrait ?? []).find((b) => b.label === 'Enemy Target')
    expect(enemyWithout?.numericLines.some((l) => l.text.startsWith('Daze'))).toBe(false)
    expect(enemyWith?.numericLines.some((l) => l.text.startsWith('Daze'))).toBe(true)
  })

  it('returns null for an unrelated skill', () => {
    const skill = byId.get(63155) // Specter F2 "Enter Shadow Shroud" — no branch-conditional facts of its own
    expect(skill).toBeDefined()
    if (!skill) return
    expect(branchConditionalFacts(skill, durationPercent, 0)).toBeNull()
  })
})

describe('Steal/Siphon trait-granted facts (synthetic-facts.json + BUFF_INSTANCE_VALUE_OVERRIDES.skill)', () => {
  const traitIds = [KLEPTOMANIAC_ID, SLEIGHT_OF_HAND_ID, THRILL_OF_THE_CRIME_ID, EVEN_THE_ODDS_ID, BOUNTIFUL_THEFT_ID, SERPENTS_TOUCH_ID]

  it.each([
    ['Siphon', SIPHON_ID],
    ['Steal', STEAL_ID],
    ["Deadeye's Mark", DEADEYES_MARK_ID],
    ['Skritt Swipe', SKRITT_SWIPE_ID]
  ])('%s shows every Steal-modifying trait bonus with none of the pve-only Might duplicate', (_label, skillId) => {
    const skill = byId.get(skillId)
    expect(skill).toBeDefined()
    if (!skill) return
    const merged = withSynthetic(skill)
    const boonFacts = boonConditionFactsForSkill(merged, new Set(traitIds), new Set(), { boon: 0, condition: 0 }, undefined)
    const byName = new Map(boonFacts.map((f) => [f.boonOrConditionName, f]))

    expect(byName.get('Vigor')).toMatchObject({ baseDurationSeconds: 10, applyCount: 1 })
    expect(byName.get('Fury')).toMatchObject({ baseDurationSeconds: 10, applyCount: 1 })
    expect(byName.get('Swiftness')).toMatchObject({ baseDurationSeconds: 10, applyCount: 1 })
    expect(byName.get('Poisoned')).toMatchObject({ baseDurationSeconds: 10, applyCount: 2 })
    // WvW-correct values only — the raw pve-tagged duplicates (Might@10@5) must be omitted.
    const mightFacts = boonFacts.filter((f) => f.boonOrConditionName === 'Might')
    expect(mightFacts).toHaveLength(2)
    expect(mightFacts).toContainEqual(expect.objectContaining({ baseDurationSeconds: 10, applyCount: 1 })) // Bountiful Theft
    expect(mightFacts).toContainEqual(expect.objectContaining({ baseDurationSeconds: 6, applyCount: 3 })) // Thrill of the Crime

    const numericLines = numericFactLines(merged.facts, merged.traitedFacts, new Set(traitIds))
    expect(numericLines.some((l) => l.text === 'Initiative: 2')).toBe(true)
    expect(numericLines.some((l) => l.text === 'Boons Stolen: 2')).toBe(true)
  })

  it("Siphon (missing Even the Odds natively) gets Vulnerability via synthetic-facts.json", () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const merged = withSynthetic(skill)
    const boonFacts = boonConditionFactsForSkill(merged, new Set([EVEN_THE_ODDS_ID]), new Set(), { boon: 0, condition: 0 }, undefined)
    expect(boonFacts).toContainEqual(expect.objectContaining({ boonOrConditionName: 'Vulnerability', baseDurationSeconds: 6, applyCount: 10 }))
  })

  it('Steal already carries Even the Odds natively (no synthetic duplicate needed)', () => {
    const skill = byId.get(STEAL_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const boonFacts = boonConditionFactsForSkill(skill!, new Set([EVEN_THE_ODDS_ID]), new Set(), { boon: 0, condition: 0 }, undefined)
    const vulnFacts = boonFacts.filter((f) => f.boonOrConditionName === 'Vulnerability')
    expect(vulnFacts).toHaveLength(1)
    expect(vulnFacts[0]).toMatchObject({ baseDurationSeconds: 6, applyCount: 10 })
  })

  it.each([
    ["Deadeye's Mark", DEADEYES_MARK_ID],
    ['Skritt Swipe', SKRITT_SWIPE_ID]
  ])(
    '%s omits its stale native pre-2024-10-08 Even the Odds Vulnerability (10s/5 stacks) in favor of the current wiki value (6s/10 stacks)',
    (_label, skillId) => {
      const skill = byId.get(skillId)
      expect(skill).toBeDefined()
      if (!skill) return
      const merged = withSynthetic(skill)
      const boonFacts = boonConditionFactsForSkill(merged, new Set([EVEN_THE_ODDS_ID]), new Set(), { boon: 0, condition: 0 }, undefined)
      const vulnFacts = boonFacts.filter((f) => f.boonOrConditionName === 'Vulnerability')
      expect(vulnFacts).toHaveLength(1)
      expect(vulnFacts[0]).toMatchObject({ baseDurationSeconds: 6, applyCount: 10 })
    }
  )

  it('no trait-granted facts show up when no Steal-modifying trait is active', () => {
    const skill = byId.get(SIPHON_ID)
    expect(skill).toBeDefined()
    if (!skill) return
    const merged = withSynthetic(skill)
    const boonFacts = boonConditionFactsForSkill(merged, new Set(), new Set(), { boon: 0, condition: 0 }, undefined)
    expect(boonFacts).toEqual([])
  })
})
